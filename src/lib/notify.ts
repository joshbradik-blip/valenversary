import { env } from './env';

/**
 * Emails the store owner when a customer uploads a Moment, via Resend (https://resend.com).
 * Without RESEND_API_KEY this is a no-op. With the default sender (onboarding@resend.dev),
 * Resend only delivers to the email address that owns the Resend account; verify a domain
 * and set MOMENTS_FROM_EMAIL to send from your own address.
 */

interface NewMoment {
  id: string;
  names: string;
  caption: string;
  email: string;
  photo: Uint8Array;
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export async function notifyNewMoment(m: NewMoment): Promise<void> {
  const apiKey = env('RESEND_API_KEY');
  if (!apiKey) return;

  const to = env('MOMENTS_NOTIFY_EMAIL') || 'josh@bradikenterprises.com';
  const from = env('MOMENTS_FROM_EMAIL') || 'Valenversary <onboarding@resend.dev>';
  const approveUrl = `https://console.firebase.google.com/project/${env('FIREBASE_PROJECT_ID')}/firestore/databases/-default-/data/~2Fmoments~2F${m.id}`;

  const rows = [
    ['Names', m.names],
    ['Caption', m.caption || '—'],
    ['Email', m.email || '—'],
  ]
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#4d2730">${k}</td><td style="padding:4px 0"><strong>${escape(v)}</strong></td></tr>`)
    .join('');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      // Lets you reply straight to the customer when they left an email.
      ...(m.email ? { reply_to: m.email } : {}),
      subject: `New Moment from ${m.names}`,
      html: `<div style="font-family:Arial,sans-serif;color:#2a1118">
        <h2 style="color:#9c0f47;margin:0 0 12px">New Moment waiting for approval</h2>
        <table>${rows}</table>
        <p>The photo is attached. To show it on ourvalenversary.com, open the record and set <strong>approved</strong> to <strong>true</strong>:</p>
        <p><a href="${approveUrl}" style="display:inline-block;background:#ee4c7c;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Review in Firebase</a></p>
      </div>`,
      attachments: [{ filename: `moment-${m.id}.jpg`, content: Buffer.from(m.photo).toString('base64') }],
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text().catch(() => '')}`);
}
