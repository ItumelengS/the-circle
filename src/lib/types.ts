export const MEMBER_COLORS = [
  '#E8C547', '#47B5E8', '#E85C47', '#47E88C',
  '#B547E8', '#E8479A', '#47E8D4', '#E89447',
] as const;

export const MEMBER_AVATARS = [
  '😎', '🤩', '🫡', '🧑‍🎤', '🦁', '🌟', '💎', '🔥',
  '🎯', '🪩', '🏆', '🎲', '🌈', '🦅', '🐝', '🎸',
] as const;

export const GROUP_ICONS = [
  '🔄', '💰', '🤝', '🌀', '⭐', '🎯', '💎', '🪙', '🏦', '🎪',
] as const;

export const SA_BANKS = [
  'ABSA', 'Capitec', 'FNB', 'Nedbank', 'Standard Bank',
  'TymeBank', 'African Bank', 'Discovery Bank', 'Investec', 'Other',
] as const;

export const ACCOUNT_TYPES = ['Savings', 'Cheque', 'Current', 'Transmission'] as const;

export const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

export type Profile = {
  user_id: string;
  avatar: string;
  color: string;
  bank: string | null;
  acc_num: string | null;
  acc_type: string | null;
  branch: string | null;
  phone: string | null;
  updated_at: string;
};

export type Group = {
  id: string;
  name: string;
  icon: string;
  code: string;
  monthly_amount: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  is_admin: boolean;
  joined_at: string;
};

export type RotationOrder = {
  id: string;
  group_id: string;
  user_id: string;
  position: number;
};

export type Contribution = {
  id: string;
  group_id: string;
  user_id: string;
  month: number;
  year: number;
  paid: boolean;
  paid_at: string | null;
  marked_by: string | null;
  created_at: string;
};

export type MemberWithDetails = {
  user_id: string;
  name: string | null;
  email: string | null;
  avatar: string;
  color: string;
  bank: string | null;
  acc_num: string | null;
  acc_type: string | null;
  branch: string | null;
  phone: string | null;
  is_admin: boolean;
};

export type GroupWithMeta = Group & {
  member_count: number;
  is_admin: boolean;
};

export type GroupDetails = {
  group: Group;
  members: MemberWithDetails[];
  rotation: RotationOrder[];
  contributions: Contribution[];
  is_admin: boolean;
  current_user_id: string;
};
