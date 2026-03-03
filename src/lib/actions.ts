'use server';

import { auth, signIn } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { sendPasswordResetEmail } from '@/lib/email';
import type { GroupWithMeta, GroupDetails, Profile, MemberWithDetails } from '@/lib/types';

async function getUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not authenticated');
  return session.user as { id: string; name?: string | null; email?: string | null };
}

// =============================================
// AUTH
// =============================================

export async function register(formData: FormData): Promise<{ error?: string }> {
  const supabase = createServerClient();
  const name = formData.get('name') as string;
  const email = (formData.get('email') as string)?.toLowerCase().trim();
  const password = formData.get('password') as string;

  if (!name || !email || !password) {
    return { error: 'All fields are required.' };
  }
  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters.' };
  }

  // Check if email exists
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (existing) {
    return { error: 'An account with this email already exists.' };
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const { error } = await supabase.from('users').insert({
    name,
    email,
    password: hashedPassword,
  });

  if (error) {
    return { error: 'Failed to create account. Try again.' };
  }

  // Sign in after registration
  try {
    await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
  } catch {
    // signIn may throw a NEXT_REDIRECT — that's fine
  }

  redirect('/dashboard');
}

export async function login(formData: FormData): Promise<{ error?: string }> {
  const email = (formData.get('email') as string)?.toLowerCase().trim();
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  try {
    await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
  } catch {
    return { error: 'Invalid email or password.' };
  }

  redirect('/dashboard');
}

export async function forgotPassword(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const supabase = createServerClient();
  const email = (formData.get('email') as string)?.toLowerCase().trim();

  if (!email) return { error: 'Email is required.' };

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  // Always return success to avoid email enumeration
  if (!user) return { success: true };

  // Generate token
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await supabase.from('password_reset_tokens').insert({
    user_id: user.id,
    token,
    expires_at: expiresAt.toISOString(),
  });

  await sendPasswordResetEmail(email, token);
  return { success: true };
}

export async function resetPassword(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const supabase = createServerClient();
  const token = formData.get('token') as string;
  const password = formData.get('password') as string;

  if (!token || !password) return { error: 'Missing token or password.' };
  if (password.length < 6) return { error: 'Password must be at least 6 characters.' };

  const { data: resetToken } = await supabase
    .from('password_reset_tokens')
    .select('*')
    .eq('token', token)
    .eq('used', false)
    .single();

  if (!resetToken) return { error: 'Invalid or expired reset link.' };

  if (new Date(resetToken.expires_at) < new Date()) {
    return { error: 'This reset link has expired. Request a new one.' };
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await supabase
    .from('users')
    .update({ password: hashedPassword })
    .eq('id', resetToken.user_id);

  // Mark token as used
  await supabase
    .from('password_reset_tokens')
    .update({ used: true })
    .eq('id', resetToken.id);

  return { success: true };
}

// =============================================
// PROFILE
// =============================================

export async function getProfile(): Promise<Profile | null> {
  const user = await getUser();
  const supabase = createServerClient();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();
  return data;
}

export async function upsertProfile(formData: FormData) {
  const user = await getUser();
  const supabase = createServerClient();

  const name = formData.get('name') as string;
  const avatar = formData.get('avatar') as string;
  const color = formData.get('color') as string;
  const bank = formData.get('bank') as string;
  const acc_num = formData.get('acc_num') as string;
  const acc_type = formData.get('acc_type') as string;
  const branch = formData.get('branch') as string;
  const phone = formData.get('phone') as string;

  if (name) {
    await supabase.from('users').update({ name }).eq('id', user.id);
  }

  await supabase.from('profiles').upsert({
    user_id: user.id,
    avatar: avatar || '😎',
    color: color || '#E8C547',
    bank: bank || null,
    acc_num: acc_num || null,
    acc_type: acc_type || null,
    branch: branch || null,
    phone: phone || null,
    updated_at: new Date().toISOString(),
  });

  revalidatePath('/dashboard');
}

export async function updateMemberProfile(formData: FormData) {
  const user = await getUser();
  const supabase = createServerClient();

  const groupId = formData.get('group_id') as string;
  const name = formData.get('name') as string;
  const bank = formData.get('bank') as string;
  const acc_num = formData.get('acc_num') as string;
  const acc_type = formData.get('acc_type') as string;
  const branch = formData.get('branch') as string;
  const phone = formData.get('phone') as string;

  if (name) {
    await supabase.from('users').update({ name }).eq('id', user.id);
  }

  await supabase.from('profiles').upsert({
    user_id: user.id,
    bank: bank || null,
    acc_num: acc_num || null,
    acc_type: acc_type || null,
    branch: branch || null,
    phone: phone || null,
    updated_at: new Date().toISOString(),
  });

  revalidatePath(`/group/${groupId}`);
}

// =============================================
// GROUPS
// =============================================

export async function getUserGroups(): Promise<GroupWithMeta[]> {
  const user = await getUser();
  const supabase = createServerClient();

  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id, is_admin')
    .eq('user_id', user.id);

  if (!memberships || memberships.length === 0) return [];

  const groupIds = memberships.map((m) => m.group_id);

  const { data: groups } = await supabase
    .from('groups')
    .select('*')
    .in('id', groupIds);

  if (!groups) return [];

  const { data: allMembers } = await supabase
    .from('group_members')
    .select('group_id')
    .in('group_id', groupIds);

  const memberCounts: Record<string, number> = {};
  allMembers?.forEach((m) => {
    memberCounts[m.group_id] = (memberCounts[m.group_id] || 0) + 1;
  });

  return groups.map((g) => ({
    ...g,
    member_count: memberCounts[g.id] || 0,
    is_admin: memberships.find((m) => m.group_id === g.id)?.is_admin || false,
  }));
}

export async function createGroup(formData: FormData) {
  const user = await getUser();
  const supabase = createServerClient();

  const name = formData.get('name') as string;
  const icon = formData.get('icon') as string;
  const monthly_amount = parseInt(formData.get('monthly_amount') as string) || 500;
  const group_type = (formData.get('group_type') as string) || 'rotation';
  const payout_months = group_type === 'savings' ? parseInt(formData.get('payout_months') as string) || 12 : null;

  // Generate unique code
  const { data: codeData } = await supabase.rpc('generate_group_code');
  const code = codeData as string;

  const { data: group, error } = await supabase
    .from('groups')
    .insert({
      name,
      icon: icon || (group_type === 'savings' ? '💰' : '🔄'),
      code,
      monthly_amount,
      group_type,
      payout_months,
      start_date: group_type === 'savings' ? new Date().toISOString() : null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error || !group) throw new Error('Failed to create group');

  // Add creator as admin member
  await supabase.from('group_members').insert({
    group_id: group.id,
    user_id: user.id,
    is_admin: true,
  });

  // Add to rotation only for rotation groups
  if (group_type === 'rotation') {
    await supabase.from('rotation_order').insert({
      group_id: group.id,
      user_id: user.id,
      position: 0,
    });
  }

  // Upsert profile
  const avatar = formData.get('avatar') as string;
  const color = formData.get('color') as string;
  const bank = formData.get('bank') as string;
  const acc_num = formData.get('acc_num') as string;
  const acc_type = formData.get('acc_type') as string;
  const branch = formData.get('branch') as string;
  const phone = formData.get('phone') as string;

  await supabase.from('profiles').upsert({
    user_id: user.id,
    avatar: avatar || '😎',
    color: color || '#E8C547',
    bank: bank || null,
    acc_num: acc_num || null,
    acc_type: acc_type || null,
    branch: branch || null,
    phone: phone || null,
    updated_at: new Date().toISOString(),
  });

  redirect(`/group/${group.id}`);
}

export async function joinGroup(formData: FormData): Promise<{ error?: string }> {
  const user = await getUser();
  const supabase = createServerClient();

  const code = (formData.get('code') as string)?.toUpperCase().trim();

  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('code', code)
    .single();

  if (!group) return { error: 'Group not found. Check the invite code.' };

  // Check if already a member
  const { data: existing } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .single();

  if (existing) return { error: 'You are already a member of this group.' };

  // Add member
  await supabase.from('group_members').insert({
    group_id: group.id,
    user_id: user.id,
    is_admin: false,
  });

  // Add to rotation only for rotation groups
  if (group.group_type !== 'savings') {
    const { data: rotations } = await supabase
      .from('rotation_order')
      .select('position')
      .eq('group_id', group.id)
      .order('position', { ascending: false })
      .limit(1);

    const nextPosition = rotations && rotations.length > 0 ? rotations[0].position + 1 : 0;

    await supabase.from('rotation_order').insert({
      group_id: group.id,
      user_id: user.id,
      position: nextPosition,
    });
  }

  // Upsert profile
  const avatar = formData.get('avatar') as string;
  const color = formData.get('color') as string;
  const bank = formData.get('bank') as string;
  const acc_num = formData.get('acc_num') as string;
  const acc_type = formData.get('acc_type') as string;
  const branch = formData.get('branch') as string;
  const phone = formData.get('phone') as string;

  await supabase.from('profiles').upsert({
    user_id: user.id,
    avatar: avatar || '😎',
    color: color || '#E8C547',
    bank: bank || null,
    acc_num: acc_num || null,
    acc_type: acc_type || null,
    branch: branch || null,
    phone: phone || null,
    updated_at: new Date().toISOString(),
  });

  redirect(`/group/${group.id}`);
}

export async function getGroupDetails(groupId: string): Promise<GroupDetails | null> {
  const user = await getUser();
  const supabase = createServerClient();

  // Check membership
  const { data: membership } = await supabase
    .from('group_members')
    .select('is_admin')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single();

  if (!membership) return null;

  // Get group
  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single();

  if (!group) return null;

  // Get members with user + profile data
  const { data: memberRows } = await supabase
    .from('group_members')
    .select('user_id, is_admin')
    .eq('group_id', groupId);

  const userIds = memberRows?.map((m) => m.user_id) || [];

  const { data: users } = await supabase
    .from('users')
    .select('id, name, email')
    .in('id', userIds);

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .in('user_id', userIds);

  const members: MemberWithDetails[] = (memberRows || []).map((m) => {
    const u = users?.find((u) => u.id === m.user_id);
    const p = profiles?.find((p) => p.user_id === m.user_id);
    return {
      user_id: m.user_id,
      name: u?.name || u?.email || 'Unknown',
      email: u?.email || null,
      avatar: p?.avatar || '😎',
      color: p?.color || '#E8C547',
      bank: p?.bank || null,
      acc_num: p?.acc_num || null,
      acc_type: p?.acc_type || null,
      branch: p?.branch || null,
      phone: p?.phone || null,
      is_admin: m.is_admin,
    };
  });

  // Get rotation order
  const { data: rotation } = await supabase
    .from('rotation_order')
    .select('*')
    .eq('group_id', groupId)
    .order('position', { ascending: true });

  // Get contributions for current year
  const currentYear = new Date().getFullYear();
  const { data: contributions } = await supabase
    .from('contributions')
    .select('*')
    .eq('group_id', groupId)
    .eq('year', currentYear);

  return {
    group,
    members,
    rotation: rotation || [],
    contributions: contributions || [],
    is_admin: membership.is_admin,
    current_user_id: user.id,
  };
}

export async function deleteGroup(groupId: string) {
  const user = await getUser();
  const supabase = createServerClient();

  const { data: membership } = await supabase
    .from('group_members')
    .select('is_admin')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single();

  if (!membership?.is_admin) throw new Error('Not authorized');

  await supabase.from('groups').delete().eq('id', groupId);
  redirect('/dashboard');
}

// =============================================
// CONTRIBUTIONS
// =============================================

export async function toggleContribution(
  groupId: string,
  targetUserId: string,
  month: number,
  year: number,
  paid: boolean
) {
  const user = await getUser();
  const supabase = createServerClient();

  // Verify admin
  const { data: membership } = await supabase
    .from('group_members')
    .select('is_admin')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single();

  if (!membership) throw new Error('Not a member');
  if (!membership.is_admin) throw new Error('Only admins can mark payments');

  if (paid) {
    await supabase.from('contributions').upsert(
      {
        group_id: groupId,
        user_id: targetUserId,
        month,
        year,
        paid: true,
        paid_at: new Date().toISOString(),
        marked_by: user.id,
      },
      { onConflict: 'group_id,user_id,month,year' }
    );
  } else {
    await supabase
      .from('contributions')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', targetUserId)
      .eq('month', month)
      .eq('year', year);
  }

  revalidatePath(`/group/${groupId}`);
}

// =============================================
// GROUP MANAGEMENT
// =============================================

export async function updateGroupAmount(groupId: string, amount: number) {
  const user = await getUser();
  const supabase = createServerClient();

  const { data: membership } = await supabase
    .from('group_members')
    .select('is_admin')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single();

  if (!membership?.is_admin) throw new Error('Not authorized');

  await supabase
    .from('groups')
    .update({ monthly_amount: amount, updated_at: new Date().toISOString() })
    .eq('id', groupId);

  revalidatePath(`/group/${groupId}`);
}

export async function updateRotationOrder(groupId: string, orderedUserIds: string[]) {
  const user = await getUser();
  const supabase = createServerClient();

  const { data: membership } = await supabase
    .from('group_members')
    .select('is_admin')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single();

  if (!membership?.is_admin) throw new Error('Not authorized');

  await supabase.from('rotation_order').delete().eq('group_id', groupId);

  const rows = orderedUserIds.map((uid, i) => ({
    group_id: groupId,
    user_id: uid,
    position: i,
  }));

  await supabase.from('rotation_order').insert(rows);
  revalidatePath(`/group/${groupId}`);
}

export async function removeMember(groupId: string, targetUserId: string) {
  const user = await getUser();
  const supabase = createServerClient();

  const { data: membership } = await supabase
    .from('group_members')
    .select('is_admin')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single();

  if (targetUserId !== user.id && !membership?.is_admin) {
    throw new Error('Not authorized');
  }

  await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', targetUserId);

  await supabase
    .from('rotation_order')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', targetUserId);

  // Re-sequence remaining rotation positions
  const { data: remaining } = await supabase
    .from('rotation_order')
    .select('*')
    .eq('group_id', groupId)
    .order('position', { ascending: true });

  if (remaining) {
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].position !== i) {
        await supabase
          .from('rotation_order')
          .update({ position: i })
          .eq('id', remaining[i].id);
      }
    }
  }

  if (targetUserId === user.id) {
    redirect('/dashboard');
  }

  revalidatePath(`/group/${groupId}`);
}
