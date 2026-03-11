import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  groups,
  groupMembers,
  users,
  profiles,
  rotationOrder,
  contributions,
} from '@/lib/db/schema';
import { eq, and, inArray, asc } from 'drizzle-orm';
import { sendPaymentReminderEmail, type PaymentReminderData } from '@/lib/email';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export async function GET(request: Request) {
  // Verify cron secret (Vercel sends this as Authorization header)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthLabel = `${MONTHS[currentMonth]} ${currentYear}`;

  // Get all groups
  const allGroups = await db.select().from(groups);
  if (allGroups.length === 0) {
    return NextResponse.json({ message: 'No groups found', sent: 0 });
  }

  let totalSent = 0;
  const errors: string[] = [];

  for (const group of allGroups) {
    // Get members
    const memberRows = await db
      .select({ user_id: groupMembers.user_id })
      .from(groupMembers)
      .where(eq(groupMembers.group_id, group.id));

    if (memberRows.length === 0) continue;

    const userIds = memberRows.map((m) => m.user_id);

    const [userRows, profileRows] = await Promise.all([
      db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, userIds)),
      db.select().from(profiles).where(inArray(profiles.user_id, userIds)),
    ]);

    if (userRows.length === 0) continue;

    const isRotation = group.group_type !== 'savings';

    let reminderData: PaymentReminderData;

    if (isRotation) {
      const rotation = await db
        .select()
        .from(rotationOrder)
        .where(eq(rotationOrder.group_id, group.id))
        .orderBy(asc(rotationOrder.position));

      const recipientIndex = rotation.length > 0 ? currentMonth % rotation.length : -1;
      const recipientUserId = rotation[recipientIndex]?.user_id;
      const recipientUser = userRows.find((u) => u.id === recipientUserId);
      const recipientProfile = profileRows.find((p) => p.user_id === recipientUserId);

      reminderData = {
        groupName: group.name,
        groupIcon: group.icon!,
        monthlyAmount: group.monthly_amount!,
        monthLabel,
        groupType: 'rotation',
        recipientName: recipientUser?.name || recipientUser?.email || 'Unknown',
        recipientBank: recipientProfile?.bank || undefined,
        recipientAccType: recipientProfile?.acc_type || undefined,
        recipientAccNum: recipientProfile?.acc_num || undefined,
        recipientBranch: recipientProfile?.branch || undefined,
        recipientPhone: recipientProfile?.phone || undefined,
        potTotal: group.monthly_amount! * memberRows.length,
      };
    } else {
      const payoutMonths = group.payout_months || 12;
      const startDate = group.start_date ? new Date(group.start_date) : new Date(group.created_at!);
      const monthsElapsed = (currentYear - startDate.getFullYear()) * 12 + (currentMonth - startDate.getMonth());
      const monthsRemaining = Math.max(0, payoutMonths - monthsElapsed);

      const payoutDate = new Date(startDate);
      payoutDate.setMonth(payoutDate.getMonth() + payoutMonths);

      const contributionRows = await db
        .select()
        .from(contributions)
        .where(
          and(
            eq(contributions.group_id, group.id),
            eq(contributions.year, currentYear),
            eq(contributions.paid, true)
          )
        );

      const totalPaidContributions = contributionRows.length;
      const totalSaved = totalPaidContributions * group.monthly_amount!;
      const target = payoutMonths * memberRows.length * group.monthly_amount!;
      const progressPercent = target > 0 ? Math.min(100, Math.round((totalSaved / target) * 100)) : 0;

      reminderData = {
        groupName: group.name,
        groupIcon: group.icon!,
        monthlyAmount: group.monthly_amount!,
        monthLabel,
        groupType: 'savings',
        totalSaved,
        target,
        progressPercent,
        monthsRemaining,
        payoutDate: payoutDate.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }),
      };
    }

    for (const user of userRows) {
      if (!user.email) continue;

      try {
        await sendPaymentReminderEmail(user.email, user.name || user.email, reminderData);
        totalSent++;
      } catch (err) {
        errors.push(`Failed to email ${user.email} for group ${group.name}: ${err}`);
      }
    }
  }

  return NextResponse.json({
    message: `Sent ${totalSent} reminder emails`,
    sent: totalSent,
    errors: errors.length > 0 ? errors : undefined,
  });
}
