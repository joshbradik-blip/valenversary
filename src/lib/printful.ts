import { env, requireEnv } from './env';

const API = 'https://api.printful.com';

export interface Variant {
  id: number;
  catalogVariantId: number;
  name: string;
  priceCents: number;
  currency: string;
  image: string;
  available: boolean;
}

export interface ProductSummary {
  id: number;
  name: string;
  image: string;
  priceFromCents: number | null;
}

export interface Product {
  id: number;
  name: string;
  image: string;
  variants: Variant[];
}

async function pf<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${requireEnv('PRINTFUL_API_TOKEN')}`,
    'Content-Type': 'application/json',
  };
  const store = env('PRINTFUL_STORE_ID');
  if (store) headers['X-PF-Store-Id'] = store;

  const res = await fetch(`${API}${path}`, { ...init, headers: { ...headers, ...(init.headers as object) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Printful ${res.status} on ${path}: ${body?.error?.message ?? res.statusText}`);
  return body.result as T;
}

const toCents = (price: string | number) => Math.round(parseFloat(String(price)) * 100);

function mapVariant(v: any): Variant {
  const preview = v.files?.find((f: any) => f.type === 'preview')?.preview_url;
  return {
    id: v.id,
    catalogVariantId: v.variant_id ?? v.product?.variant_id,
    name: v.name,
    priceCents: toCents(v.retail_price),
    currency: String(v.currency ?? 'USD').toLowerCase(),
    image: preview ?? v.product?.image ?? '',
    available: v.availability_status ? v.availability_status === 'active' : true,
  };
}

export async function listProducts(): Promise<ProductSummary[]> {
  const list = await pf<any[]>('/store/products?limit=100');
  const live = list.filter((p) => !p.is_ignored);
  const details = await Promise.all(live.map((p) => getProduct(p.id).catch(() => null)));
  return details
    .filter((p): p is Product => !!p)
    .map((p) => ({
      id: p.id,
      name: p.name,
      image: p.image,
      priceFromCents: p.variants.length ? Math.min(...p.variants.map((v) => v.priceCents)) : null,
    }));
}

export async function getProduct(id: number | string): Promise<Product> {
  const r = await pf<any>(`/store/products/${id}`);
  const variants = (r.sync_variants as any[]).map(mapVariant);
  return {
    id: r.sync_product.id,
    name: r.sync_product.name,
    image: r.sync_product.thumbnail_url ?? variants[0]?.image ?? '',
    variants,
  };
}

/**
 * Server-trusted lookup of a single sync variant, used to price checkout and quotes.
 * When the product id is known we read it through the product endpoint (the same one the
 * shop uses); otherwise we fall back to the single-variant endpoint.
 */
export async function getVariant(syncVariantId: number | string, productId?: number | string) {
  if (productId !== undefined) {
    const product = await getProduct(productId);
    const found = product.variants.find((v) => String(v.id) === String(syncVariantId));
    if (!found) throw new Error(`Variant ${syncVariantId} not found in product ${productId}`);
    return { ...found, productName: product.name };
  }
  const r = await pf<any>(`/store/variants/${syncVariantId}`);
  const raw = r?.sync_variant ?? (r?.id ? r : undefined);
  if (!raw) throw new Error(`Unexpected variant response (keys: ${Object.keys(r ?? {}).join(', ') || 'none'})`);
  return { ...mapVariant(raw), productName: raw.name as string };
}

export interface Destination {
  address1: string;
  city: string;
  country: string;
  state?: string;
  zip: string;
}

export interface ShippingRate {
  id: string;
  name: string;
  rateCents: number;
  currency: string;
  minDays?: number;
  maxDays?: number;
}

/** Live shipping quotes from Printful for the items in the cart. */
export async function getShippingRates(
  dest: Destination,
  items: { id: number; qty: number; productId?: number }[],
): Promise<ShippingRate[]> {
  const variants = await Promise.all(items.map((i) => getVariant(i.id, i.productId)));
  const rates = await pf<any[]>('/shipping/rates', {
    method: 'POST',
    body: JSON.stringify({
      recipient: { address1: dest.address1, city: dest.city, country_code: dest.country, state_code: dest.state || undefined, zip: dest.zip },
      items: items.map((i, n) => ({ variant_id: variants[n].catalogVariantId, quantity: i.qty })),
      currency: 'USD',
    }),
  });
  return rates.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    rateCents: toCents(r.rate),
    currency: String(r.currency ?? 'USD').toLowerCase(),
    minDays: r.minDeliveryDays,
    maxDays: r.maxDeliveryDays,
  }));
}

export interface PrintfulOrderInput {
  recipient: {
    name: string;
    address1: string;
    address2?: string;
    city: string;
    state_code?: string;
    country_code: string;
    zip: string;
    email?: string;
    phone?: string;
  };
  items: { sync_variant_id: number; quantity: number }[];
  external_id: string;
}

export async function createOrder(order: PrintfulOrderInput) {
  const confirm = env('PRINTFUL_AUTO_CONFIRM') === 'true';
  return pf<any>(`/orders${confirm ? '?confirm=true' : ''}`, { method: 'POST', body: JSON.stringify(order) });
}

export const formatPrice = (cents: number, currency = 'usd') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
