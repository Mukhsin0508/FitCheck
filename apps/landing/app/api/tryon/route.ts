/**
 * The try-on render proxy — the only server FitCheck has.
 *
 * The web embed posts a visitor's photo (data URL) + a garment URL here; this
 * route holds the Higgsfield key (server-side env, never in any bundle),
 * uploads the photo, submits the render, and lets the client poll the status.
 *
 * Spend safety on a public demo:
 * - Hard cap per IP per day (CAP_USD), tracked in-memory per instance and
 *   mirrored in a tamper-evident HMAC cookie so instance recycling doesn't
 *   reset an honest visitor's meter.
 * - Same-site requests only; tiny JSON surface; no key material ever returned.
 */

import { createHmac, createHash } from "node:crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CAP_USD = 5;
const COST_PER_RENDER_USD = 0.1; // counted conservatively (~$0.09 actual)
const CAP_CENTS = CAP_USD * 100;
const COST_CENTS = Math.round(COST_PER_RENDER_USD * 100);
const MAX_PERSON_BYTES = 4 * 1024 * 1024;
const COOKIE_NAME = "fc_rs";

const GARMENT_NOUN: Record<string, string> = {
  outerwear: "outerwear piece",
  dress: "dress",
  top: "top",
  bottom: "bottoms",
  auto: "garment",
};

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

const BASE_URL = () => env("HIGGSFIELD_BASE_URL") ?? "https://platform.higgsfield.ai";
const ENDPOINT = () => env("HIGGSFIELD_TRYON_ENDPOINT") ?? "higgsfield-ai/popcorn/auto";

function hfHeaders(credentials: string): Record<string, string> {
  return {
    authorization: `Key ${credentials}`,
    "content-type": "application/json",
    // The platform WAF rejects default fetch user agents.
    "user-agent": "fitcheck-render-proxy/0.1",
  };
}

function json(status: number, body: unknown, setCookie?: string): Response {
  const headers = new Headers({
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  if (setCookie) headers.set("set-cookie", setCookie);
  return new Response(JSON.stringify(body), { status, headers });
}

// ---- spend metering -------------------------------------------------------

/** In-memory per-IP cents, per warm instance. The cookie carries it across. */
const ipSpend = new Map<string, { cents: number; day: string }>();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function secret(credentials: string): string {
  return env("TRYON_COOKIE_SECRET") ?? createHash("sha256").update(credentials).digest("hex");
}

function sign(payload: string, credentials: string): string {
  return createHmac("sha256", secret(credentials)).update(payload).digest("hex").slice(0, 32);
}

function readCookieCents(req: Request, credentials: string): number {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([0-9]+)\\.([0-9-]+)\\.([a-f0-9]+)`));
  if (!match) return 0;
  const [, cents, day, mac] = match;
  if (day !== today()) return 0;
  if (sign(`${cents}.${day}`, credentials) !== mac) return 0; // tampered — ignore
  return Number(cents) || 0;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? (fwd.split(",")[0] ?? "").trim() || "unknown" : "unknown";
}

function currentCents(req: Request, ip: string, credentials: string): number {
  const day = today();
  const mem = ipSpend.get(ip);
  const memCents = mem && mem.day === day ? mem.cents : 0;
  return Math.max(memCents, readCookieCents(req, credentials));
}

function chargedCookie(cents: number, credentials: string): string {
  const day = today();
  const payload = `${cents}.${day}`;
  return `${COOKIE_NAME}=${payload}.${sign(payload, credentials)}; Path=/api/tryon; Max-Age=86400; SameSite=Strict; HttpOnly; Secure`;
}

// ---- guards ---------------------------------------------------------------

function crossSite(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  return site !== null && site !== "same-origin" && site !== "same-site" && site !== "none";
}

// ---- handlers -------------------------------------------------------------

export async function POST(req: Request): Promise<Response> {
  const credentials = env("HIGGSFIELD_CREDENTIALS");
  if (!credentials) return json(503, { error: "render proxy is not configured" });
  if (crossSite(req)) return json(403, { error: "same-site requests only" });

  let body: { person?: string; garment?: string; category?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "expected a JSON body" });
  }

  const personMatch =
    typeof body.person === "string"
      ? body.person.match(/^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/)
      : null;
  if (!personMatch) return json(400, { error: "person must be a jpeg/png data URL" });
  const personBytes = Buffer.from(personMatch[2]!, "base64");
  if (personBytes.length < 1_000 || personBytes.length > MAX_PERSON_BYTES) {
    return json(400, { error: "person photo is empty or too large" });
  }

  const garment = typeof body.garment === "string" ? body.garment : "";
  if (!/^https:\/\/[^\s]{1,2000}$/.test(garment)) {
    return json(400, { error: "garment must be an https URL" });
  }

  const noun = GARMENT_NOUN[body.category ?? "auto"] ?? GARMENT_NOUN["auto"]!;

  // The cap, before any spend happens.
  const ip = clientIp(req);
  const spentCents = currentCents(req, ip, credentials);
  if (spentCents + COST_CENTS > CAP_CENTS) {
    return json(429, {
      error: `the free demo budget for your connection ($${CAP_USD}) is used up — run the app locally with your own key to keep going`,
      spentUsd: spentCents / 100,
      capUsd: CAP_USD,
    });
  }

  const base = BASE_URL();

  // 1. Person photo → Higgsfield file storage.
  const contentType = personMatch[1] === "png" ? "image/png" : "image/jpeg";
  const uploadRes = await fetch(`${base}/files/generate-upload-url`, {
    method: "POST",
    headers: hfHeaders(credentials),
    body: JSON.stringify({ content_type: contentType }),
  });
  if (!uploadRes.ok) return json(502, { error: `upload url failed: HTTP ${uploadRes.status}` });
  const upload = (await uploadRes.json()) as {
    upload_url: string;
    upload_headers?: Record<string, string>;
    public_url: string;
  };
  // The pre-signed PUT is signature-sensitive: send ONLY the given headers.
  const putRes = await fetch(upload.upload_url, {
    method: "PUT",
    headers: upload.upload_headers ?? {},
    body: personBytes,
  });
  if (!putRes.ok) return json(502, { error: `photo upload failed: HTTP ${putRes.status}` });

  // 2. Submit the render.
  const prompt =
    `The exact same person from the first image, 100% face accuracy, same age ` +
    `and same body, now wearing the ${noun} from the second image. Full-body ` +
    `view, natural fit and drape, bright minimal room with soft window light, ` +
    `photoreal, no waxy skin, no plastic retouching.`;
  const submitRes = await fetch(`${base}/${ENDPOINT()}`, {
    method: "POST",
    headers: hfHeaders(credentials),
    body: JSON.stringify({
      prompt,
      image_urls: [upload.public_url, garment],
      aspect_ratio: "3:4",
    }),
  });
  if (!submitRes.ok) {
    const detail = submitRes.status === 403 ? "render account is out of credits" : "render submit failed";
    return json(502, { error: `${detail} (HTTP ${submitRes.status})` });
  }
  const submitted = (await submitRes.json()) as { request_id?: string };
  if (!submitted.request_id) return json(502, { error: "render submit returned no id" });

  // 3. Charge the meter only after a successful submit.
  const newCents = spentCents + COST_CENTS;
  ipSpend.set(ip, { cents: newCents, day: today() });
  if (ipSpend.size > 10_000) ipSpend.clear(); // crude bound; the cookie still meters

  return json(200, { id: submitted.request_id }, chargedCookie(newCents, credentials));
}

export async function GET(req: Request): Promise<Response> {
  const credentials = env("HIGGSFIELD_CREDENTIALS");
  if (!credentials) return json(503, { error: "render proxy is not configured" });
  if (crossSite(req)) return json(403, { error: "same-site requests only" });

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(id)) return json(400, { error: "bad request id" });

  const res = await fetch(`${BASE_URL()}/requests/${id}/status`, {
    headers: hfHeaders(credentials),
  });
  if (!res.ok) return json(502, { error: `status check failed: HTTP ${res.status}` });
  const body = (await res.json()) as {
    status?: string;
    images?: { url?: string; preview_url?: string }[];
  };
  // Only what the client needs — never the raw upstream payload.
  return json(200, {
    status: body.status,
    images: (body.images ?? []).map((image) => ({
      url: image.url,
      preview_url: image.preview_url,
    })),
  });
}
