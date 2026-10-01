import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { getVariant } from '../../lib/printful';
import { stripe } from '../../lib/stripe';

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

  const items: { id: number; qty: number }[] = Array.isArray(payload?.items) ? payload.items : [];
  if (!items.length || items.length > 30) return json({ error: 'Your cart is empty.' }, 400);
  for (const i of items) {
    if (!Number.isInteger(i.id) || !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 20) {
      return json({ error: 'Invalid cart item.' }, 400);
    }
  }

  try {
    // Prices always come from Printful, never from the browser.
    const variants = await Promise.all(items.map((i) => getVariant(i.id)));
    if (variants.some((v) => !v.available)) return json({ error: 'An item in your cart is no longer available.' }, 409);

    const site = env('SITE_URL') ?? new URL(request.url).origin;
    const shippingRate = env('STRIPE_SHIPPING_RATE_ID');

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
      shipping_address_collection: { allowed_countries: ['US', 'CA'] },
      phone_number_collection: { enabled: true },
      ...(shippingRate ? { shipping_options: [{ shipping_rate: shippingRate }] } : {}),
      success_url: `${site}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/cart`,
    });

    return json({ url: session.url });
  } catch (err) {
    console.error('checkout failed', err);
    return json({ error: 'We could not start checkout. Please try again.' }, 500);
  }
};
