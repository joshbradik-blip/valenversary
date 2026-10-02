import type { APIRoute } from 'astro';
import { momentsEnabled, saveMoment } from '../../../lib/moments';

export const prerender = false;

// The browser re-encodes photos to a ~2000px JPEG before sending, so real uploads land well
// under this; it also keeps us inside Netlify's 6 MB function request limit.
const MAX_BYTES = 4 * 1024 * 1024;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const field = (form: FormData, name: string) => String(form.get(name) ?? '').trim();

export const POST: APIRoute = async ({ request }) => {
  if (!momentsEnabled()) return json({ error: 'Photo uploads are not available yet.' }, 503);

  const form = await request.formData().catch(() => null);
  if (!form) return json({ error: 'Please choose a photo to upload.' }, 400);

  // Honeypot: real visitors never see or fill this field.
  if (field(form, 'website')) return json({ ok: true });

  const names = field(form, 'names');
  const caption = field(form, 'caption');
  const email = field(form, 'email');
  if (names.length < 1 || names.length > 60) return json({ error: 'Add your first names (up to 60 characters).' }, 400);
  if (caption.length > 140) return json({ error: 'Keep the caption to 140 characters.' }, 400);
  if (email && (email.length > 254 || !EMAIL.test(email))) return json({ error: 'That email address does not look right.' }, 400);
  if (form.get('consent') !== 'on') return json({ error: 'Please confirm you own the photo and agree to us sharing it.' }, 400);

  const photo = form.get('photo');
  if (!(photo instanceof File) || photo.size === 0) return json({ error: 'Please choose a photo to upload.' }, 400);
  if (photo.size > MAX_BYTES) return json({ error: 'That photo is too large. Please try a smaller one.' }, 413);
  const bytes = new Uint8Array(await photo.arrayBuffer());
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return json({ error: 'Please upload a JPEG, PNG or HEIC photo.' }, 415);

  try {
    await saveMoment({ names, caption, email, photo: bytes });
    return json({ ok: true });
  } catch (err) {
    console.error('moment upload failed', err);
    return json({ error: 'We could not save your photo just now. Please try again.' }, 502);
  }
};
