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

A typed client for the Higgsfield API, built to be regenerated against the
official OpenAPI schema when it lands — every endpoint path lives in one file
(`src/endpoints.ts`), every response schema in another (`src/schemas.ts`).

```ts
const hf = HiggsfieldClient.create({ apiKey, apiSecret });

// Onboarding: selfies → garment-agnostic avatar
const soul = await hf.souls.create({ name: 'Amara', selfies, fullBody });
await hf.souls.waitUntilReady(soul.id);

// The core loop: garment → a photo of the user wearing it
const render = await hf.tryon.renderAndWait({
  soulId: soul.id,
  garmentImage: product.imageUrl,
  category: 'dress',
});
```

It ships retries with jittered backoff (429/5xx, honoring `Retry-After`),
idempotency keys on job-creating POSTs, an error taxonomy, cancellable
polling, per-render cost accounting (`onUsage`), and a full in-memory mock
(`HiggsfieldClient.mock()`) that exercises the real transport/retry/polling
stack offline.

**Keep it server-side.** The key/secret pair never ships in the app; the
mobile client is designed to talk to a thin FitCheck API that holds the
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
them for training, and deleting your account purges photos and renders. The
Higgsfield client exposes `souls.delete()` precisely for that path.

## v1 definition of done

- [x] Selfies → avatar → try-on render in < 10s → affiliate click-out with a
      correct per-network subid
- [x] Postback parsing that turns a network callback into an attributed
      commission event (`parsePostback`)
- [x] Share card ships with every render; render cost per user logged
- [x] 200+ catalog items across 2 categories with validated feed ingestion
- [ ] Live affiliate program credentials (Awin/Rakuten/CJ/Partnerize accounts)
- [ ] Higgsfield OpenAPI schema wired into `packages/higgsfield`
- [ ] FitCheck server (keeps API credentials off the device, receives postbacks)

## License

MIT
