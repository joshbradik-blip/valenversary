# Valenversary

Storefront for ourvalenversary.com: Astro (server-rendered) on Netlify, Printful for products and fulfilment, Stripe Checkout for payments.

## How it works

- `/shop`, `/product/:id`: products are read live from the Printful API (cached for 5 minutes at the CDN).
- `/cart`: cart lives in the browser. The customer enters country, state and ZIP; `/api/shipping` returns live Printful shipping rates. At checkout the browser sends only variant ids, quantities, destination and the chosen rate id to `/api/checkout`, which re-prices every line and re-quotes shipping from Printful before creating a Stripe Checkout session.
- `/api/webhook`: on `checkout.session.completed` it creates the matching Printful order. Orders are drafts unless `PRINTFUL_AUTO_CONFIRM=true`.

## Setup

```sh
npm install
cp .env.example .env   # fill in the values
npm run dev
```

On Netlify, set the same variables under Site configuration → Environment variables.
In Stripe, add a webhook endpoint `https://ourvalenversary.com/api/webhook` for `checkout.session.completed` and put its signing secret in `STRIPE_WEBHOOK_SECRET`.

Test locally with `stripe listen --forward-to localhost:4321/api/webhook`.
