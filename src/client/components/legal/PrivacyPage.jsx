import React from 'react';
import { LegalPageShell } from './LegalPageShell.jsx';

const PRIVACY_MARKDOWN = `
## What We Collect

- **Account information.** When you sign in with Google via Firebase Authentication, we collect your email address and optionally a display name.
- **Game data you create.** Characters, tables, maps, dice-roll history, notes, and any images you upload are stored in a Postgres database (hosted by Supabase); uploaded images are stored in Supabase Storage.
- **Payment information.** Payments are handled entirely by **Stripe**. Daggertop never receives or stores your full card number — Stripe may collect billing details directly from you, governed by [Stripe's own privacy policy](https://stripe.com/privacy).
- **Optional AI feature inputs.** If you choose to use AI image generation (via x.ai/Grok) or a "Build with AI" character/adversary/environment concept builder (via OpenAI), the relevant prompt text and/or images are sent to that provider to generate a result. These features are entirely opt-in — nothing is sent unless you use them.

## How We Use It

We use the information above to operate the app: authenticate you, persist your game data across sessions, process payments for the Campaign Pass, and (only when you opt in) generate AI content on your behalf.

If you mark a table **public**, that table (its battle map, character names and tokens, dice, and notes invited players can already see) is listed on the home lobby and can be watched by anyone with the URL — including people who are not signed in. Assignment emails are not shown to spectators.

## What We Don't Do

- We don't run advertising.
- We don't use analytics or tracking pixels.
- We don't sell your data to third parties.

## Third-Party Services

Daggertop relies on a small set of infrastructure providers to operate:

| Service | Purpose |
|---|---|
| Firebase (Google) | Account sign-in |
| Supabase | Postgres database + file storage |
| Stripe | Payment processing (Campaign Pass) |
| x.ai (Grok) | Optional AI image generation |
| OpenAI | Optional "Build with AI" concept builders |
| Railway | Application hosting |

Each of these providers has its own privacy policy governing data it processes on our behalf.

## Data Retention and Your Rights

You can request access to, or deletion of, your data at any time by emailing **support@daggertop.com**. When a table's trial or Campaign Pass lapses, the table becomes read-only — we don't delete your data as a result of non-payment.

## Children's Privacy

Daggertop is not directed at children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us with personal information, contact us at support@daggertop.com and we will delete it.

## Changes to This Policy

If our data practices change — for example, if we ever add analytics — we'll update this page and, where required by law, ask for your consent first.

## Contact

Questions about this Privacy Policy or your data? Email **support@daggertop.com**.
`.trim();

export function PrivacyPage({ navigate }) {
  return <LegalPageShell title="Privacy Policy" markdown={PRIVACY_MARKDOWN} navigate={navigate} />;
}
