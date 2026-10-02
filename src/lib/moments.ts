import { randomUUID } from 'node:crypto';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { env } from './env';

/**
 * Customer "Moments" photos. Files live in Firebase Storage under moments/, one Firestore
 * doc per upload in the `moments` collection. Uploads start with approved=false; flip it to
 * true in the Firebase console to show the photo in the home page gallery.
 */

export interface MomentInput {
  names: string;
  caption: string;
  email: string;
  photo: Uint8Array;
}

export interface PublicMoment {
  id: string;
  names: string;
  caption: string;
}

const COLLECTION = 'moments';

export function momentsEnabled(): boolean {
  return !!(env('FIREBASE_PROJECT_ID') && env('FIREBASE_CLIENT_EMAIL') && env('FIREBASE_PRIVATE_KEY'));
}

function app(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const projectId = env('FIREBASE_PROJECT_ID')!;
  return initializeApp({
    credential: cert({
      projectId,
      clientEmail: env('FIREBASE_CLIENT_EMAIL'),
      // Netlify stores the key with literal "\n" sequences when pasted on one line.
      privateKey: env('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
    }),
    storageBucket: env('FIREBASE_STORAGE_BUCKET') || `${projectId}.firebasestorage.app`,
  });
}

const bucket = () => getStorage(app()).bucket();
const db = () => getFirestore(app());

export async function saveMoment(input: MomentInput): Promise<string> {
  const id = randomUUID();
  const path = `${COLLECTION}/${id}.jpg`;
  await bucket().file(path).save(Buffer.from(input.photo), {
    contentType: 'image/jpeg',
    resumable: false,
    metadata: { cacheControl: 'private, max-age=0' },
  });
  await db().collection(COLLECTION).doc(id).set({
    names: input.names,
    caption: input.caption,
    email: input.email,
    consent: true,
    approved: false,
    path,
    createdAt: FieldValue.serverTimestamp(),
  });
  return id;
}

/** Approved moments, newest first. Email is never included. */
export async function listApprovedMoments(limit = 8): Promise<PublicMoment[]> {
  // Equality-only query so no composite index is needed; sort in memory.
  const snap = await db().collection(COLLECTION).where('approved', '==', true).limit(100).get();
  return snap.docs
    .map((d) => ({ id: d.id, data: d.data() }))
    .sort((a, b) => (b.data.createdAt?.toMillis?.() ?? 0) - (a.data.createdAt?.toMillis?.() ?? 0))
    .slice(0, limit)
    .map(({ id, data }) => ({ id, names: String(data.names ?? ''), caption: String(data.caption ?? '') }));
}

/** Photo bytes for an approved moment, or null if it is missing or not approved. */
export async function readApprovedPhoto(id: string): Promise<Buffer | null> {
  const doc = await db().collection(COLLECTION).doc(id).get();
  if (!doc.exists || doc.get('approved') !== true) return null;
  const [bytes] = await bucket().file(String(doc.get('path'))).download();
  return bytes;
}
