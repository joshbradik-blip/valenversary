# Valenversary

Storefront for ourvalenversary.com: Astro (server-rendered) on Netlify, Printful for products and fulfilment, Stripe Checkout for payments.

## How it works

- `/shop`, `/product/:id`: products are read live from the Printful API (cached for 5 minutes at the CDN).
- `/cart`: cart lives in the browser. The customer enters country, state and ZIP; `/api/shipping` returns live Printful shipping rates. At checkout the browser sends only variant ids, quantities, destination and the chosen rate id to `/api/checkout`, which re-prices every line and re-quotes shipping from Printful before creating a Stripe Checkout session.
- `/api/webhook`: on `checkout.session.completed` it creates the matching Printful order. Orders are drafts unless `PRINTFUL_AUTO_CONFIRM=true`.
- Moments (home page): customers upload a photo with their names, an optional caption and an optional private email. The browser re-encodes it to a JPEG of at most 2000px, which also strips location data. `/api/moments` saves the file to Firebase Storage (`moments/<id>.jpg`) and a Firestore doc in `moments` with `approved: false`. To publish a photo, set `approved` to `true` on its doc in the Firebase console; the home page gallery shows the newest 8 approved photos, served through `/api/moments/<id>`, so pending photos are never reachable. Without the `FIREBASE_*` variables the upload button reads "coming soon".

## Setup

```sh
npm install
cp .env.example .env   # fill in the values
npm run dev
```

On Netlify, set the same variables under Site configuration → Environment variables.
In Stripe, add a webhook endpoint `https://ourvalenversary.com/api/webhook` for `checkout.session.completed` and put its signing secret in `STRIPE_WEBHOOK_SECRET`.

Test locally with `stripe listen --forward-to localhost:4321/api/webhook`.
