export interface CartItem {
  id: number; // Printful sync variant id
  productId: number;
  name: string;
  variant: string;
  priceCents: number;
  image: string;
  qty: number;
}

const KEY = 'valenversary-cart-v1';
const EVENT = 'cart:change';

export function readCart(): CartItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: CartItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable; cart lasts for this page view only */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: items }));
}

export function addToCart(item: Omit<CartItem, 'qty'>, qty = 1) {
  const items = readCart();
  const existing = items.find((i) => i.id === item.id);
  if (existing) existing.qty = Math.min(20, existing.qty + qty);
  else items.push({ ...item, qty });
  write(items);
}

export function setQty(id: number, qty: number) {
  const items = readCart()
    .map((i) => (i.id === id ? { ...i, qty: Math.min(20, qty) } : i))
    .filter((i) => i.qty > 0);
  write(items);
}

export function clearCart() {
  write([]);
}

export const onCartChange = (fn: (items: CartItem[]) => void) => {
  window.addEventListener(EVENT, () => fn(readCart()));
  window.addEventListener('storage', () => fn(readCart()));
  fn(readCart());
};

export const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
