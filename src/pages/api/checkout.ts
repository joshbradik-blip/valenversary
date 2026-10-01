import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { getShippingRates, getVariant } from '../../lib/printful';
import { stripe } from '../../lib/stripe';
import { parseDestination, parseItems } from '../../lib/validate';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }

  const items = parseItems(payload?.items);
  if (!items) return json({ error: 'Your cart is empty.' }, 400);
  const destination = parseDestination(payload?.destination);
  if (!destination || typeof payload?.shippingId !== 'string') {
    return json({ error: 'Choose a shipping option first.' }, 400);
  }

  try {
    // Prices and shipping always come from Printful, never from the browser.
    const variants = await Promise.all(items.map((i) => getVariant(i.id)));
    if (variants.some((v) => !v.available)) return json({ error: 'An item in your cart is no longer available.' }, 409);

    const rates = await getShippingRates(destination, items);
    const rate = rates.find((r) => r.id === payload.shippingId);
    if (!rate) return json({ error: 'That shipping option is no longer available. Please re-select.' }, 409);

    const site = env('SITE_URL') ?? new URL(request.url).origin;

    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      line_items: items.map((i, n) => ({
        quantity: i.qty,
        price_data: {
          currency: variants[n].currency,
          unit_amount: variants[n].priceCents,
          product_data: {
            name: variants[n].name,
            ...(variants[n].image ? { images: [variants[n].image] } : {}),
            metadata: { sync_variant_id: String(i.id) },
          },
        },
      })),
      shipping_address_collection: { allowed_countries: [destination.country as 'US' | 'CA'] },
      phone_number_collection: { enabled: true },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            display_name: rate.name,
            fixed_amount: { amount: rate.rateCents, currency: rate.currency },
            ...(rate.minDays && rate.maxDays
              ? {
                  delivery_estimate: {
                    minimum: { unit: 'business_day' as const, value: rate.minDays },
                    maximum: { unit: 'business_day' as const, value: rate.maxDays },
                  },
                }
              : {}),
          },
        },
      ],
      success_url: `${site}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/cart`,
    });

    return json({ url: session.url });
  } catch (err) {
    console.error('checkout failed', err);
    return json({ error: 'We could not start checkout. Please try again.' }, 500);
  }
};
