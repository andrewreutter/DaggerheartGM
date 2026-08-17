import React from 'react';
import { LegalPageShell } from './LegalPageShell.jsx';

const COOKIES_MARKDOWN = `
## Our Approach

Daggertop does **not** use analytics, advertising, or third-party tracking cookies today. We keep this page short and honest because there isn't much to disclose.

## What We Do Use

To keep you signed in, we rely on **Firebase Authentication**, which primarily stores your session in your browser's local storage / IndexedDB rather than a traditional tracking cookie. This is strictly essential to the app functioning — without it, you'd need to sign in on every visit.

## Stripe Checkout

When you purchase a Campaign Pass, you're briefly redirected to a Stripe-hosted checkout page on stripe.com to complete payment. That page may set its own cookies, which are governed entirely by [Stripe's own cookie and privacy policy](https://stripe.com/cookies-policy/legal) — outside of Daggertop's control. We never see or store your payment details ourselves.

## If This Ever Changes

If we ever introduce analytics, advertising, or other non-essential cookies, we'll update this policy first — and where required by law (for example, under the UK/EU GDPR and PECR), we'll ask for your consent before any such cookie is set.

## Contact

Questions about this Cookie Policy? Email **support@daggertop.com**.
`.trim();

export function CookiesPage({ navigate }) {
  return <LegalPageShell title="Cookie Policy" markdown={COOKIES_MARKDOWN} navigate={navigate} />;
}
