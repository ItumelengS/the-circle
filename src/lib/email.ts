import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type PaymentReminderData = {
  groupName: string;
  groupIcon: string;
  monthlyAmount: number;
  monthLabel: string;
  groupType: 'rotation' | 'savings';
  // Rotation-specific
  recipientName?: string;
  recipientBank?: string;
  recipientAccType?: string;
  recipientAccNum?: string;
  recipientBranch?: string;
  recipientPhone?: string;
  potTotal?: number;
  // Savings-specific
  totalSaved?: number;
  target?: number;
  progressPercent?: number;
  monthsRemaining?: number;
  payoutDate?: string;
};

export async function sendPaymentReminderEmail(email: string, memberName: string, data: PaymentReminderData) {
  const baseUrl = process.env.AUTH_URL || 'https://istokvel.vercel.app';

  const bankingHtml = data.recipientBank
    ? `
      <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 16px; margin: 16px 0;">
        <p style="font-size: 12px; opacity: 0.5; margin: 0 0 8px;">Banking Details</p>
        <p style="margin: 4px 0;"><span style="opacity: 0.5;">Bank:</span> ${data.recipientBank}</p>
        ${data.recipientAccType ? `<p style="margin: 4px 0;"><span style="opacity: 0.5;">Type:</span> ${data.recipientAccType}</p>` : ''}
        <p style="margin: 4px 0; font-family: monospace;"><span style="opacity: 0.5;">Acc:</span> ${data.recipientAccNum}</p>
        ${data.recipientBranch ? `<p style="margin: 4px 0;"><span style="opacity: 0.5;">Branch:</span> ${data.recipientBranch}</p>` : ''}
        ${data.recipientPhone ? `<p style="margin: 4px 0;"><span style="opacity: 0.5;">Phone:</span> ${data.recipientPhone}</p>` : ''}
      </div>
    `
    : '<p style="font-size: 14px; opacity: 0.5;">No banking details added yet — check the app.</p>';

  const rotationBody = `
    <p>It's <strong>${data.monthLabel}</strong> — time to contribute to <strong>${data.groupIcon} ${data.groupName}</strong>.</p>
    <div style="background: rgba(232,197,71,0.08); border-radius: 12px; padding: 16px; margin: 16px 0;">
      <p style="font-size: 14px; opacity: 0.5; margin: 0;">This month's recipient</p>
      <p style="font-size: 20px; font-weight: 600; margin: 4px 0;">${data.recipientName}</p>
      <p style="color: #E8C547; font-size: 18px; font-weight: 700; margin: 4px 0;">R${data.potTotal?.toLocaleString()} pot</p>
    </div>
    <p>Your contribution: <strong style="color: #E8C547;">R${data.monthlyAmount.toLocaleString()}</strong></p>
    ${bankingHtml}
  `;

  const savingsBody = `
    <p>It's <strong>${data.monthLabel}</strong> — your <strong>${data.groupIcon} ${data.groupName}</strong> savings contribution is due.</p>
    <p>Amount due: <strong style="color: #E8C547;">R${data.monthlyAmount.toLocaleString()}</strong></p>
    <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 16px; margin: 16px 0;">
      <p style="margin: 4px 0;"><span style="opacity: 0.5;">Total saved:</span> <strong style="color: #4ADE80;">R${data.totalSaved?.toLocaleString()}</strong></p>
      <p style="margin: 4px 0;"><span style="opacity: 0.5;">Target:</span> R${data.target?.toLocaleString()}</p>
      <p style="margin: 4px 0;"><span style="opacity: 0.5;">Progress:</span> ${data.progressPercent}%</p>
      <p style="margin: 4px 0;"><span style="opacity: 0.5;">Months remaining:</span> ${data.monthsRemaining}</p>
      <p style="margin: 4px 0;"><span style="opacity: 0.5;">Payout date:</span> ${data.payoutDate}</p>
    </div>
  `;

  await resend.emails.send({
    from: 'Stokfela <onboarding@resend.dev>',
    to: email,
    subject: `${data.groupIcon} ${data.groupName} — ${data.monthLabel} payment reminder`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0A0A0C; color: #F0EDE6; border-radius: 16px;">
        <h1 style="color: #E8C547; font-size: 24px; margin-bottom: 16px;">Stokfela</h1>
        <p style="opacity: 0.7;">Hi ${memberName},</p>
        ${data.groupType === 'rotation' ? rotationBody : savingsBody}
        <a href="${baseUrl}/dashboard" style="display: inline-block; margin: 24px 0; padding: 12px 32px; background: linear-gradient(135deg, #E8C547, #D4A82A); color: #0A0A0C; text-decoration: none; border-radius: 12px; font-weight: 600;">
          Open Stokfela
        </a>
        <p style="font-size: 12px; opacity: 0.3;">You're receiving this because you're a member of ${data.groupName}.</p>
      </div>
    `,
  });
}

export { MONTHS as EMAIL_MONTHS };

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
