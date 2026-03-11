import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  boolean,
  integer,
  uniqueIndex,
  index,
  primaryKey,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// =============================================
// AUTH.JS ADAPTER TABLES
// =============================================

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  email: text('email').unique(),
  password: text('password'),
  emailVerified: timestamp('emailVerified', { mode: 'date', withTimezone: true }),
  image: text('image'),
});

export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: bigint('expires_at', { mode: 'number' }),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionToken: text('sessionToken').notNull().unique(),
  userId: uuid('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date', withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull().unique(),
    expires: timestamp('expires', { mode: 'date', withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.identifier, table.token] }),
  ]
);

// =============================================
// APP TABLES
// =============================================

export const profiles = pgTable('profiles', {
  user_id: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .primaryKey(),
  avatar: text('avatar').default('😎'),
  color: text('color').default('#E8C547'),
  bank: text('bank'),
  acc_num: text('acc_num'),
  acc_type: text('acc_type'),
  branch: text('branch'),
  phone: text('phone'),
  updated_at: timestamp('updated_at', { mode: 'string', withTimezone: true }).defaultNow(),
});

export const groups = pgTable(
  'groups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    icon: text('icon').default('🔄'),
    code: text('code').unique().notNull(),
    monthly_amount: integer('monthly_amount').default(500),
    group_type: text('group_type').notNull().default('rotation'),
    payout_months: integer('payout_months'),
    start_date: timestamp('start_date', { mode: 'string', withTimezone: true }),
    created_by: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { mode: 'string', withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { mode: 'string', withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_groups_code').on(table.code),
  ]
);

export const groupMembers = pgTable(
  'group_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    group_id: uuid('group_id')
      .references(() => groups.id, { onDelete: 'cascade' })
      .notNull(),
    user_id: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    is_admin: boolean('is_admin').default(false),
    joined_at: timestamp('joined_at', { mode: 'string', withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex('group_members_group_id_user_id_unique').on(table.group_id, table.user_id),
    index('idx_group_members_group').on(table.group_id),
    index('idx_group_members_user').on(table.user_id),
  ]
);

export const rotationOrder = pgTable(
  'rotation_order',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    group_id: uuid('group_id')
      .references(() => groups.id, { onDelete: 'cascade' })
      .notNull(),
    user_id: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    position: integer('position').notNull(),
  },
  (table) => [
    uniqueIndex('rotation_order_group_id_user_id_unique').on(table.group_id, table.user_id),
    index('idx_rotation_group').on(table.group_id),
  ]
);

export const contributions = pgTable(
  'contributions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    group_id: uuid('group_id')
      .references(() => groups.id, { onDelete: 'cascade' })
      .notNull(),
    user_id: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    month: integer('month').notNull(),
    year: integer('year').notNull(),
    paid: boolean('paid').default(false),
    paid_at: timestamp('paid_at', { mode: 'string', withTimezone: true }),
    marked_by: uuid('marked_by').references(() => users.id),
    created_at: timestamp('created_at', { mode: 'string', withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex('contributions_group_id_user_id_month_year_unique').on(
      table.group_id,
      table.user_id,
      table.month,
      table.year
    ),
    index('idx_contributions_lookup').on(table.group_id, table.month, table.year),
    check('month_check', sql`${table.month} >= 0 AND ${table.month} <= 11`),
  ]
);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    user_id: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    token: text('token').notNull().unique(),
    expires_at: timestamp('expires_at', { mode: 'string', withTimezone: true }).notNull(),
    used: boolean('used').default(false),
    created_at: timestamp('created_at', { mode: 'string', withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_reset_token').on(table.token),
  ]
);
