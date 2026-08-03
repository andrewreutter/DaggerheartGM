/**
 * Stripe client — optional external provider, same pattern as src/xai-image.js.
 * All Stripe-dependent code must guard with isStripeConfigured() and return 503 when false.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY       — Stripe secret key (sk_test_... or sk_live_...)
 *   STRIPE_WEBHOOK_SECRET   — Webhook signing secret from Stripe Dashboard
 *
 * Optional env vars:
 *   STRIPE_PRICE_CAMPAIGN_PASS_3MO   — Stripe Price ID for 3-month Campaign Pass ($20)
 *   STRIPE_PRICE_CAMPAIGN_PASS_6MO   — Stripe Price ID for 6-month Campaign Pass ($35)
 *   STRIPE_PRICE_CAMPAIGN_PASS_12MO  — Stripe Price ID for 12-month Campaign Pass ($60)
 *   APP_BASE_URL                     — Base URL for Stripe redirect URLs (default: https://daggerheart-gm.fly.dev)
 */

import Stripe from 'stripe';

/** Returns true when Stripe is configured. Use to guard all Stripe-dependent routes (return 503 when false). */
export function isStripeConfigured() {
  return !!process.env.STRIPE_SECRET_KEY;
}

/** Returns a Stripe client. Throws if STRIPE_SECRET_KEY is not set. */
export function getStripe() {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured (STRIPE_SECRET_KEY missing)');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
  });
}

/** Dollars to cents for Campaign Pass tiers. */
export const CAMPAIGN_PASS_PRICE_CENTS = Object.freeze({
  3:  2000,
  6:  3500,
  12: 6000,
});

/** Returns the Stripe Price ID for a given pass length (months). Returns null when env var not set. */
export function getCampaignPassPriceId(months) {
  const envKey = `STRIPE_PRICE_CAMPAIGN_PASS_${months}MO`;
  return process.env[envKey] || null;
}

/**
 * Verify and parse a Stripe webhook event from raw bytes + signature header.
 * Returns the parsed Event or throws on invalid signature.
 * @param {Buffer} rawBody
 * @param {string} signature
 * @returns {import('stripe').Stripe.Event}
 */
export function constructWebhookEvent(rawBody, signature) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}
