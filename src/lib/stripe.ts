import Stripe from 'stripe';
import { requireEnv } from './env';

let client: Stripe | undefined;
export const stripe = () => (client ??= new Stripe(requireEnv('STRIPE_SECRET_KEY')));
