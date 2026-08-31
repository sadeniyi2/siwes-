import "server-only";

// Outbound email via Resend's HTTP API (no SDK/dependency — just fetch). Set
// RESEND_API_KEY and MAIL_FROM to enable. If unset, sendMail() returns false and
// the caller falls back to the founder-managed reset. Get a free key and verify
// a sender domain at https://resend.com (or use onboarding@resend.dev to test).

const RESEND_KEY = process.env.RESEND_API_KEY || "";
const MAIL_FROM = process.env.MAIL_FROM || "SIWES Assistant <onboarding@resend.dev>";

export function mailerConfigured(): boolean {
  return !!RESEND_KEY;
}

/** Send one email. Returns true on success, false on any failure (best-effort). */
export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  if (!RESEND_KEY || !opts.to) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        ...(opts.text ? { text: opts.text } : {}),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Branded HTML shell shared by every email we send. */
function emailShell(title: string, inner: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f1ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2b2b28;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fffdf8;border:1px solid #e7e2d6;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:24px 28px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:40px;height:40px;background:#c2703d;border-radius:11px;color:#fff;font-weight:700;font-size:20px;text-align:center;line-height:40px;">S</td>
            <td style="padding-left:12px;font-weight:600;font-size:15px;color:#2b2b28;">SIWES Logbook Assistant</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:8px 28px 28px;">
          ${inner}
        </td></tr>
      </table>
      <p style="max-width:480px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#8a857a;text-align:center;">
        You're receiving this because a password reset was requested for your SIWES
        Logbook account. If it wasn't you, you can safely ignore this email — your
        password stays unchanged.
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Password-reset email with a one-tap button and a fallback link. */
export async function sendResetEmail(
  to: string,
  name: string,
  link: string,
): Promise<boolean> {
  const hi = name?.trim() ? `Hi ${name.trim().split(/\s+/)[0]},` : "Hi there,";
  const inner = `
    <h1 style="margin:8px 0 12px;font-size:22px;line-height:1.25;color:#2b2b28;">Reset your password</h1>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#4b4842;">${hi}</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4b4842;">
      Tap the button below to choose a new password. This link works once and
      expires in <strong>1 hour</strong>.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;"><tr>
      <td style="background:#c2703d;border-radius:12px;">
        <a href="${link}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">Set a new password</a>
      </td>
    </tr></table>
    <p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#8a857a;">
      Or paste this link into your browser:
    </p>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.6;word-break:break-all;">
      <a href="${link}" style="color:#c2703d;">${link}</a>
    </p>`;
  return sendMail({
    to,
    subject: "Reset your SIWES Logbook password",
    html: emailShell("Reset your password", inner),
    text: `${hi}\n\nUse this link to set a new password (valid for 1 hour):\n${link}\n\nIf you didn't request this, you can ignore this email.`,
  });
}
