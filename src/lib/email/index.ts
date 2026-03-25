import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// IMPORTANT: Without a verified domain, Resend only sends to your own email.
// Verify your domain at resend.com/domains, then set FROM_EMAIL env var.
const FROM_EMAIL = process.env.FROM_EMAIL || 'Loona <noreply@send.loona.ph>'

export type SendEmailParams = {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams) {
  if (!process.env.RESEND_API_KEY) {
    return { success: true, skipped: true }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
    })

    if (error) {
      console.error('[Email] Send failed')
      return { success: false, error }
    }

    return { success: true, id: data?.id }
  } catch (err) {
    console.error('[Email] Send error')
    return { success: false, error: err }
  }
}

// ============================================
// Email Templates
// ============================================

export function welcomeEmail(name: string) {
  const subject = 'Welcome to Loona'
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="color: #1a8cff; margin: 0; font-size: 28px;">Loona</h1>
    <p style="color: #666; margin: 8px 0 0 0;">Loan Management Made Simple</p>
  </div>

  <h2 style="color: #1a1a1a; margin-bottom: 16px;">Welcome, ${name}!</h2>

  <p>Thank you for signing up for Loona. We're excited to help you manage your lending activities more efficiently.</p>

  <p>With Loona, you can:</p>
  <ul style="color: #444;">
    <li>Track all your loans in one place</li>
    <li>Monitor payments and due dates</li>
    <li>Manage borrower contacts</li>
    <li>Generate reports and insights</li>
  </ul>

  <div style="text-align: center; margin: 32px 0;">
    <a href="${process.env.BETTER_AUTH_URL || 'https://loona-lld4.onrender.com'}/login" style="background-color: #1a8cff; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">Get Started</a>
  </div>

  <p style="color: #666; font-size: 14px;">If you have any questions, feel free to reach out to our support team.</p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

  <p style="color: #999; font-size: 12px; text-align: center;">
    This email was sent by Loona. If you didn't create an account, you can safely ignore this email.
  </p>
</body>
</html>
  `

  const text = `
Welcome to Loona, ${name}!

Thank you for signing up. We're excited to help you manage your lending activities more efficiently.

With Loona, you can:
- Track all your loans in one place
- Monitor payments and due dates
- Manage borrower contacts
- Generate reports and insights

Get started: ${process.env.BETTER_AUTH_URL || 'https://loona-lld4.onrender.com'}/login

If you have any questions, feel free to reach out to our support team.
  `

  return { subject, html, text }
}

export function agentInviteEmail(params: {
  agentName: string
  lenderName: string
  email: string
  password: string
}) {
  const { agentName, lenderName, email, password } = params
  const subject = `You've been invited to Loona by ${lenderName}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="color: #1a8cff; margin: 0; font-size: 28px;">Loona</h1>
    <p style="color: #666; margin: 8px 0 0 0;">Loan Management Made Simple</p>
  </div>

  <h2 style="color: #1a1a1a; margin-bottom: 16px;">Hello ${agentName},</h2>

  <p><strong>${lenderName}</strong> has invited you to join Loona as a collection agent.</p>

  <p>As an agent, you'll be able to:</p>
  <ul style="color: #444;">
    <li>View assigned loans and borrowers</li>
    <li>Record payment collections</li>
    <li>Track your commissions</li>
  </ul>

  <div style="background-color: #f5f5f5; border-radius: 8px; padding: 20px; margin: 24px 0;">
    <p style="margin: 0 0 12px 0; font-weight: 600;">Your login credentials:</p>
    <p style="margin: 0; color: #444;">
      <strong>Email:</strong> ${email}<br>
      <strong>Temporary Password:</strong> <code style="background: #e0e0e0; padding: 2px 6px; border-radius: 4px;">${password}</code>
    </p>
    <p style="margin: 12px 0 0 0; font-size: 14px; color: #666;">
      Please change your password after your first login.
    </p>
  </div>

  <div style="text-align: center; margin: 32px 0;">
    <a href="${process.env.BETTER_AUTH_URL || 'https://loona-lld4.onrender.com'}/login" style="background-color: #1a8cff; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">Login to Loona</a>
  </div>

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

  <p style="color: #999; font-size: 12px; text-align: center;">
    This email was sent by Loona on behalf of ${lenderName}. If you weren't expecting this invitation, you can safely ignore this email.
  </p>
</body>
</html>
  `

  const text = `
Hello ${agentName},

${lenderName} has invited you to join Loona as a collection agent.

As an agent, you'll be able to:
- View assigned loans and borrowers
- Record payment collections
- Track your commissions

Your login credentials:
Email: ${email}
Temporary Password: ${password}

Please change your password after your first login.

Login here: ${process.env.BETTER_AUTH_URL || 'https://loona-lld4.onrender.com'}/login

This email was sent by Loona on behalf of ${lenderName}.
  `

  return { subject, html, text }
}

export function passwordResetEmail(params: {
  name: string
  resetUrl: string
}) {
  const { name, resetUrl } = params
  const subject = 'Reset your Loona password'

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="color: #1a8cff; margin: 0; font-size: 28px;">Loona</h1>
    <p style="color: #666; margin: 8px 0 0 0;">Loan Management Made Simple</p>
  </div>

  <h2 style="color: #1a1a1a; margin-bottom: 16px;">Password Reset Request</h2>

  <p>Hi ${name},</p>

  <p>We received a request to reset your password. Click the button below to create a new password:</p>

  <div style="text-align: center; margin: 32px 0;">
    <a href="${resetUrl}" style="background-color: #1a8cff; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">Reset Password</a>
  </div>

  <p style="color: #666; font-size: 14px;">This link will expire in 1 hour for security reasons.</p>

  <p style="color: #666; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

  <p style="color: #999; font-size: 12px; text-align: center;">
    If the button doesn't work, copy and paste this link into your browser:<br>
    <a href="${resetUrl}" style="color: #1a8cff; word-break: break-all;">${resetUrl}</a>
  </p>
</body>
</html>
  `

  const text = `
Password Reset Request

Hi ${name},

We received a request to reset your password. Visit the link below to create a new password:

${resetUrl}

This link will expire in 1 hour for security reasons.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
  `

  return { subject, html, text }
}

export function agentActivityDigestEmail(params: {
  lenderName: string
  date: string
  agents: Array<{
    name: string
    paymentCount: number
    totalAmount: string
  }>
  grandTotal: string
  dashboardUrl: string
}) {
  const { lenderName, date, agents, grandTotal, dashboardUrl } = params
  const subject = `Agent Activity — ${date}`

  const agentRows = agents
    .map(
      (a) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #eee;">${a.name}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #eee; text-align: center;">${a.paymentCount}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #eee; text-align: right;">${a.totalAmount}</td>
      </tr>`,
    )
    .join('')

  const agentTextRows = agents.map((a) => `  ${a.name}: ${a.paymentCount} payment(s), ${a.totalAmount}`).join('\n')

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="color: #1a8cff; margin: 0; font-size: 28px;">Loona</h1>
    <p style="color: #666; margin: 8px 0 0 0;">Agent Activity Digest</p>
  </div>

  <h2 style="color: #1a1a1a; margin-bottom: 16px;">Agent Activity — ${date}</h2>

  <p>Hi ${lenderName},</p>

  <p>Here's a summary of payments recorded by your agents today.</p>

  <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
    <thead>
      <tr style="background-color: #f5f5f5;">
        <th style="padding: 10px 12px; text-align: left; font-weight: 600;">Agent</th>
        <th style="padding: 10px 12px; text-align: center; font-weight: 600;">Payments</th>
        <th style="padding: 10px 12px; text-align: right; font-weight: 600;">Amount Collected</th>
      </tr>
    </thead>
    <tbody>
      ${agentRows}
      <tr style="background-color: #f5f5f5; font-weight: 600;">
        <td style="padding: 10px 12px;" colspan="2">Total</td>
        <td style="padding: 10px 12px; text-align: right;">${grandTotal}</td>
      </tr>
    </tbody>
  </table>

  <div style="text-align: center; margin: 32px 0;">
    <a href="${dashboardUrl}" style="background-color: #1a8cff; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">Review in Dashboard</a>
  </div>

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

  <p style="color: #999; font-size: 12px; text-align: center;">
    This daily digest was sent by Loona. You're receiving this because agents recorded payments on your behalf.
  </p>
</body>
</html>
  `

  const text = `
Agent Activity — ${date}

Hi ${lenderName},

Here's a summary of payments recorded by your agents today.

${agentTextRows}

Total: ${grandTotal}

Review in dashboard: ${dashboardUrl}

This daily digest was sent by Loona.
  `

  return { subject, html, text }
}

export function waitlistApprovedEmail(params: { email: string }) {
  const loginUrl = `${process.env.BETTER_AUTH_URL || 'https://loona-lld4.onrender.com'}/login`
  const subject = "You're in! Your Loona account is ready"

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="color: #1a8cff; margin: 0; font-size: 28px;">Loona</h1>
    <p style="color: #666; margin: 8px 0 0 0;">Loan Management Made Simple</p>
  </div>

  <h2 style="color: #1a1a1a; margin-bottom: 16px;">You're in!</h2>

  <p>Great news — you've been approved for early access to Loona.</p>

  <p>You can now sign in with Google and start managing your lending activities.</p>

  <div style="text-align: center; margin: 32px 0;">
    <a href="${loginUrl}" style="background-color: #1a8cff; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">Sign in to Loona</a>
  </div>

  <p style="color: #666; font-size: 14px;">If you have any questions, feel free to reach out to our support team.</p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

  <p style="color: #999; font-size: 12px; text-align: center;">
    This email was sent by Loona. You're receiving this because you signed up for the waitlist with ${params.email}.
  </p>
</body>
</html>
  `

  const text = `
You're in!

Great news — you've been approved for early access to Loona.

You can now sign in with Google and start managing your lending activities.

Sign in here: ${loginUrl}

If you have any questions, feel free to reach out to our support team.
  `

  return { subject, html, text }
}

export function loanAssignedEmail(params: {
  agentName: string
  lenderName: string
  borrowerName: string
  principal: string
  loanUrl: string
}) {
  const { agentName, lenderName, borrowerName, principal, loanUrl } = params
  const subject = `New loan assigned — ${borrowerName}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="color: #1a8cff; margin: 0; font-size: 28px;">Loona</h1>
    <p style="color: #666; margin: 8px 0 0 0;">Loan Management Made Simple</p>
  </div>

  <h2 style="color: #1a1a1a; margin-bottom: 16px;">New Loan Assigned</h2>

  <p>Hi ${agentName},</p>

  <p><strong>${lenderName}</strong> has assigned a new loan to you.</p>

  <div style="background-color: #f5f5f5; border-radius: 8px; padding: 20px; margin: 24px 0;">
    <p style="margin: 0; color: #444;">
      <strong>Borrower:</strong> ${borrowerName}<br>
      <strong>Principal:</strong> ${principal}
    </p>
  </div>

  <div style="text-align: center; margin: 32px 0;">
    <a href="${loanUrl}" style="background-color: #1a8cff; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">View Loan</a>
  </div>

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

  <p style="color: #999; font-size: 12px; text-align: center;">
    This email was sent by Loona on behalf of ${lenderName}.
  </p>
</body>
</html>
  `

  const text = `
Hi ${agentName},

${lenderName} has assigned a new loan to you.

Borrower: ${borrowerName}
Principal: ${principal}

View loan: ${loanUrl}

This email was sent by Loona on behalf of ${lenderName}.
  `

  return { subject, html, text }
}

export function paymentReminderEmail(params: {
  borrowerName: string
  lenderName: string
  amount: string
  dueDate: string
}) {
  const { borrowerName, lenderName, amount, dueDate } = params
  const subject = `Payment Reminder: ${amount} due ${dueDate}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="color: #1a8cff; margin: 0; font-size: 28px;">Loona</h1>
  </div>

  <h2 style="color: #1a1a1a; margin-bottom: 16px;">Payment Reminder</h2>

  <p>Hi ${borrowerName},</p>

  <p>This is a friendly reminder that you have a payment due.</p>

  <div style="background-color: #f5f5f5; border-radius: 8px; padding: 20px; margin: 24px 0;">
    <p style="margin: 0; color: #444;">
      <strong>Amount Due:</strong> ${amount}<br>
      <strong>Due Date:</strong> ${dueDate}<br>
      <strong>Lender:</strong> ${lenderName}
    </p>
  </div>

  <p>Please ensure your payment is made on time to avoid any late fees.</p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

  <p style="color: #999; font-size: 12px; text-align: center;">
    This email was sent via Loona on behalf of ${lenderName}.
  </p>
</body>
</html>
  `

  const text = `
Payment Reminder

Hi ${borrowerName},

This is a friendly reminder that you have a payment due.

Amount Due: ${amount}
Due Date: ${dueDate}
Lender: ${lenderName}

Please ensure your payment is made on time to avoid any late fees.

This email was sent via Loona on behalf of ${lenderName}.
  `

  return { subject, html, text }
}

export function signingOtpEmail(params: {
  signerName: string
  documentType: "disclosure" | "promissory_note"
  otpCode: string
  expiresInMinutes: number
}) {
  const { signerName, documentType, otpCode, expiresInMinutes } = params
  const docLabel = documentType === "disclosure" ? "Disclosure Statement" : "Promissory Note"
  const subject = `Your signing code: ${otpCode}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="color: #1a8cff; margin: 0; font-size: 28px;">Loona</h1>
  </div>

  <h2 style="color: #1a1a1a; margin-bottom: 8px;">Document Signing Code</h2>
  <p>Hi ${signerName},</p>
  <p>Use the code below to sign the <strong>${docLabel}</strong>.</p>

  <div style="background-color: #f0f7ff; border: 2px solid #1a8cff; border-radius: 12px; padding: 32px; margin: 24px 0; text-align: center;">
    <p style="margin: 0 0 8px; color: #555; font-size: 14px;">Your verification code</p>
    <p style="margin: 0; font-size: 48px; font-weight: 700; letter-spacing: 12px; color: #1a1a1a; font-family: monospace;">${otpCode}</p>
    <p style="margin: 12px 0 0; color: #888; font-size: 13px;">Expires in ${expiresInMinutes} minutes</p>
  </div>

  <p style="color: #cc0000; font-size: 14px;">
    <strong>Do not share this code.</strong> Entering this code confirms your consent to sign the ${docLabel}.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

  <p style="color: #999; font-size: 12px; text-align: center;">
    If you did not request this code, you can ignore this email. This email was sent via Loona.
  </p>
</body>
</html>
  `

  const text = `
Document Signing Code

Hi ${signerName},

Use the code below to sign the ${docLabel}.

Your verification code: ${otpCode}

This code expires in ${expiresInMinutes} minutes.

Do not share this code. Entering it confirms your consent to sign the ${docLabel}.

If you did not request this code, ignore this email.
  `

  return { subject, html, text }
}

export function signingRequestEmail(params: {
  signerName: string
  lenderName: string
  documentType: "disclosure" | "promissory_note"
  otpCode: string
  signingUrl: string
}) {
  const { signerName, lenderName, documentType, otpCode, signingUrl } = params
  const docLabel = documentType === "disclosure" ? "Disclosure Statement" : "Promissory Note"
  const subject = `Please sign your ${docLabel} — ${lenderName}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="color: #1a8cff; margin: 0; font-size: 28px;">Loona</h1>
  </div>

  <h2 style="color: #1a1a1a; margin-bottom: 8px;">Document Ready to Sign</h2>
  <p>Hi ${signerName},</p>
  <p><strong>${lenderName}</strong> has sent you a <strong>${docLabel}</strong> for your review and signature.</p>

  <div style="text-align: center; margin: 32px 0;">
    <a href="${signingUrl}" style="display: inline-block; background-color: #1a8cff; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
      Review &amp; Sign Document
    </a>
  </div>

  <div style="background-color: #f0f7ff; border: 2px solid #1a8cff; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
    <p style="margin: 0 0 8px; color: #555; font-size: 14px;">Your verification code</p>
    <p style="margin: 0; font-size: 42px; font-weight: 700; letter-spacing: 10px; color: #1a1a1a; font-family: monospace;">${otpCode}</p>
    <p style="margin: 10px 0 0; color: #888; font-size: 13px;">Enter this code when prompted on the signing page</p>
  </div>

  <p style="color: #cc0000; font-size: 14px;">
    <strong>Do not share this code.</strong> Entering it confirms your consent to sign the ${docLabel}.
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

  <p style="color: #999; font-size: 12px; text-align: center;">
    If you were not expecting this document, you can ignore this email. This was sent via Loona on behalf of ${lenderName}.
  </p>
</body>
</html>
  `

  const text = `
Document Ready to Sign

Hi ${signerName},

${lenderName} has sent you a ${docLabel} for your review and signature.

Sign your document here: ${signingUrl}

Your verification code: ${otpCode}

Enter this code when prompted on the signing page. Do not share this code — it confirms your consent to sign the ${docLabel}.

If you were not expecting this, you can ignore this email.
  `

  return { subject, html, text }
}

export function paymentReceiptEmail(params: {
  borrowerName: string
  lenderName: string
  amount: string
  method: string
  paidAt: string
  remainingBalance: string
  loanReference: string
}) {
  const { borrowerName, lenderName, amount, method, paidAt, remainingBalance, loanReference } = params
  const subject = `Payment Receipt — ₱${amount} received`
  const isFullyPaid = parseFloat(remainingBalance) <= 0

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="color: #1a8cff; margin: 0; font-size: 28px;">Loona</h1>
    <p style="color: #666; margin: 8px 0 0 0;">Payment Receipt</p>
  </div>

  <p>Hi ${borrowerName},</p>
  <p>Your payment has been received and recorded. Here are the details:</p>

  <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; margin: 24px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #555; font-size: 14px;">Amount Paid</td>
        <td style="padding: 8px 0; font-weight: 700; font-size: 18px; color: #16a34a; text-align: right;">₱${amount}</td>
      </tr>
      <tr style="border-top: 1px solid #e5e7eb;">
        <td style="padding: 8px 0; color: #555; font-size: 14px;">Payment Method</td>
        <td style="padding: 8px 0; font-weight: 500; text-align: right;">${method}</td>
      </tr>
      <tr style="border-top: 1px solid #e5e7eb;">
        <td style="padding: 8px 0; color: #555; font-size: 14px;">Date</td>
        <td style="padding: 8px 0; font-weight: 500; text-align: right;">${paidAt}</td>
      </tr>
      <tr style="border-top: 1px solid #e5e7eb;">
        <td style="padding: 8px 0; color: #555; font-size: 14px;">Loan Reference</td>
        <td style="padding: 8px 0; font-weight: 500; text-align: right;">${loanReference}</td>
      </tr>
      <tr style="border-top: 1px solid #e5e7eb;">
        <td style="padding: 8px 0; color: #555; font-size: 14px;">Remaining Balance</td>
        <td style="padding: 8px 0; font-weight: 700; text-align: right; color: ${isFullyPaid ? '#16a34a' : '#1a1a1a'};">${isFullyPaid ? 'FULLY PAID' : '₱' + remainingBalance}</td>
      </tr>
    </table>
  </div>

  ${isFullyPaid ? `
  <div style="background-color: #f0fdf4; border: 2px solid #16a34a; border-radius: 12px; padding: 16px; text-align: center; margin: 24px 0;">
    <p style="margin: 0; color: #15803d; font-weight: 600;">Congratulations! Your loan has been fully paid. 🎉</p>
  </div>
  ` : ''}

  <p style="color: #555; font-size: 14px;">This receipt was issued by <strong>${lenderName}</strong> via Loona.</p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
  <p style="color: #999; font-size: 12px; text-align: center;">Please keep this email for your records.</p>
</body>
</html>
  `

  const text = `
Payment Receipt

Hi ${borrowerName},

Your payment of ₱${amount} has been received.

Amount Paid: ₱${amount}
Payment Method: ${method}
Date: ${paidAt}
Loan Reference: ${loanReference}
Remaining Balance: ${isFullyPaid ? 'FULLY PAID' : '₱' + remainingBalance}

${isFullyPaid ? 'Congratulations! Your loan has been fully paid.' : ''}

Issued by ${lenderName} via Loona.
  `

  return { subject, html, text }
}

export function overdueAlertEmail(params: {
  borrowerName: string
  lenderName: string
  dueDate: string
  amountDue: string
  loanReference: string
  daysRelative: number // negative = days before, 0 = due today, positive = days overdue
}) {
  const { borrowerName, lenderName, dueDate, amountDue, loanReference, daysRelative } = params

  let subject: string
  let urgencyText: string
  let urgencyColor: string

  if (daysRelative < 0) {
    const days = Math.abs(daysRelative)
    subject = `Reminder: Payment due in ${days} day${days !== 1 ? 's' : ''} — ${loanReference}`
    urgencyText = `Your payment is due in <strong>${days} day${days !== 1 ? 's' : ''}</strong>.`
    urgencyColor = '#f59e0b'
  } else if (daysRelative === 0) {
    subject = `Payment due today — ${loanReference}`
    urgencyText = `Your payment is <strong>due today</strong>.`
    urgencyColor = '#ef4444'
  } else {
    subject = `Overdue: Payment ${daysRelative} day${daysRelative !== 1 ? 's' : ''} past due — ${loanReference}`
    urgencyText = `Your payment is <strong>${daysRelative} day${daysRelative !== 1 ? 's' : ''} overdue</strong>.`
    urgencyColor = '#dc2626'
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="color: #1a8cff; margin: 0; font-size: 28px;">Loona</h1>
  </div>

  <div style="border-left: 4px solid ${urgencyColor}; padding-left: 16px; margin-bottom: 24px;">
    <h2 style="color: ${urgencyColor}; margin: 0 0 4px;">Payment Reminder</h2>
    <p style="margin: 0; color: #555;">${urgencyText}</p>
  </div>

  <p>Hi ${borrowerName},</p>
  <p>This is a reminder about your upcoming loan payment to <strong>${lenderName}</strong>.</p>

  <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; margin: 24px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #555; font-size: 14px;">Amount Due</td>
        <td style="padding: 8px 0; font-weight: 700; font-size: 18px; text-align: right;">₱${amountDue}</td>
      </tr>
      <tr style="border-top: 1px solid #e5e7eb;">
        <td style="padding: 8px 0; color: #555; font-size: 14px;">Due Date</td>
        <td style="padding: 8px 0; font-weight: 500; text-align: right; color: ${urgencyColor};">${dueDate}</td>
      </tr>
      <tr style="border-top: 1px solid #e5e7eb;">
        <td style="padding: 8px 0; color: #555; font-size: 14px;">Loan Reference</td>
        <td style="padding: 8px 0; font-weight: 500; text-align: right;">${loanReference}</td>
      </tr>
    </table>
  </div>

  <p style="color: #555; font-size: 14px;">Please coordinate with <strong>${lenderName}</strong> to arrange your payment at your earliest convenience.</p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
  <p style="color: #999; font-size: 12px; text-align: center;">This reminder was sent via Loona on behalf of ${lenderName}.</p>
</body>
</html>
  `

  const text = `
Payment Reminder

Hi ${borrowerName},

${daysRelative < 0 ? `Your payment is due in ${Math.abs(daysRelative)} days.` : daysRelative === 0 ? 'Your payment is due today.' : `Your payment is ${daysRelative} days overdue.`}

Amount Due: ₱${amountDue}
Due Date: ${dueDate}
Loan Reference: ${loanReference}

Please coordinate with ${lenderName} to arrange your payment.

Sent via Loona on behalf of ${lenderName}.
  `

  return { subject, html, text }
}

// ============================================
// Lender Notification Templates
// ============================================

export function lenderPaymentReceivedEmail(params: {
  lenderName: string
  borrowerName: string
  amount: string
  method: string
  remainingBalance: string
  loanReference: string
  isCompleted: boolean
  isAgent: boolean
  agentName?: string
}) {
  const { lenderName, borrowerName, amount, method, remainingBalance, loanReference, isCompleted, isAgent, agentName } = params
  const subject = isCompleted
    ? `Loan ${loanReference} fully paid — ₱${amount} received`
    : `Payment received — ₱${amount} from ${borrowerName}`

  const recordedBy = isAgent && agentName ? `Recorded by agent <strong>${agentName}</strong>` : "Recorded directly"

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="color: #1a8cff; margin: 0; font-size: 28px;">Loona</h1>
  </div>

  <h2 style="color: #1a1a1a; margin-bottom: 8px;">${isCompleted ? 'Loan Fully Paid' : 'Payment Received'}</h2>
  <p>Hi ${lenderName},</p>
  <p>A payment of <strong>₱${amount}</strong> has been received from <strong>${borrowerName}</strong>.</p>

  <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; margin: 24px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 8px 0; color: #555; font-size: 14px;">Borrower</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">${borrowerName}</td></tr>
      <tr style="border-top: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #555; font-size: 14px;">Amount</td><td style="padding: 8px 0; font-weight: 700; font-size: 18px; color: #16a34a; text-align: right;">₱${amount}</td></tr>
      <tr style="border-top: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #555; font-size: 14px;">Method</td><td style="padding: 8px 0; text-align: right;">${method}</td></tr>
      <tr style="border-top: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #555; font-size: 14px;">Loan</td><td style="padding: 8px 0; text-align: right;">${loanReference}</td></tr>
      <tr style="border-top: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #555; font-size: 14px;">Remaining</td><td style="padding: 8px 0; font-weight: 600; text-align: right; color: ${isCompleted ? '#16a34a' : '#1a1a1a'};">${isCompleted ? 'FULLY PAID' : '₱' + remainingBalance}</td></tr>
    </table>
    <p style="margin: 12px 0 0; color: #888; font-size: 12px;">${recordedBy}</p>
  </div>

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
  <p style="color: #999; font-size: 12px; text-align: center;">Loona — Loan Management</p>
</body>
</html>`

  const text = `${isCompleted ? 'Loan Fully Paid' : 'Payment Received'}\n\nHi ${lenderName},\n\n₱${amount} received from ${borrowerName} (${method}).\nLoan: ${loanReference}\nRemaining: ${isCompleted ? 'FULLY PAID' : '₱' + remainingBalance}`

  return { subject, html, text }
}

export function lenderDocumentSignedEmail(params: {
  lenderName: string
  signerName: string
  signerRole: string
  documentType: string
  loanReference: string
  dashboardUrl: string
}) {
  const { lenderName, signerName, signerRole, documentType, loanReference, dashboardUrl } = params
  const docLabel = documentType === "disclosure" ? "Disclosure Statement" : "Promissory Note"
  const subject = `${signerName} signed the ${docLabel} — ${loanReference}`

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="color: #1a8cff; margin: 0; font-size: 28px;">Loona</h1>
  </div>

  <h2 style="color: #16a34a; margin-bottom: 8px;">Document Signed</h2>
  <p>Hi ${lenderName},</p>
  <p><strong>${signerName}</strong> (${signerRole}) has signed the <strong>${docLabel}</strong> for loan <strong>${loanReference}</strong>.</p>

  <div style="text-align: center; margin: 32px 0;">
    <a href="${dashboardUrl}" style="display: inline-block; background-color: #1a8cff; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600;">View Loan</a>
  </div>

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
  <p style="color: #999; font-size: 12px; text-align: center;">Loona — Loan Management</p>
</body>
</html>`

  const text = `Document Signed\n\nHi ${lenderName},\n\n${signerName} (${signerRole}) signed the ${docLabel} for loan ${loanReference}.\n\nView: ${dashboardUrl}`

  return { subject, html, text }
}

export function lenderPenaltyAppliedEmail(params: {
  lenderName: string
  borrowerName: string
  penaltyType: string
  amount: string
  loanReference: string
  daysOverdue: number
}) {
  const { lenderName, borrowerName, penaltyType, amount, loanReference, daysOverdue } = params
  const typeLabel = penaltyType === "late_fee" ? "Late Fee" : "Daily Interest"
  const subject = `${typeLabel} of ₱${amount} generated — ${borrowerName}`

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="color: #1a8cff; margin: 0; font-size: 28px;">Loona</h1>
  </div>

  <div style="border-left: 4px solid #f59e0b; padding-left: 16px; margin-bottom: 24px;">
    <h2 style="color: #92400e; margin: 0 0 4px;">Penalty Generated</h2>
  </div>

  <p>Hi ${lenderName},</p>

  <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; margin: 24px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 8px 0; color: #555; font-size: 14px;">Borrower</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">${borrowerName}</td></tr>
      <tr style="border-top: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #555; font-size: 14px;">Penalty Type</td><td style="padding: 8px 0; text-align: right;">${typeLabel}</td></tr>
      <tr style="border-top: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #555; font-size: 14px;">Amount</td><td style="padding: 8px 0; font-weight: 700; color: #dc2626; text-align: right;">₱${amount}</td></tr>
      <tr style="border-top: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #555; font-size: 14px;">Days Overdue</td><td style="padding: 8px 0; text-align: right;">${daysOverdue}</td></tr>
      <tr style="border-top: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #555; font-size: 14px;">Loan</td><td style="padding: 8px 0; text-align: right;">${loanReference}</td></tr>
    </table>
  </div>

  <p style="color: #555; font-size: 14px;">Review in your dashboard to apply, waive, or collect.</p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
  <p style="color: #999; font-size: 12px; text-align: center;">Loona — Loan Management</p>
</body>
</html>`

  const text = `Penalty Generated\n\nHi ${lenderName},\n\n${typeLabel} of ₱${amount} for ${borrowerName} (${daysOverdue} days overdue).\nLoan: ${loanReference}`

  return { subject, html, text }
}

export function lenderDailySummaryEmail(params: {
  lenderName: string
  date: string
  collectionsToday: string
  loansCompleted: number
  upcomingDueCount: number
  overdueCount: number
  totalOutstanding: string
  missedPaymentBorrowers: { name: string; consecutiveMissed: number; loanReference: string }[]
  dashboardUrl: string
}) {
  const { lenderName, date, collectionsToday, loansCompleted, upcomingDueCount, overdueCount, totalOutstanding, missedPaymentBorrowers, dashboardUrl } = params
  const subject = `Daily Summary — ${date}`

  const escalationRows = missedPaymentBorrowers.length > 0
    ? missedPaymentBorrowers.map(b =>
      `<tr style="border-top: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #555; font-size: 14px;">${b.name}</td><td style="padding: 8px 0; text-align: center; color: #dc2626; font-weight: 600;">${b.consecutiveMissed}</td><td style="padding: 8px 0; text-align: right; font-size: 13px;">${b.loanReference}</td></tr>`
    ).join('')
    : ''

  const escalationSection = missedPaymentBorrowers.length > 0
    ? `
  <div style="border-left: 4px solid #dc2626; padding-left: 16px; margin: 24px 0 8px;">
    <h3 style="color: #dc2626; margin: 0;">Missed Payment Escalation</h3>
    <p style="margin: 4px 0 0; color: #555; font-size: 13px;">${missedPaymentBorrowers.length} borrower${missedPaymentBorrowers.length !== 1 ? 's' : ''} with 2+ consecutive missed payments</p>
  </div>
  <div style="background-color: #fef2f2; border-radius: 12px; padding: 16px; margin: 8px 0 24px;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr><th style="padding: 6px 0; color: #888; font-size: 12px; text-align: left;">Borrower</th><th style="padding: 6px 0; color: #888; font-size: 12px; text-align: center;">Missed</th><th style="padding: 6px 0; color: #888; font-size: 12px; text-align: right;">Loan</th></tr>
      ${escalationRows}
    </table>
  </div>`
    : ''

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="color: #1a8cff; margin: 0; font-size: 28px;">Loona</h1>
    <p style="color: #666; margin: 8px 0 0 0;">Daily Portfolio Summary</p>
  </div>

  <p>Hi ${lenderName}, here's your portfolio for <strong>${date}</strong>.</p>

  <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; margin: 24px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 8px 0; color: #555; font-size: 14px;">Collections Today</td><td style="padding: 8px 0; font-weight: 700; font-size: 18px; color: #16a34a; text-align: right;">${collectionsToday}</td></tr>
      <tr style="border-top: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #555; font-size: 14px;">Loans Completed</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">${loansCompleted}</td></tr>
      <tr style="border-top: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #555; font-size: 14px;">Due in Next 7 Days</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">${upcomingDueCount}</td></tr>
      <tr style="border-top: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #555; font-size: 14px;">Overdue Installments</td><td style="padding: 8px 0; font-weight: 600; text-align: right; color: ${overdueCount > 0 ? '#dc2626' : '#16a34a'};">${overdueCount}</td></tr>
      <tr style="border-top: 1px solid #e5e7eb;"><td style="padding: 8px 0; color: #555; font-size: 14px;">Total Outstanding</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">${totalOutstanding}</td></tr>
    </table>
  </div>

  ${escalationSection}

  <div style="text-align: center; margin: 32px 0;">
    <a href="${dashboardUrl}" style="display: inline-block; background-color: #1a8cff; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600;">Open Dashboard</a>
  </div>

  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
  <p style="color: #999; font-size: 12px; text-align: center;">Loona — Loan Management</p>
</body>
</html>`

  const missedText = missedPaymentBorrowers.length > 0
    ? `\nMISSED PAYMENT ESCALATION:\n${missedPaymentBorrowers.map(b => `- ${b.name}: ${b.consecutiveMissed} consecutive missed (${b.loanReference})`).join('\n')}\n`
    : ''

  const text = `Daily Summary — ${date}\n\nHi ${lenderName},\n\nCollections Today: ${collectionsToday}\nLoans Completed: ${loansCompleted}\nDue Next 7 Days: ${upcomingDueCount}\nOverdue: ${overdueCount}\nOutstanding: ${totalOutstanding}\n${missedText}\nDashboard: ${dashboardUrl}`

  return { subject, html, text }
}
