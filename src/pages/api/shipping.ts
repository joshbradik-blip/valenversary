import type { APIRoute } from 'astro';
import { getShippingRates } from '../../lib/printful';
import { parseDestination, parseItems } from '../../lib/validate';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const payload = await request.json().catch(() => null);
  const items = parseItems(payload?.items);
  const destination = parseDestination(payload?.destination);
  if (!items) return json({ error: 'Your cart is empty.' }, 400);
  if (!destination) return json({ error: 'Enter your street address, city, 2-letter state and ZIP/postal code.' }, 400);

  try {
    const rates = await getShippingRates(destination, items);
    if (!rates.length) return json({ error: 'We cannot ship these items to that address.' }, 422);
    return json({ rates });
  } catch (err) {
    console.error('shipping failed', err);
    return json({ error: 'We could not calculate shipping. Please check the address and try again.' }, 502);
  }
};
