import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// IMPORTANT: Without a verified domain, Resend only sends to your own email.
// Verify your domain at resend.com/domains, then set FROM_EMAIL env var.
const FROM_EMAIL = process.env.FROM_EMAIL || 'Loona <onboarding@resend.dev>'

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
    <a href="${process.env.BETTER_AUTH_URL || 'https://loona.app'}/login" style="background-color: #1a8cff; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">Get Started</a>
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

Get started: ${process.env.BETTER_AUTH_URL || 'https://loona.app'}/login

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
    <a href="${process.env.BETTER_AUTH_URL || 'https://loona.app'}/login" style="background-color: #1a8cff; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">Login to Loona</a>
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

Login here: ${process.env.BETTER_AUTH_URL || 'https://loona.app'}/login

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
