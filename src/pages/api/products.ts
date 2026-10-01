import type { APIRoute } from 'astro';
import { listProducts } from '../../lib/printful';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    return new Response(JSON.stringify(await listProducts()), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=0, s-maxage=300' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Products unavailable' }), { status: 502 });
  }
};
