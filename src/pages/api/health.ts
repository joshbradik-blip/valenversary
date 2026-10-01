import type { APIRoute } from 'astro';
import { env } from '../../lib/env';

export const prerender = false;

/** Temporary diagnostics: reports whether Printful is reachable. Never returns secrets or store details. */
export const GET: APIRoute = async () => {
  const token = env('PRINTFUL_API_TOKEN');
  const storeId = env('PRINTFUL_STORE_ID');
  const out: Record<string, unknown> = { tokenSet: !!token, storeIdSet: !!storeId };

  if (token) {
    try {
      const res = await fetch('https://api.printful.com/store/products?limit=1', {
        headers: { Authorization: `Bearer ${token}`, ...(storeId ? { 'X-PF-Store-Id': storeId } : {}) },
      });
      const body: any = await res.json().catch(() => ({}));
      out.printfulStatus = res.status;
      out.printfulMessage = body?.error?.message ?? (res.ok ? 'ok' : res.statusText);
      if (res.ok) out.productCount = body?.paging?.total ?? body?.result?.length ?? null;
    } catch (err) {
      out.fetchError = err instanceof Error ? err.message : String(err);
    }
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
