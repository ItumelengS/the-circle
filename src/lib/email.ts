import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPasswordResetEmail(email: string, token: string) {
  const baseUrl = process.env.AUTH_URL || 'https://istokvel.vercel.app';
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  await resend.emails.send({
    from: 'Stokfela <onboarding@resend.dev>',
    to: email,
    subject: 'Reset your Stokfela password',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0A0A0C; color: #F0EDE6; border-radius: 16px;">
        <h1 style="color: #E8C547; font-size: 24px; margin-bottom: 16px;">Stokfela</h1>
        <p>You requested a password reset. Click the button below to set a new password:</p>
        <a href="${resetUrl}" style="display: inline-block; margin: 24px 0; padding: 12px 32px; background: linear-gradient(135deg, #E8C547, #D4A82A); color: #0A0A0C; text-decoration: none; border-radius: 12px; font-weight: 600;">
          Reset Password
        </a>
        <p style="font-size: 14px; opacity: 0.5;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
}
