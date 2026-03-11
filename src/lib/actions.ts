'use server';

import { auth, signIn } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  users,
  profiles,
  groups,
  groupMembers,
  rotationOrder,
  contributions,
  passwordResetTokens,
} from '@/lib/db/schema';
import { eq, and, inArray, desc, asc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { sendPasswordResetEmail } from '@/lib/email';
import { generateGroupCode } from '@/lib/db/helpers';
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
  const name = formData.get('name') as string;
  const email = (formData.get('email') as string)?.toLowerCase().trim();
  const password = formData.get('password') as string;

  if (!name || !email || !password) {
    return { error: 'All fields are required.' };
  }
  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters.' };
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return { error: 'An account with this email already exists.' };
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  try {
    await db.insert(users).values({ name, email, password: hashedPassword });
  } catch (err) {
    console.error('Registration error:', err);
    return { error: 'Failed to create account. Try again.' };
  }

  try {
    await signIn('credentials', { email, password, redirect: false });
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
    await signIn('credentials', { email, password, redirect: false });
  } catch {
    return { error: 'Invalid email or password.' };
  }

  redirect('/dashboard');
}

export async function forgotPassword(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const email = (formData.get('email') as string)?.toLowerCase().trim();

  if (!email) return { error: 'Email is required.' };

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Always return success to avoid email enumeration
  if (!user) return { success: true };

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(passwordResetTokens).values({
    user_id: user.id,
    token,
    expires_at: expiresAt.toISOString(),
  });

  await sendPasswordResetEmail(email, token);
  return { success: true };
}

export async function resetPassword(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const token = formData.get('token') as string;
  const password = formData.get('password') as string;

  if (!token || !password) return { error: 'Missing token or password.' };
  if (password.length < 6) return { error: 'Password must be at least 6 characters.' };

  const [resetToken] = await db
    .select()
    .from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.token, token), eq(passwordResetTokens.used, false)))
    .limit(1);

  if (!resetToken) return { error: 'Invalid or expired reset link.' };

  if (new Date(resetToken.expires_at) < new Date()) {
    return { error: 'This reset link has expired. Request a new one.' };
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await db.update(users).set({ password: hashedPassword }).where(eq(users.id, resetToken.user_id));

  await db
    .update(passwordResetTokens)
    .set({ used: true })
    .where(eq(passwordResetTokens.id, resetToken.id));

  return { success: true };
}

// =============================================
// PROFILE
// =============================================

export async function getProfile(): Promise<Profile | null> {
  const user = await getUser();
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.user_id, user.id))
    .limit(1);
  if (!profile) return null;
  return {
    ...profile,
    avatar: profile.avatar ?? '😎',
    color: profile.color ?? '#E8C547',
    updated_at: profile.updated_at ?? new Date().toISOString(),
  };
}

export async function upsertProfile(formData: FormData) {
  const user = await getUser();

  const name = formData.get('name') as string;
  const avatar = formData.get('avatar') as string;
  const color = formData.get('color') as string;
  const bank = formData.get('bank') as string;
  const acc_num = formData.get('acc_num') as string;
  const acc_type = formData.get('acc_type') as string;
  const branch = formData.get('branch') as string;
  const phone = formData.get('phone') as string;

  if (name) {
    await db.update(users).set({ name }).where(eq(users.id, user.id));
  }

  await db
    .insert(profiles)
    .values({
      user_id: user.id,
      avatar: avatar || '😎',
      color: color || '#E8C547',
      bank: bank || null,
      acc_num: acc_num || null,
      acc_type: acc_type || null,
      branch: branch || null,
      phone: phone || null,
      updated_at: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: profiles.user_id,
      set: {
        avatar: avatar || '😎',
        color: color || '#E8C547',
        bank: bank || null,
        acc_num: acc_num || null,
        acc_type: acc_type || null,
        branch: branch || null,
        phone: phone || null,
        updated_at: new Date().toISOString(),
      },
    });

  revalidatePath('/dashboard');
}

export async function updateMemberProfile(formData: FormData) {
  const user = await getUser();

  const groupId = formData.get('group_id') as string;
  const name = formData.get('name') as string;
  const bank = formData.get('bank') as string;
  const acc_num = formData.get('acc_num') as string;
  const acc_type = formData.get('acc_type') as string;
  const branch = formData.get('branch') as string;
  const phone = formData.get('phone') as string;

  if (name) {
    await db.update(users).set({ name }).where(eq(users.id, user.id));
  }

  await db
    .insert(profiles)
    .values({
      user_id: user.id,
      bank: bank || null,
      acc_num: acc_num || null,
      acc_type: acc_type || null,
      branch: branch || null,
      phone: phone || null,
      updated_at: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: profiles.user_id,
      set: {
        bank: bank || null,
        acc_num: acc_num || null,
        acc_type: acc_type || null,
        branch: branch || null,
        phone: phone || null,
        updated_at: new Date().toISOString(),
      },
    });

  revalidatePath(`/group/${groupId}`);
}

// =============================================
// GROUPS
// =============================================

export async function getUserGroups(): Promise<GroupWithMeta[]> {
  const user = await getUser();

  const memberships = await db
    .select({ group_id: groupMembers.group_id, is_admin: groupMembers.is_admin })
    .from(groupMembers)
    .where(eq(groupMembers.user_id, user.id));

  if (memberships.length === 0) return [];

  const groupIds = memberships.map((m) => m.group_id);

  const groupRows = await db
    .select()
    .from(groups)
    .where(inArray(groups.id, groupIds));

  const allMembers = await db
    .select({ group_id: groupMembers.group_id })
    .from(groupMembers)
    .where(inArray(groupMembers.group_id, groupIds));

  const memberCounts: Record<string, number> = {};
  allMembers.forEach((m) => {
    memberCounts[m.group_id] = (memberCounts[m.group_id] || 0) + 1;
  });

  return groupRows.map((g) => ({
    ...g,
    icon: g.icon ?? '🔄',
    monthly_amount: g.monthly_amount ?? 500,
    group_type: g.group_type as 'rotation' | 'savings',
    created_at: g.created_at ?? new Date().toISOString(),
    updated_at: g.updated_at ?? new Date().toISOString(),
    member_count: memberCounts[g.id] || 0,
    is_admin: memberships.find((m) => m.group_id === g.id)?.is_admin || false,
  }));
}

export async function createGroup(formData: FormData) {
  const user = await getUser();

  const name = formData.get('name') as string;
  const icon = formData.get('icon') as string;
  const monthly_amount = parseInt(formData.get('monthly_amount') as string) || 500;
  const group_type = (formData.get('group_type') as string) || 'rotation';
  const payout_months = group_type === 'savings' ? parseInt(formData.get('payout_months') as string) || 12 : null;

  const code = await generateGroupCode();

  const [group] = await db
    .insert(groups)
    .values({
      name,
      icon: icon || (group_type === 'savings' ? '💰' : '🔄'),
      code,
      monthly_amount,
      group_type,
      payout_months,
      start_date: group_type === 'savings' ? new Date().toISOString() : null,
      created_by: user.id,
    })
    .returning();

  if (!group) throw new Error('Failed to create group');

  await db.insert(groupMembers).values({
    group_id: group.id,
    user_id: user.id,
    is_admin: true,
  });

  if (group_type === 'rotation') {
    await db.insert(rotationOrder).values({
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

  await db
    .insert(profiles)
    .values({
      user_id: user.id,
      avatar: avatar || '😎',
      color: color || '#E8C547',
      bank: bank || null,
      acc_num: acc_num || null,
      acc_type: acc_type || null,
      branch: branch || null,
      phone: phone || null,
      updated_at: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: profiles.user_id,
      set: {
        avatar: avatar || '😎',
        color: color || '#E8C547',
        bank: bank || null,
        acc_num: acc_num || null,
        acc_type: acc_type || null,
        branch: branch || null,
        phone: phone || null,
        updated_at: new Date().toISOString(),
      },
    });

  redirect(`/group/${group.id}`);
}

export async function joinGroup(formData: FormData): Promise<{ error?: string }> {
  const user = await getUser();

  const code = (formData.get('code') as string)?.toUpperCase().trim();

  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.code, code))
    .limit(1);

  if (!group) return { error: 'Group not found. Check the invite code.' };

  const [existing] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.group_id, group.id), eq(groupMembers.user_id, user.id)))
    .limit(1);

  if (existing) return { error: 'You are already a member of this group.' };

  await db.insert(groupMembers).values({
    group_id: group.id,
    user_id: user.id,
    is_admin: false,
  });

  if (group.group_type !== 'savings') {
    const [last] = await db
      .select({ position: rotationOrder.position })
      .from(rotationOrder)
      .where(eq(rotationOrder.group_id, group.id))
      .orderBy(desc(rotationOrder.position))
      .limit(1);

    const nextPosition = last ? last.position + 1 : 0;

    await db.insert(rotationOrder).values({
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

  await db
    .insert(profiles)
    .values({
      user_id: user.id,
      avatar: avatar || '😎',
      color: color || '#E8C547',
      bank: bank || null,
      acc_num: acc_num || null,
      acc_type: acc_type || null,
      branch: branch || null,
      phone: phone || null,
      updated_at: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: profiles.user_id,
      set: {
        avatar: avatar || '😎',
        color: color || '#E8C547',
        bank: bank || null,
        acc_num: acc_num || null,
        acc_type: acc_type || null,
        branch: branch || null,
        phone: phone || null,
        updated_at: new Date().toISOString(),
      },
    });

  redirect(`/group/${group.id}`);
}

export async function getGroupDetails(groupId: string): Promise<GroupDetails | null> {
  const user = await getUser();

  const [membership] = await db
    .select({ is_admin: groupMembers.is_admin })
    .from(groupMembers)
    .where(and(eq(groupMembers.group_id, groupId), eq(groupMembers.user_id, user.id)))
    .limit(1);

  if (!membership) return null;

  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!group) return null;

  const memberRows = await db
    .select({ user_id: groupMembers.user_id, is_admin: groupMembers.is_admin })
    .from(groupMembers)
    .where(eq(groupMembers.group_id, groupId));

  const userIds = memberRows.map((m) => m.user_id);

  const [userRows, profileRows] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, userIds)),
    db.select().from(profiles).where(inArray(profiles.user_id, userIds)),
  ]);

  const members: MemberWithDetails[] = memberRows.map((m) => {
    const u = userRows.find((u) => u.id === m.user_id);
    const p = profileRows.find((p) => p.user_id === m.user_id);
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
      is_admin: m.is_admin!,
    };
  });

  const rotation = await db
    .select()
    .from(rotationOrder)
    .where(eq(rotationOrder.group_id, groupId))
    .orderBy(asc(rotationOrder.position));

  const currentYear = new Date().getFullYear();
  const contributionRows = await db
    .select()
    .from(contributions)
    .where(and(eq(contributions.group_id, groupId), eq(contributions.year, currentYear)));

  return {
    group: {
      ...group,
      icon: group.icon ?? '🔄',
      monthly_amount: group.monthly_amount ?? 500,
      group_type: group.group_type as 'rotation' | 'savings',
      created_at: group.created_at ?? new Date().toISOString(),
      updated_at: group.updated_at ?? new Date().toISOString(),
    },
    members,
    rotation,
    contributions: contributionRows.map((c) => ({
      ...c,
      paid: c.paid ?? false,
      created_at: c.created_at ?? new Date().toISOString(),
    })),
    is_admin: membership.is_admin!,
    current_user_id: user.id,
  };
}

export async function deleteGroup(groupId: string) {
  const user = await getUser();

  const [membership] = await db
    .select({ is_admin: groupMembers.is_admin })
    .from(groupMembers)
    .where(and(eq(groupMembers.group_id, groupId), eq(groupMembers.user_id, user.id)))
    .limit(1);

  if (!membership?.is_admin) throw new Error('Not authorized');

  await db.delete(groups).where(eq(groups.id, groupId));
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

  const [membership] = await db
    .select({ is_admin: groupMembers.is_admin })
    .from(groupMembers)
    .where(and(eq(groupMembers.group_id, groupId), eq(groupMembers.user_id, user.id)))
    .limit(1);

  if (!membership) throw new Error('Not a member');
  if (!membership.is_admin) throw new Error('Only admins can mark payments');

  if (paid) {
    await db
      .insert(contributions)
      .values({
        group_id: groupId,
        user_id: targetUserId,
        month,
        year,
        paid: true,
        paid_at: new Date().toISOString(),
        marked_by: user.id,
      })
      .onConflictDoUpdate({
        target: [contributions.group_id, contributions.user_id, contributions.month, contributions.year],
        set: {
          paid: true,
          paid_at: new Date().toISOString(),
          marked_by: user.id,
        },
      });
  } else {
    await db
      .delete(contributions)
      .where(
        and(
          eq(contributions.group_id, groupId),
          eq(contributions.user_id, targetUserId),
          eq(contributions.month, month),
          eq(contributions.year, year)
        )
      );
  }

  revalidatePath(`/group/${groupId}`);
}

// =============================================
// GROUP MANAGEMENT
// =============================================

export async function updateGroupAmount(groupId: string, amount: number) {
  const user = await getUser();

  const [membership] = await db
    .select({ is_admin: groupMembers.is_admin })
    .from(groupMembers)
    .where(and(eq(groupMembers.group_id, groupId), eq(groupMembers.user_id, user.id)))
    .limit(1);

  if (!membership?.is_admin) throw new Error('Not authorized');

  await db
    .update(groups)
    .set({ monthly_amount: amount, updated_at: new Date().toISOString() })
    .where(eq(groups.id, groupId));

  revalidatePath(`/group/${groupId}`);
}

export async function updateRotationOrder(groupId: string, orderedUserIds: string[]) {
  const user = await getUser();

  const [membership] = await db
    .select({ is_admin: groupMembers.is_admin })
    .from(groupMembers)
    .where(and(eq(groupMembers.group_id, groupId), eq(groupMembers.user_id, user.id)))
    .limit(1);

  if (!membership?.is_admin) throw new Error('Not authorized');

  await db.transaction(async (tx) => {
    await tx.delete(rotationOrder).where(eq(rotationOrder.group_id, groupId));

    if (orderedUserIds.length > 0) {
      const rows = orderedUserIds.map((uid, i) => ({
        group_id: groupId,
        user_id: uid,
        position: i,
      }));
      await tx.insert(rotationOrder).values(rows);
    }
  });

  revalidatePath(`/group/${groupId}`);
}

export async function removeMember(groupId: string, targetUserId: string) {
  const user = await getUser();

  const [membership] = await db
    .select({ is_admin: groupMembers.is_admin })
    .from(groupMembers)
    .where(and(eq(groupMembers.group_id, groupId), eq(groupMembers.user_id, user.id)))
    .limit(1);

  if (targetUserId !== user.id && !membership?.is_admin) {
    throw new Error('Not authorized');
  }

  await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.group_id, groupId), eq(groupMembers.user_id, targetUserId)));

  await db
    .delete(rotationOrder)
    .where(and(eq(rotationOrder.group_id, groupId), eq(rotationOrder.user_id, targetUserId)));

  // Re-sequence remaining rotation positions
  const remaining = await db
    .select()
    .from(rotationOrder)
    .where(eq(rotationOrder.group_id, groupId))
    .orderBy(asc(rotationOrder.position));

  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].position !== i) {
      await db
        .update(rotationOrder)
        .set({ position: i })
        .where(eq(rotationOrder.id, remaining[i].id));
    }
  }

  if (targetUserId === user.id) {
    redirect('/dashboard');
  }

  revalidatePath(`/group/${groupId}`);
}
