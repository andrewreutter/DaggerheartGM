/**
 * Send table invitation emails via Resend API (optional — skips when not configured).
 */

let warnedMissingConfig = false;

function getPublicBaseUrl() {
  const u = (process.env.APP_PUBLIC_URL || process.env.PUBLIC_APP_URL || '').trim();
  return u.replace(/\/$/, '');
}

/**
 * @param {object} opts
 * @param {string} opts.toEmail
 * @param {string} opts.tableName
 * @param {string} opts.gmDisplayName
 * @param {string} opts.tableId
 */
export async function sendTableInviteEmail({ toEmail, tableName, gmDisplayName, tableId }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_FROM_EMAIL;
  const base = getPublicBaseUrl();
  if (!key || !from || !base) {
    if (!warnedMissingConfig) {
      warnedMissingConfig = true;
      console.warn(
        '[invite-email] RESEND_API_KEY, INVITE_FROM_EMAIL, or APP_PUBLIC_URL unset — skipping invitation emails',
      );
    }
    return { skipped: true };
  }
  const link = `${base}/table/${encodeURIComponent(tableId)}`;
  const subject = `${gmDisplayName || 'A GM'} invited you to "${tableName || 'a table'}" on Daggertop`;
  const text = [
    `You've been invited to join a game table.`,
    ``,
    `Table: ${tableName || 'Untitled'}`,
    `GM: ${gmDisplayName || '(unknown)'}`,
    ``,
    `Open: ${link}`,
    ``,
    `If you do not have an account yet, sign up with this email address to accept the invitation.`,
  ].join('\n');
  const html = `<p>You've been invited to join a game table.</p>
<p><strong>Table:</strong> ${escapeHtml(tableName || 'Untitled')}<br/>
<strong>GM:</strong> ${escapeHtml(gmDisplayName || '(unknown)')}</p>
<p><a href="${escapeHtml(link)}">Open table</a></p>
<p style="color:#666;font-size:12px">If you do not have an account yet, sign up with this email address to accept the invitation.</p>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [toEmail],
      subject,
      text,
      html,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${errText.slice(0, 200)}`);
  }
  return { ok: true };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
