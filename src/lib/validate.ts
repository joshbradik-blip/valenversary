import type { Destination } from './printful';

export const COUNTRIES = ['US', 'CA'] as const;

export function parseItems(raw: unknown): { id: number; qty: number }[] | null {
  if (!Array.isArray(raw) || !raw.length || raw.length > 30) return null;
  for (const i of raw) {
    if (!Number.isInteger(i?.id) || !Number.isInteger(i?.qty) || i.qty < 1 || i.qty > 20) return null;
  }
  return raw.map((i) => ({ id: i.id, qty: i.qty }));
}

export function parseDestination(raw: any): Destination | null {
  const country = String(raw?.country ?? '').toUpperCase();
  const state = String(raw?.state ?? '').toUpperCase().trim();
  const zip = String(raw?.zip ?? '').trim();
  if (!(COUNTRIES as readonly string[]).includes(country)) return null;
  if (!/^[A-Z]{2}$/.test(state)) return null;
  if (zip.length < 3 || zip.length > 10) return null;
  return { country, state, zip };
}
