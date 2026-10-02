import type { APIRoute } from 'astro';
import { momentsEnabled, readApprovedPhoto } from '../../../lib/moments';

export const prerender = false;

// Serves approved photos only; pending uploads are never reachable from the site.
export const GET: APIRoute = async ({ params }) => {
  const id = params.id ?? '';
  if (!momentsEnabled() || !/^[0-9a-f-]{36}$/.test(id)) return new Response(null, { status: 404 });
  try {
    const bytes = await readApprovedPhoto(id);
    if (!bytes) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    return new Response(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
    });
  } catch (err) {
    console.error('moment photo failed', err);
    return new Response(null, { status: 502 });
  }
};
