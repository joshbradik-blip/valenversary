import type { Destination } from './printful';

export const COUNTRIES = ['US', 'CA'] as const;

export function parseItems(raw: unknown): { id: number; qty: number; productId?: number }[] | null {
  if (!Array.isArray(raw) || !raw.length || raw.length > 30) return null;
  for (const i of raw) {
    if (!Number.isInteger(i?.id) || !Number.isInteger(i?.qty) || i.qty < 1 || i.qty > 20) return null;
    if (i.productId !== undefined && !Number.isInteger(i.productId)) return null;
  }
  return raw.map((i) => ({ id: i.id, qty: i.qty, productId: i.productId }));
}

export function parseDestination(raw: any): Destination | null {
  const address1 = String(raw?.address1 ?? '').trim();
  const city = String(raw?.city ?? '').trim();
  const country = String(raw?.country ?? '').toUpperCase();
  const state = String(raw?.state ?? '').toUpperCase().trim();
  const zip = String(raw?.zip ?? '').trim();
  if (!(COUNTRIES as readonly string[]).includes(country)) return null;
  if (address1.length < 3 || address1.length > 100) return null;
  if (city.length < 2 || city.length > 60) return null;
  if (!/^[A-Z]{2}$/.test(state)) return null;
  if (zip.length < 3 || zip.length > 10) return null;
  return { address1, city, country, state, zip };
}
