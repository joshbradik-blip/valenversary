import type { APIRoute } from 'astro';
import type Stripe from 'stripe';
import { requireEnv } from '../../lib/env';
import { createOrder } from '../../lib/printful';
import { stripe } from '../../lib/stripe';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const signature = request.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await request.text(), signature, requireEnv('STRIPE_WEBHOOK_SECRET'));
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') return new Response('ignored', { status: 200 });

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== 'paid') return new Response('not paid', { status: 200 });

  try {
    const full = await stripe().checkout.sessions.retrieve(session.id, {
      expand: ['line_items.data.price.product'],
    });

    const shipping = (full as any).collected_information?.shipping_details ?? (full as any).shipping_details;
    const addr = shipping?.address;
    if (!addr) throw new Error(`Session ${session.id} has no shipping address`);

    const items = (full.line_items?.data ?? []).map((li) => ({
      sync_variant_id: Number((li.price?.product as Stripe.Product).metadata.sync_variant_id),
      quantity: li.quantity ?? 1,
    }));

    await createOrder({
      external_id: session.id.slice(-32),
      recipient: {
        name: shipping.name ?? full.customer_details?.name ?? '',
        address1: addr.line1 ?? '',
        address2: addr.line2 ?? undefined,
        city: addr.city ?? '',
        state_code: addr.state ?? undefined,
        country_code: addr.country ?? 'US',
        zip: addr.postal_code ?? '',
        email: full.customer_details?.email ?? undefined,
        phone: full.customer_details?.phone ?? undefined,
      },
      items,
    });
  } catch (err) {
    // Stripe may redeliver an event; Printful rejects a repeated external_id, which means the order already exists.
    if (err instanceof Error && /already exists|external_id/i.test(err.message)) return new Response('duplicate', { status: 200 });
    console.error('printful order failed', err);
    // A non-2xx makes Stripe retry the webhook.
    return new Response('order failed', { status: 500 });
  }

  return new Response('ok', { status: 200 });
};
