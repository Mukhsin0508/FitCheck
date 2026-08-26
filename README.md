# FitCheck

**See it on you before you buy it.**

FitCheck is a virtual try-on shopping app. A few selfies become your photoreal
avatar. Any garment from the catalog — or any product link you paste — renders
on *your* body in seconds. Like it? One tap opens the store and you buy it
there. Merchants pay us an affiliate commission; you never pay FitCheck
anything.

Built by [Mukhsin Mukhtorov](https://github.com/Mukhsin0508). MIT licensed.

<p>
  <img src="apps/landing/public/media/p01-trench.jpg" width="19%" alt="Catalog: trench coat" />
  <img src="apps/landing/public/media/fit-trench.jpg" width="19%" alt="Rendered on the avatar" />
  <img src="apps/landing/public/media/p07-slip-dress.jpg" width="19%" alt="Catalog: slip dress" />
  <img src="apps/landing/public/media/fit-slip.jpg" width="19%" alt="Rendered on the avatar" />
  <img src="apps/landing/public/media/avatar.jpg" width="19%" alt="Demo avatar" />
</p>

*All imagery generated with Higgsfield Soul.*

## Why this exists

Try-on tech and affiliate commerce both work; nobody has closed the loop
between them at scale. Doji raised $14M and has no purchase flow. Google Doppl
has no monetization. Whering has 10M users and no photoreal try-on. FitCheck's
whole product is the loop: **try-on → want it → tracked checkout**.

The unit economics carry it:

- A try-on render costs **$0.04–0.09** (FASHN $0.075, Kling $0.07, Higgsfield
  Soul ≈ $0.09).
- Expected commission per try-on session at fashion baselines is
  **$0.24–0.75** (AOV $80–115 × 8–16% commission × 2.4% baseline conversion,
  lifted 27–94% by try-on per Shopify/Google studies).
- That's 3–10× margin per session before the ~26% apparel-return haircut.

So: cap free renders, cache aggressively (same user + same garment = same
render), log the cost of every render, and prioritize affiliate programs with
30-day cookies and 10%+ commissions (SHEIN, H&M, Farfetch tier) over weak
rails like Amazon Fashion's 4%/24h.

## What's in the box

```
fitcheck/
├── apps/
│   ├── mobile/       # Expo (React Native) app — the product
│   └── landing/      # Next.js landing page → Vercel
└── packages/
    ├── higgsfield/   # Typed Higgsfield API client (Soul avatars, try-on, jobs)
    ├── tryon/        # Provider-agnostic try-on: Higgsfield ⇄ FASHN ⇄ Kling
    ├── affiliates/   # Deep links + subid attribution + postback parsing
    └── catalog/      # Normalized product feed (216 items, 2 categories)
```

### `@fitcheck/higgsfield`

A typed client for the Higgsfield **platform API**
(`https://platform.higgsfield.ai`), speaking the same wire protocol as the
official `@higgsfield/client` v2 SDK: auth is a single
`authorization: Key <KEY_ID:KEY_SECRET>` header, a generation is
`POST /{endpointSlug}` (slugs are model ids like
`higgsfield-ai/soul/standard` — no `/v1` prefix anywhere) with the input as
the JSON body, and the response is a flat
`{ request_id, status, images?, ... }` you poll at
`GET /requests/{id}/status` until terminal
(`queued | in_progress | completed | failed | nsfw | canceled`). Endpoint
paths live in one file (`src/endpoints.ts`), model slugs as data in another
(`src/models.ts`), response schemas in a third (`src/schemas.ts`).

```ts
const hf = HiggsfieldClient.create({ credentials: 'KEY_ID:KEY_SECRET' });

// The core loop: garment → a photo of the user wearing it
const render = await hf.tryon.renderAndWait({
  soulId: user.soulId,
  garmentImage: product.imageUrl,
  category: 'dress',
});

// Billing-grade quote before submitting (POST /estimate/{endpoint})
const quote = await hf.estimateRemote('higgsfield-ai/soul/standard', { prompt });
```

It ships retries with jittered backoff (429/5xx and the account concurrency
cap, honoring `Retry-After` with a 30s ceiling), polling at the documented
cadence (2s × 1.5 backoff capped at 10s, plus 0–500ms jitter), an error
taxonomy (401 auth, 403 insufficient credits, 422 validation…), per-render
cost accounting (`onUsage` + `estimateRemote`), and a full in-memory mock
(`HiggsfieldClient.mock()`) that speaks the real protocol through the real
transport/retry/polling stack, offline.

Two caveats, marked loudly in the source: the try-on slug is **unverified**
(not in the public docs yet — override via `tryOnEndpoint`), and there is
**no public Soul ID API** yet, so `hf.souls.*` throws a clear error until you
configure `soulsBasePath` (demo mode never calls it). ⚠️ Result URLs are
pre-signed CDN links that **expire (~7 days)** — download or persist renders
promptly.

**Which client to use:** on a Node-only server, Higgsfield's official
`@higgsfield/client` works great; this package exists for typed,
multi-runtime use (Node, browsers, React Native/Hermes) with an offline mock
mode, a FitCheck-shaped error taxonomy, and spend accounting hooks.

**Keep it server-side.** The `KEY_ID:KEY_SECRET` pair never ships in the app;
the mobile client is designed to talk to a thin FitCheck API that holds the
credentials.

### `@fitcheck/tryon`

The provider abstraction: pick a provider per garment category, fall through
on failure, cache renders (avatar version is part of the cache key, so a new
avatar invalidates everything), and log every render's cost — cached hits log
$0.00.

### `@fitcheck/affiliates`

One module per network — Awin, Rakuten, CJ, Partnerize, direct — building
correct deep links with a subid that encodes `user.session.product.render`,
plus postback parsing that turns network callbacks into normalized commission
events. This is how a purchase gets attributed back to the try-on that sold it.

### `apps/mobile`

Expo SDK 57 / React Native. Onboarding (camera selfies → avatar), a 216-item
catalog with category filters, the try-on screen, a closet, a share-card
generator (side-by-side or 2×2 grid, watermarked), paste-a-URL try-on, and
affiliate click-out. Runs fully offline in demo mode: a mock provider with a
realistic render delay stands in for the API, so the whole loop works with
zero spend.

## Run it

```bash
npm install

# The app (Expo — press i for iOS simulator, a for Android)
npm run mobile

# The landing page
npm run landing

# Checks
npm run typecheck
npm test
```

Node ≥ 20. No env vars needed for demo mode.

## Deploy the landing page

The landing lives in `apps/landing` (Next.js). On [Vercel](https://vercel.com):
import the repo, set **Root Directory** to `apps/landing`, and deploy —
no other configuration.

## Privacy, non-negotiable

Selfies exist to build your avatar and for nothing else. In demo mode they
never leave the phone. The production design encrypts user photos, never uses
them for training, and deleting your account purges photos and renders. In the
app, "Delete everything on this phone" removes selfie files from disk and
resets the stored identity — not just UI state.

## v1 definition of done

- [x] Selfies → avatar → try-on render in < 10s → affiliate click-out with a
      correct per-network subid
- [x] Postback parsing that turns a network callback into an attributed
      commission event (`parsePostback`)
- [x] Share card ships with every render; render cost per user logged
- [x] 200+ catalog items across 2 categories with validated feed ingestion
- [x] Client speaks the real platform protocol (verified against
      `@higgsfield/client` v2 and the OpenBinge integration)
- [ ] Live affiliate program credentials (Awin/Rakuten/CJ/Partnerize accounts)
- [ ] Verified try-on endpoint slug + public Soul ID API from Higgsfield
- [ ] FitCheck server (keeps API credentials off the device, receives postbacks)

## License

MIT
