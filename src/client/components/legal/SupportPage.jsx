import React from 'react';
import { LegalPageShell } from './LegalPageShell.jsx';

const SUPPORT_MARKDOWN = `
## Get in Touch

The best way to reach us is our **[Discord server](https://discord.gg/qjabRtAr7p)** — join in, say hello, and post in the relevant channel. It's the fastest way to get an answer, since both the team and other GMs and players are active there day-to-day.

Come to Discord for:

- Bug reports or anything that seems broken
- Feature requests or general feedback
- Questions about how to use Daggertop
- Sharing homebrew content, swapping GM tips, and hearing about new features first

If you'd rather not use Discord, or need something handled privately — account or billing details — email **support@daggertop.com** instead. We read every message and typically reply within a couple of business days.

## Billing and Campaign Pass Questions

A Campaign Pass is a one-time purchase that extends a table's access, not a subscription — so there's nothing to "cancel," but if something looks wrong (wrong table, duplicate charge, or you'd like a refund), email **support@daggertop.com** with the table name and, if you have it, your Stripe receipt or checkout confirmation. We review every billing request and do our best to make it right.

## Account and Data Requests

To request access to, or deletion of, your account data, email **support@daggertop.com** rather than posting in Discord, since these requests involve account-specific details.

## Reporting a Problem During a Session

If you're signed in and something goes wrong mid-session, look for the **Report a problem** button in the Characters panel of the Game Table. It captures useful context automatically (recent action log, table state, and your route) so you don't have to type up a full reproduction — just hit it and, optionally, add a note about what happened.

## Response Times

Daggertop is built and maintained by a small team. Discord is usually the quickest way to get a response since it's actively monitored; email replies can take a few business days, sooner for billing issues.
`.trim();

export function SupportPage({ navigate }) {
  return <LegalPageShell title="Support" markdown={SUPPORT_MARKDOWN} navigate={navigate} />;
}
