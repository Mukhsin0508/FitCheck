# Contributing to FitCheck

Thanks for looking under the hood. Here's everything you need.

## Setup

```bash
git clone https://github.com/Mukhsin0508/FitCheck.git
cd FitCheck
npm install        # npm workspaces — one install for everything
npm run mobile     # Expo dev server (press i / a for a simulator)
npm run landing    # Next.js landing page
```

Node ≥ 20. Demo mode needs no env vars; for real renders see the README.

## Before you push

```bash
npm run typecheck
npm test
```

Both must be green. CI is just these two commands, so if they pass locally you're fine.

## Ground rules

- **Money code needs tests.** Anything in `packages/affiliates` (deep links, subids,
  postback parsing) or cost accounting in `packages/higgsfield` ships with unit tests —
  a wrong subid is silent lost revenue.
- **Never commit credentials.** API keys live in `apps/mobile/.env` (gitignored).
  Committed code and docs reference the production host only. The web export that lands
  on the landing page must contain zero keys — grep the bundle if you touch the export.
- **The client mirrors the real protocol.** `packages/higgsfield` follows the published
  OpenAPI schema (`docs/higgsfield-openapi.json`). If the platform changes, update the
  snapshot in the same PR.
- **Copy follows the house style.** Sentence case, contractions, plain words. No
  "seamless", "effortless", or "elevate", and no exclamation marks in the UI.
- **Design tokens are fixed.** Ivory `#F6F4EF`, ink `#131313`, lime `#D4F53C`,
  Instrument Serif for display type. New UI uses these, not new colors.

## PRs

Keep them focused — one change per PR, with a description of what you verified and how.
Screenshots or a screen recording for anything visual. If you're planning something big,
open an issue first so nobody builds the same thing twice.

## Reporting bugs

An issue with reproduction steps beats a perfect one-liner. Include the platform
(iOS / Android / web embed), what you did, what you expected, and what happened.
