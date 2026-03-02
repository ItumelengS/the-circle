import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { sendPaymentReminderEmail, type PaymentReminderData } from '@/lib/email';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export async function GET(request: Request) {
  // Verify cron secret (Vercel sends this as Authorization header)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthLabel = `${MONTHS[currentMonth]} ${currentYear}`;

  // Get all groups
  const { data: groups } = await supabase.from('groups').select('*');
  if (!groups || groups.length === 0) {
    return NextResponse.json({ message: 'No groups found', sent: 0 });
  }

  let totalSent = 0;
  const errors: string[] = [];

  for (const group of groups) {
    // Get members with user + profile data
    const { data: memberRows } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', group.id);

    if (!memberRows || memberRows.length === 0) continue;

    const userIds = memberRows.map((m) => m.user_id);

    const [{ data: users }, { data: profiles }] = await Promise.all([
      supabase.from('users').select('id, name, email').in('id', userIds),
      supabase.from('profiles').select('*').in('user_id', userIds),
    ]);

    if (!users) continue;

    const isRotation = group.group_type !== 'savings';

    // Build reminder data based on group type
    let reminderData: PaymentReminderData;

    if (isRotation) {
      // Get rotation order
      const { data: rotation } = await supabase
        .from('rotation_order')
        .select('*')
        .eq('group_id', group.id)
        .order('position', { ascending: true });

      const recipientIndex = rotation && rotation.length > 0
        ? currentMonth % rotation.length
        : -1;
      const recipientUserId = rotation?.[recipientIndex]?.user_id;
      const recipientUser = users.find((u) => u.id === recipientUserId);
      const recipientProfile = profiles?.find((p) => p.user_id === recipientUserId);

      reminderData = {
        groupName: group.name,
        groupIcon: group.icon,
        monthlyAmount: group.monthly_amount,
        monthLabel,
        groupType: 'rotation',
        recipientName: recipientUser?.name || recipientUser?.email || 'Unknown',
        recipientBank: recipientProfile?.bank || undefined,
        recipientAccType: recipientProfile?.acc_type || undefined,
        recipientAccNum: recipientProfile?.acc_num || undefined,
        recipientBranch: recipientProfile?.branch || undefined,
        recipientPhone: recipientProfile?.phone || undefined,
        potTotal: group.monthly_amount * memberRows.length,
      };
    } else {
      // Savings group
      const payoutMonths = group.payout_months || 12;
      const startDate = group.start_date ? new Date(group.start_date) : new Date(group.created_at);
      const monthsElapsed = (currentYear - startDate.getFullYear()) * 12 + (currentMonth - startDate.getMonth());
      const monthsRemaining = Math.max(0, payoutMonths - monthsElapsed);

      const payoutDate = new Date(startDate);
      payoutDate.setMonth(payoutDate.getMonth() + payoutMonths);

      // Get contributions for total saved
      const { data: contributions } = await supabase
        .from('contributions')
        .select('*')
        .eq('group_id', group.id)
        .eq('year', currentYear)
        .eq('paid', true);

      const totalPaidContributions = contributions?.length || 0;
      const totalSaved = totalPaidContributions * group.monthly_amount;
      const target = payoutMonths * memberRows.length * group.monthly_amount;
      const progressPercent = target > 0 ? Math.min(100, Math.round((totalSaved / target) * 100)) : 0;

      reminderData = {
        groupName: group.name,
        groupIcon: group.icon,
        monthlyAmount: group.monthly_amount,
        monthLabel,
        groupType: 'savings',
        totalSaved,
        target,
        progressPercent,
        monthsRemaining,
        payoutDate: payoutDate.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }),
      };
    }

    // Send email to each member
    for (const user of users) {
      if (!user.email) continue;

      try {
        await sendPaymentReminderEmail(
          user.email,
          user.name || user.email,
          reminderData,
        );
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
