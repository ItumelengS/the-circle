# The Circle — Rotation Society App

A full-stack stokvel/rotation savings group app built with Next.js 14 (App Router), Supabase (Postgres + Auth), and Auth.js v5. South African focused.

---

## Overview

A "rotation society" (stokvel) is a savings group where members each contribute a fixed amount monthly, and one member receives the full pot each month on a rotating basis. This app lets anyone create a group, invite friends with a 6-character code, track monthly contributions, manage the payout rotation order, and store banking details so members know where to send money.

---

## Tech Stack

- **Framework**: Next.js 14 with App Router, TypeScript
- **Auth**: Auth.js v5 (next-auth@beta) with Google OAuth provider
- **Database**: Supabase (Postgres) using `@supabase/supabase-js` (server-side with service role key for data operations)
- **Auth Adapter**: `@auth/supabase-adapter` to store Auth.js sessions/users in Supabase
- **Styling**: Tailwind CSS with a dark luxury aesthetic
- **Deployment target**: Vercel

---

## Database Schema (Supabase SQL)

Run this in the Supabase SQL Editor. Auth.js adapter auto-manages `users`, `accounts`, `sessions`, `verification_tokens` tables but we define them explicitly alongside our app tables.

```sql
create extension if not exists "uuid-ossp";

-- =============================================
-- AUTH.JS ADAPTER TABLES
-- =============================================
create table public.users (
  id uuid default uuid_generate_v4() primary key,
  name text,
  email text unique,
  password text,
  "emailVerified" timestamptz,
  image text
);

create table public.accounts (
  id uuid default uuid_generate_v4() primary key,
  "userId" uuid not null references public.users(id) on delete cascade,
  type text not null,
  provider text not null,
  "providerAccountId" text not null,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text
);

create table public.sessions (
  id uuid default uuid_generate_v4() primary key,
  "sessionToken" text not null unique,
  "userId" uuid not null references public.users(id) on delete cascade,
  expires timestamptz not null
);

create table public.verification_tokens (
  identifier text not null,
  token text not null unique,
  expires timestamptz not null,
  primary key (identifier, token)
);

-- =============================================
-- APP TABLES
-- =============================================

-- Extended profile (bank details, avatar, colour)
create table public.profiles (
  user_id uuid references public.users(id) on delete cascade primary key,
  avatar text default '😎',
  color text default '#E8C547',
  bank text,
  acc_num text,
  acc_type text,
  branch text,
  phone text,
  updated_at timestamptz default now()
);

-- Groups (circles)
create table public.groups (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  icon text default '🔄',
  code text unique not null,
  monthly_amount integer default 500,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Group membership (junction)
create table public.group_members (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  is_admin boolean default false,
  joined_at timestamptz default now(),
  unique(group_id, user_id)
);

-- Payout rotation order
create table public.rotation_order (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  position integer not null,
  unique(group_id, user_id)
);

-- Monthly contribution tracking
create table public.contributions (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  month integer not null check (month >= 0 and month <= 11),
  year integer not null,
  paid boolean default false,
  paid_at timestamptz,
  marked_by uuid references public.users(id),
  created_at timestamptz default now(),
  unique(group_id, user_id, month, year)
);

-- Indexes
create index idx_group_members_group on public.group_members(group_id);
create index idx_group_members_user on public.group_members(user_id);
create index idx_contributions_lookup on public.contributions(group_id, month, year);
create index idx_rotation_group on public.rotation_order(group_id);
create index idx_groups_code on public.groups(code);

-- Helper: generate unique 6-char invite code
create or replace function public.generate_group_code()
returns text as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
begin
  loop
    result := '';
    for i in 1..6 loop
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    end loop;
    if not exists (select 1 from public.groups where code = result) then
      return result;
    end if;
  end loop;
end;
$$ language plpgsql;
```

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Auth.js
AUTH_SECRET=generate-with-npx-auth-secret
AUTH_URL=http://localhost:3000

# Google OAuth (set up in Google Cloud Console, add callback URL to Supabase Auth > Providers)
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret
```

---

## Auth Setup

### `src/lib/auth.ts`
- Use Auth.js v5 (`next-auth@beta`)
- Provider: `Google`
- Adapter: `@auth/supabase-adapter` configured with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Custom sign-in page at `/login`
- In the `session` callback, attach `user.id` to `session.user.id`

### `src/app/api/auth/[...nextauth]/route.ts`
- Export `GET` and `POST` from `handlers`

### `src/middleware.ts`
- Protect routes: `/dashboard`, `/create`, `/join`, `/group/:path*`
- Use Auth.js middleware export

---

## Supabase Client

### `src/lib/supabase.ts`
- `createServerClient()` — uses `SUPABASE_SERVICE_ROLE_KEY`, `persistSession: false` (for server actions, bypasses RLS)
- `createBrowserClient()` — uses anon key (optional, for client-side if needed)

All data operations go through server actions using the service role client.

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout, fonts, background
│   ├── page.tsx                # Landing page (redirect to /dashboard if logged in)
│   ├── globals.css             # Tailwind + custom styles
│   ├── login/page.tsx          # Google OAuth sign-in
│   ├── dashboard/page.tsx      # List of user's groups + create/join buttons
│   ├── create/page.tsx         # Create group form (client component)
│   ├── join/page.tsx           # Join group form (client component)
│   ├── group/[id]/page.tsx     # Group detail (server component → fetches data → passes to client)
│   └── api/auth/[...nextauth]/route.ts
├── components/
│   ├── GroupView.tsx           # Main group UI (dashboard/tracker/order tabs)
│   └── BankFields.tsx          # Reusable bank details form fields
├── lib/
│   ├── auth.ts                 # Auth.js config
│   ├── supabase.ts             # Supabase clients
│   ├── actions.ts              # All server actions
│   └── types.ts                # TypeScript types + constants
└── middleware.ts
```

---

## Server Actions (`src/lib/actions.ts`)

All data mutations use Next.js server actions with `"use server"`. Each action:
1. Gets the authenticated user via `auth()`
2. Creates a Supabase server client
3. Verifies membership/admin permissions where needed
4. Mutates data
5. Calls `revalidatePath` or `redirect`

### Profile
- `getProfile()` — get current user's profile row
- `upsertProfile(formData)` — create/update profile (avatar, color, bank details) + update name in users table
- `updateMemberProfile(formData)` — same but also accepts `group_id` for revalidation

### Groups
- `getUserGroups()` — returns all groups the user belongs to, with member counts and admin status
- `createGroup(formData)` — creates group, generates code via `generate_group_code()` RPC, adds creator as admin member at rotation position 0, upserts their profile, redirects to `/group/[id]`
- `joinGroup(formData)` — finds group by code, checks for duplicates, adds member at next rotation position, upserts profile, redirects. Returns `{ error }` if code not found or already a member.
- `getGroupDetails(groupId)` — returns full group data: group info, members (joined with users + profiles tables), rotation order, contributions for current year, plus `is_admin` and `current_user_id`
- `deleteGroup(groupId)` — admin only, deletes group and redirects

### Contributions
- `toggleContribution(groupId, targetUserId, month, year, paid)` — any member can mark anyone as paid/unpaid. Uses upsert with `onConflict` for paid=true, deletes row for paid=false. Records `marked_by` and `paid_at`.

### Group Management
- `updateGroupAmount(groupId, amount)` — admin only
- `updateRotationOrder(groupId, orderedUserIds)` — admin only, deletes all existing rotation rows and reinserts with new positions
- `removeMember(groupId, targetUserId)` — admin can remove anyone, members can remove themselves. Also removes from rotation_order and re-sequences remaining positions.

---

## Pages & Components Detail

### Landing Page (`/`)
- If logged in → redirect to `/dashboard`
- Shows app name "The Circle", tagline "Rotation Society", brief description, and "Get Started" button → `/login`

### Login (`/login`)
- If logged in → redirect to `/dashboard`
- Single "Continue with Google" button using Auth.js server action `signIn("google", { redirectTo: "/dashboard" })`

### Dashboard (`/dashboard`)
- Server component
- Shows user name + sign out button
- "Create a New Group" and "Join with Invite Code" buttons
- List of user's groups (from `getUserGroups()`) — each card shows icon, name, member count, monthly amount, admin badge. Links to `/group/[id]`
- Empty state if no groups

### Create Group (`/create`)
- Client component with form state
- Fields: Group name, group icon picker (emoji grid), monthly amount (Rands)
- Profile section: emoji picker, colour picker
- Banking section: bank selector (SA banks: ABSA, Capitec, FNB, Nedbank, Standard Bank, TymeBank, African Bank, Discovery Bank, Investec, Other), account number, account type (Savings/Cheque/Current/Transmission), branch code (optional), phone/reference (optional)
- Submit calls `createGroup` server action

### Join Group (`/join`)
- Client component
- Invite code input (centered, large monospace, uppercase, 6 chars max)
- Error message display
- Profile section (emoji, colour) + banking details
- Submit calls `joinGroup` server action

### Group Detail (`/group/[id]`)
- Server component fetches via `getGroupDetails(id)`, passes to `<GroupView>` client component
- If not a member → redirect to `/dashboard`

### GroupView Component
Three tab views: **Home**, **Track**, **Order**

#### Home (Dashboard) Tab
- **Invite code banner**: shows the 6-char code in monospace with a "Copy" button
- **This month's card**: Shows current month/year, paid count (X/Y), pot total (monthly × members). Displays the current recipient (based on rotation order: `rotation[currentMonth % rotation.length]`) with their avatar, name, and payout amount. Has a "Show Banking Details" toggle that reveals the recipient's full bank info (bank, account type, account number, branch, phone). If no bank details, shows "No banking details added yet". Progress bar showing % paid.
- **Monthly contribution card**: Displays amount with edit button (admin only). Inline edit with input + save.
- **Members list**: Each member row shows avatar, name, admin badge, recipient badge, bank summary (e.g. "Capitec ••1234"), paid months count. Tap the checkmark to toggle this month's payment. Tap the row to expand and see full bank details + "Edit Details" / "Remove" buttons. Edit opens inline form with name + BankFields component. Remove button (admin can remove others, anyone can leave).
- **Upcoming recipients**: Horizontal scroll of next 5 months showing month name, recipient avatar and name.

#### Track Tab
- Full 12-month grid (horizontally scrollable on mobile)
- Rows = members, columns = months (Jan–Dec)
- Current month column highlighted in gold
- Each cell is a tappable button: ✓ if paid (green), ★ if that member is the recipient for that month, empty otherwise
- Tap to toggle paid/unpaid (calls `toggleContribution`)
- Legend below: ✓ = Paid, ★ = Recipient, Tap to toggle

#### Order Tab
- Shows the rotation order as a numbered list
- Each row: position number, member avatar, name, which month they receive, "NOW" badge for current recipient
- Up/down arrow buttons to reorder (admin only, calls `updateRotationOrder`)
- "Shuffle" button for random order (admin only)
- Note: "The order repeats cyclically"

---

## Design System

Dark luxury aesthetic. Mobile-first (max-width ~480px centered).

### Colors
- Background: `#0A0A0C` (near-black)
- Text: `#F0EDE6` (warm cream)
- Primary accent: `#E8C547` (gold)
- Secondary accent: `#47B5E8` (blue, used for join flow)
- Success: `#47E88C` (green, paid indicators)
- Error: `#E85C47` (red)
- Glass surfaces: `rgba(255,255,255,0.04)` with `border: 1px solid rgba(255,255,255,0.08)` and `backdrop-filter: blur(20px)`

### Typography
- Display/headings: `Playfair Display` (serif, Google Fonts)
- Body: `DM Sans` (Google Fonts)
- Monospace for codes and account numbers

### Component Patterns
- `.glass` — frosted glass cards
- `.btn-primary` — gold gradient button
- `.btn-secondary` — subtle bordered button
- `.btn-ghost` — transparent bordered button
- `.input-field` — dark input with gold focus border
- Fade-in animations on page transitions
- Subtle background gradient blobs (radial gradients, fixed position, low opacity)

### Member Colors
Each member picks a colour from: `#E8C547`, `#47B5E8`, `#E85C47`, `#47E88C`, `#B547E8`, `#E8479A`, `#47E8D4`, `#E89447`

### Member Avatars (Emojis)
Pick from: 😎 🤩 🫡 🧑‍🎤 🦁 🌟 💎 🔥 🎯 🪩 🏆 🎲 🌈 🦅 🐝 🎸

### Group Icons
Pick from: 🔄 💰 🤝 🌀 ⭐ 🎯 💎 🪙 🏦 🎪

### South African Banks
ABSA, Capitec, FNB, Nedbank, Standard Bank, TymeBank, African Bank, Discovery Bank, Investec, Other

### Account Types
Savings, Cheque, Current, Transmission

---

## Key Dependencies

```json
{
  "next": "^14.2.0",
  "react": "^18.3.0",
  "react-dom": "^18.3.0",
  "next-auth": "5.0.0-beta.25",
  "@auth/supabase-adapter": "^1.7.0",
  "@supabase/supabase-js": "^2.47.0",
  "tailwindcss": "^3.4.0",
  "typescript": "^5.5.0"
}
```

---

## Currency

All monetary values are in South African Rands (ZAR). Display as `R500`, `R1,000`, etc. Use `R` prefix, no decimals. The default monthly contribution is R500.

---

## Permissions Summary

| Action | Who can do it |
|---|---|
| Create group | Any logged-in user |
| Join group with code | Any logged-in user |
| View group data | Members only |
| Mark contributions paid/unpaid | Any member |
| Edit monthly amount | Admin only |
| Edit rotation order | Admin only |
| Shuffle rotation | Admin only |
| Remove other members | Admin only |
| Leave group (remove self) | Any member |
| Delete group | Admin only |
| Edit own profile/bank details | Any member |

The group creator is automatically the admin.

---

## Build & Run

```bash
npm install
# Copy .env.example to .env.local and fill in values
# Run the SQL schema in Supabase SQL Editor
# Set up Google OAuth in Google Cloud Console
# Add authorized redirect URI: http://localhost:3000/api/auth/callback/google
npm run dev
```
