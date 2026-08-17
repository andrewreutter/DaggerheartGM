import React from 'react';
import { LegalPageShell } from './LegalPageShell.jsx';

const TERMS_MARKDOWN = `
## 1. Acceptance of Terms

By creating an account or using Daggertop ("we," "us," or "our"), you agree to these Terms of Service. If you don't agree, please don't use the app.

## 2. What Daggertop Is

Daggertop is a game-master tool and virtual tabletop for running the *Daggerheart* tabletop RPG — character building, battle maps, dice rolling, and encounter management. It's provided for tabletop gaming purposes and is not affiliated with or endorsed by Darrington Press.

## 3. Accounts

You sign in with a Google account via Firebase Authentication. You're responsible for keeping your account credentials secure and for all activity that happens under your account. Let us know at support@daggertop.com if you believe your account has been compromised.

## 4. Free Trial and Campaign Pass

- Every account gets **one owned table** with a **one-month free trial**. The trial clock starts the first time that table has a real session with another player present — solo prep time doesn't burn it.
- Character creation and placement on any table are **free and uncapped, forever**.
- The **Campaign Pass** is a one-time, non-subscription purchase (3 months/$20, 6 months/$35, or 12 months/$60) that extends a specific table's paid-through date. It is **not** a recurring subscription — there is no auto-renewal, and renewing is always a conscious repeat purchase. Anyone — the table's GM or any invited player — may purchase or gift a Campaign Pass for a table.
- If a table's trial or pass lapses, that table becomes **read-only**. We never delete your data, and this is only ever checked at the start of a session — it will never interrupt one already in progress.
- Daggertop may offer additional paid features or passes in the future; any such offering will be described clearly before purchase.

## 5. Payments, Refunds, and Disputes

All payments are processed by **Stripe**; we never receive or store your full card number. Because a Campaign Pass grants immediate, permanent access to a table for its purchased duration, refunds and chargebacks are handled as a logged event that does not automatically claw back access already granted. If you have a billing question or dispute about a purchase, email **support@daggertop.com** and we'll review it on a case-by-case basis.

## 6. Your Content

You can upload your own images (character portraits, custom battle maps, notes) and create your own game content (characters, adversaries, scenes, and more), some of which you may choose to make public or shared with other users.

- **You own what you create.** You retain ownership of any content you upload or create.
- **You grant us a license to host it.** By uploading content, you grant Daggertop a limited license to host, store, and display that content solely to provide the service to you and anyone you share it with.
- **You're responsible for what you upload.** You represent that you have the necessary rights to any content you upload, and Daggertop is not liable for content submitted by users.
- **Copyright concerns.** If you believe content on Daggertop infringes your copyright, email **support@daggertop.com** with details and we will investigate and remove infringing content as appropriate.

## 7. Acceptable Use and Termination

Don't use Daggertop to violate these Terms, abuse other users, or commit fraud. We may suspend or terminate accounts for violations of these Terms, abuse, or fraudulent activity.

## 8. Disclaimer and Limitation of Liability

Daggertop is provided "as is," without warranties of any kind. To the maximum extent permitted by law, Daggertop is not liable for any indirect, incidental, or consequential damages arising from your use of the app.

## 9. Governing Law

These Terms are governed by the laws of the jurisdiction in which Daggertop operates, without regard to conflict-of-laws rules.

## 10. Changes to These Terms

We may update these Terms from time to time. We'll update the "Last updated" date above when we do; continued use of Daggertop after a change means you accept the updated Terms.

## 11. Contact

Questions about these Terms? Email **support@daggertop.com** or join our [Discord](https://discord.gg/qjabRtAr7p).
`.trim();

export function TermsPage({ navigate }) {
  return <LegalPageShell title="Terms of Service" markdown={TERMS_MARKDOWN} navigate={navigate} />;
}
