'use client';

import { useState, useTransition } from 'react';
import {
  toggleContribution,
  updateGroupAmount,
  updateRotationOrder,
  removeMember,
  updateMemberProfile,
  deleteGroup,
} from '@/lib/actions';
import { MONTHS } from '@/lib/types';
import BankFields from '@/components/BankFields';
import type { GroupDetails, MemberWithDetails, RotationOrder } from '@/lib/types';
import Link from 'next/link';

type Tab = 'home' | 'track' | 'order';

export default function GroupView({ data }: { data: GroupDetails }) {
  const { group, members, rotation, contributions, is_admin, current_user_id } = data;
  const isSavings = group.group_type === 'savings';
  const availableTabs: Tab[] = isSavings ? ['home', 'track'] : ['home', 'track', 'order'];
  const [tab, setTab] = useState<Tab>('home');
  const [isPending, startTransition] = useTransition();

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Current recipient based on rotation (rotation groups only)
  const recipientIndex = rotation.length > 0 ? currentMonth % rotation.length : -1;
  const recipientUserId = rotation[recipientIndex]?.user_id;
  const recipient = isSavings ? undefined : members.find((m) => m.user_id === recipientUserId);

  // Paid count for current month
  const paidThisMonth = contributions.filter(
    (c) => c.month === currentMonth && c.year === currentYear && c.paid
  );

  function isUserPaid(userId: string, month: number) {
    return contributions.some(
      (c) => c.user_id === userId && c.month === month && c.year === currentYear && c.paid
    );
  }

  function getRecipientForMonth(month: number): MemberWithDetails | undefined {
    if (isSavings || rotation.length === 0) return undefined;
    const idx = month % rotation.length;
    return members.find((m) => m.user_id === rotation[idx]?.user_id);
  }

  function handleToggle(targetUserId: string, month: number, currentlyPaid: boolean) {
    startTransition(() => {
      toggleContribution(group.id, targetUserId, month, currentYear, !currentlyPaid);
    });
  }

  const maskAccount = (acc: string | null) => {
    if (!acc) return '';
    return '••' + acc.slice(-4);
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/dashboard" className="text-sm opacity-50 hover:opacity-80">
          ← Back
        </Link>
        <div className="text-center">
          <span className="text-xl">{group.icon}</span>
          <h1 className="text-lg font-bold">{group.name}</h1>
        </div>
        <div className="w-12" />
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden mb-6" style={{ border: '1px solid var(--glass-border)' }}>
        {availableTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2.5 text-sm font-medium transition-colors capitalize"
            style={{
              background: tab === t ? 'var(--gold)' : 'transparent',
              color: tab === t ? '#0A0A0C' : 'var(--text)',
            }}
          >
            {t === 'home' ? 'Home' : t === 'track' ? 'Track' : 'Order'}
          </button>
        ))}
      </div>

      {tab === 'home' && (
        isSavings ? (
          <SavingsHomeTab
            group={group}
            members={members}
            contributions={contributions}
            is_admin={is_admin}
            current_user_id={current_user_id}
            currentMonth={currentMonth}
            currentYear={currentYear}
            paidCount={paidThisMonth.length}
            isUserPaid={isUserPaid}
            handleToggle={handleToggle}
            isPending={isPending}
            startTransition={startTransition}
          />
        ) : (
          <HomeTab
            group={group}
            members={members}
            rotation={rotation}
            contributions={contributions}
            is_admin={is_admin}
            current_user_id={current_user_id}
            currentMonth={currentMonth}
            currentYear={currentYear}
            recipient={recipient}
            paidCount={paidThisMonth.length}
            isUserPaid={isUserPaid}
            getRecipientForMonth={getRecipientForMonth}
            handleToggle={handleToggle}
            isPending={isPending}
            startTransition={startTransition}
          />
        )
      )}

      {tab === 'track' && (
        <TrackTab
          group={group}
          members={members}
          rotation={rotation}
          currentMonth={currentMonth}
          currentYear={currentYear}
          isUserPaid={isUserPaid}
          getRecipientForMonth={getRecipientForMonth}
          handleToggle={handleToggle}
          isPending={isPending}
          isSavings={isSavings}
        />
      )}

      {tab === 'order' && !isSavings && (
        <OrderTab
          group={group}
          members={members}
          rotation={rotation}
          is_admin={is_admin}
          currentMonth={currentMonth}
          startTransition={startTransition}
        />
      )}
    </div>
  );
}

// =============================================
// SAVINGS HOME TAB
// =============================================

function SavingsHomeTab({
  group,
  members,
  is_admin,
  current_user_id,
  currentMonth,
  currentYear,
  paidCount,
  isUserPaid,
  handleToggle,
  isPending,
  startTransition,
}: {
  group: GroupDetails['group'];
  members: MemberWithDetails[];
  contributions: GroupDetails['contributions'];
  is_admin: boolean;
  current_user_id: string;
  currentMonth: number;
  currentYear: number;
  paidCount: number;
  isUserPaid: (userId: string, month: number) => boolean;
  handleToggle: (userId: string, month: number, paid: boolean) => void;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [editAmount, setEditAmount] = useState(false);
  const [amountVal, setAmountVal] = useState(group.monthly_amount);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const payoutMonths = group.payout_months || 12;
  const startDate = group.start_date ? new Date(group.start_date) : new Date(group.created_at);

  // Calculate months elapsed since start
  const monthsElapsed = (currentYear - startDate.getFullYear()) * 12 + (currentMonth - startDate.getMonth());
  const monthsRemaining = Math.max(0, payoutMonths - monthsElapsed);

  // Calculate payout date
  const payoutDate = new Date(startDate);
  payoutDate.setMonth(payoutDate.getMonth() + payoutMonths);

  // Total paid contributions across all months
  let totalPaidContributions = 0;
  for (let m = 0; m < 12; m++) {
    for (const member of members) {
      if (isUserPaid(member.user_id, m)) totalPaidContributions++;
    }
  }
  const totalSaved = totalPaidContributions * group.monthly_amount;
  const target = payoutMonths * members.length * group.monthly_amount;
  const progressPercent = target > 0 ? Math.min(100, Math.round((totalSaved / target) * 100)) : 0;
  const equalShare = members.length > 0 ? Math.floor(totalSaved / members.length) : 0;

  function copyCode() {
    navigator.clipboard.writeText(group.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function saveAmount() {
    startTransition(() => {
      updateGroupAmount(group.id, amountVal);
    });
    setEditAmount(false);
  }

  function handleRemove(targetUserId: string) {
    if (!confirm(targetUserId === current_user_id ? 'Leave this group?' : 'Remove this member?')) return;
    startTransition(() => {
      removeMember(group.id, targetUserId);
    });
  }

  function handleDelete() {
    if (!confirm('Delete this group? This cannot be undone.')) return;
    startTransition(() => {
      deleteGroup(group.id);
    });
  }

  function memberPaidCount(userId: string) {
    let count = 0;
    for (let m = 0; m < 12; m++) {
      if (isUserPaid(userId, m)) count++;
    }
    return count;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Invite code banner */}
      <div className="glass p-4 flex items-center justify-between">
        <div>
          <p className="text-xs opacity-50 mb-1">Invite Code</p>
          <p className="font-mono text-xl tracking-[0.3em] font-bold" style={{ color: 'var(--gold)' }}>
            {group.code}
          </p>
        </div>
        <button onClick={copyCode} className="btn-ghost text-sm">
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Total saved & target */}
      <div className="glass p-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-xs opacity-50 mb-1">Total Saved</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--green)' }}>
              R{totalSaved.toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-50 mb-1">Target</p>
            <p className="text-xl font-bold" style={{ color: 'var(--gold)' }}>
              R{target.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-3 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%`, background: 'var(--green)' }}
          />
        </div>
        <p className="text-xs opacity-40 text-center">{progressPercent}% of target</p>
      </div>

      {/* Payout info */}
      <div className="glass p-4 flex items-center justify-between">
        <div>
          <p className="text-xs opacity-50 mb-1">Payout Date</p>
          <p className="text-sm font-medium">
            {payoutDate.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs opacity-50 mb-1">Months Remaining</p>
          <p className="text-lg font-bold" style={{ color: 'var(--gold)' }}>{monthsRemaining}</p>
        </div>
      </div>

      {/* Equal share */}
      <div className="glass p-4 flex items-center justify-between">
        <div>
          <p className="text-xs opacity-50 mb-1">Each Member&apos;s Share</p>
          <p className="text-lg font-bold">R{equalShare.toLocaleString()}</p>
        </div>
        <p className="text-xs opacity-40">{members.length} members</p>
      </div>

      {/* This month's status */}
      <div className="glass p-4 flex items-center justify-between">
        <div>
          <p className="text-xs opacity-50 mb-1">{MONTHS[currentMonth]} {currentYear}</p>
          <p className="text-sm opacity-70">{paidCount}/{members.length} paid</p>
        </div>
        <div className="h-2 rounded-full overflow-hidden flex-1 mx-4" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${members.length > 0 ? Math.round((paidCount / members.length) * 100) : 0}%`,
              background: 'var(--green)',
            }}
          />
        </div>
      </div>

      {/* Monthly contribution */}
      <div className="glass p-4 flex items-center justify-between">
        <div>
          <p className="text-xs opacity-50 mb-1">Monthly Contribution</p>
          {editAmount ? (
            <div className="flex items-center gap-2">
              <span className="font-bold">R</span>
              <input
                type="number"
                value={amountVal}
                onChange={(e) => setAmountVal(parseInt(e.target.value) || 0)}
                className="input-field w-24 py-1 px-2 text-sm"
              />
              <button onClick={saveAmount} className="btn-ghost text-xs">Save</button>
              <button onClick={() => setEditAmount(false)} className="text-xs opacity-50">Cancel</button>
            </div>
          ) : (
            <p className="text-lg font-bold">R{group.monthly_amount.toLocaleString()}</p>
          )}
        </div>
        {is_admin && !editAmount && (
          <button onClick={() => setEditAmount(true)} className="btn-ghost text-xs">Edit</button>
        )}
      </div>

      {/* Members list */}
      <div className="glass p-4">
        <p className="text-sm font-medium opacity-70 mb-3">Members ({members.length})</p>
        <div className="flex flex-col gap-2">
          {members.map((member) => {
            const paid = isUserPaid(member.user_id, currentMonth);
            const isExpanded = expandedMember === member.user_id;
            const isEditing = editingMember === member.user_id;

            return (
              <div key={member.user_id}>
                <div
                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedMember(isExpanded ? null : member.user_id)}
                >
                  <span className="text-xl">{member.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">{member.name}</p>
                      {member.is_admin && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--gold)', color: '#0A0A0C' }}>
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-xs opacity-40">
                      {member.bank ? `${member.bank} ${maskAccount(member.acc_num)}` : 'No bank details'}
                      {' · '}{memberPaidCount(member.user_id)}/12 paid
                    </p>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(member.user_id, currentMonth, paid);
                    }}
                    disabled={isPending}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all"
                    style={{
                      background: paid ? 'var(--green)' : 'rgba(255,255,255,0.06)',
                      color: paid ? '#0A0A0C' : 'rgba(255,255,255,0.3)',
                    }}
                  >
                    ✓
                  </button>
                </div>

                {isExpanded && (
                  <div className="ml-10 mr-2 mb-2 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    {isEditing && member.user_id === current_user_id ? (
                      <form
                        action={(formData) => {
                          formData.set('group_id', group.id);
                          startTransition(() => {
                            updateMemberProfile(formData);
                          });
                          setEditingMember(null);
                        }}
                        className="flex flex-col gap-3"
                      >
                        <input name="name" defaultValue={member.name || ''} placeholder="Name" className="input-field text-sm" />
                        <BankFields
                          bank={member.bank}
                          accNum={member.acc_num}
                          accType={member.acc_type}
                          branch={member.branch}
                          phone={member.phone}
                        />
                        <div className="flex gap-2">
                          <button type="submit" className="btn-primary text-xs py-2 px-4">Save</button>
                          <button type="button" onClick={() => setEditingMember(null)} className="btn-ghost text-xs">Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        {member.bank ? (
                          <div className="text-sm flex flex-col gap-1 mb-3">
                            <p><span className="opacity-50">Bank:</span> {member.bank}</p>
                            <p><span className="opacity-50">Type:</span> {member.acc_type}</p>
                            <p className="font-mono"><span className="opacity-50">Acc:</span> {member.acc_num}</p>
                            {member.branch && <p><span className="opacity-50">Branch:</span> {member.branch}</p>}
                            {member.phone && <p><span className="opacity-50">Phone:</span> {member.phone}</p>}
                          </div>
                        ) : (
                          <p className="text-sm opacity-50 mb-3">No banking details</p>
                        )}
                        <div className="flex gap-2">
                          {member.user_id === current_user_id && (
                            <button onClick={() => setEditingMember(member.user_id)} className="btn-ghost text-xs">
                              Edit Details
                            </button>
                          )}
                          {(is_admin && member.user_id !== current_user_id) && (
                            <button
                              onClick={() => handleRemove(member.user_id)}
                              className="btn-ghost text-xs"
                              style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
                            >
                              Remove
                            </button>
                          )}
                          {member.user_id === current_user_id && !member.is_admin && (
                            <button
                              onClick={() => handleRemove(current_user_id)}
                              className="btn-ghost text-xs"
                              style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
                            >
                              Leave Group
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete group (admin only) */}
      {is_admin && (
        <button
          onClick={handleDelete}
          className="btn-ghost w-full text-sm"
          style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
        >
          Delete Group
        </button>
      )}
    </div>
  );
}

// =============================================
// HOME TAB
// =============================================

function HomeTab({
  group,
  members,
  rotation,
  is_admin,
  current_user_id,
  currentMonth,
  currentYear,
  recipient,
  paidCount,
  isUserPaid,
  getRecipientForMonth,
  handleToggle,
  isPending,
  startTransition,
}: {
  group: GroupDetails['group'];
  members: MemberWithDetails[];
  rotation: RotationOrder[];
  contributions: GroupDetails['contributions'];
  is_admin: boolean;
  current_user_id: string;
  currentMonth: number;
  currentYear: number;
  recipient?: MemberWithDetails;
  paidCount: number;
  isUserPaid: (userId: string, month: number) => boolean;
  getRecipientForMonth: (month: number) => MemberWithDetails | undefined;
  handleToggle: (userId: string, month: number, paid: boolean) => void;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [showBank, setShowBank] = useState(false);
  const [editAmount, setEditAmount] = useState(false);
  const [amountVal, setAmountVal] = useState(group.monthly_amount);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const potTotal = group.monthly_amount * members.length;
  const paidPercent = members.length > 0 ? Math.round((paidCount / members.length) * 100) : 0;

  function copyCode() {
    navigator.clipboard.writeText(group.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function saveAmount() {
    startTransition(() => {
      updateGroupAmount(group.id, amountVal);
    });
    setEditAmount(false);
  }

  function handleRemove(targetUserId: string) {
    if (!confirm(targetUserId === current_user_id ? 'Leave this group?' : 'Remove this member?')) return;
    startTransition(() => {
      removeMember(group.id, targetUserId);
    });
  }

  function handleDelete() {
    if (!confirm('Delete this group? This cannot be undone.')) return;
    startTransition(() => {
      deleteGroup(group.id);
    });
  }

  // Count paid months for a member
  function memberPaidCount(userId: string) {
    let count = 0;
    for (let m = 0; m < 12; m++) {
      if (isUserPaid(userId, m)) count++;
    }
    return count;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Invite code banner */}
      <div className="glass p-4 flex items-center justify-between">
        <div>
          <p className="text-xs opacity-50 mb-1">Invite Code</p>
          <p className="font-mono text-xl tracking-[0.3em] font-bold" style={{ color: 'var(--gold)' }}>
            {group.code}
          </p>
        </div>
        <button onClick={copyCode} className="btn-ghost text-sm">
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* This month's card */}
      <div className="glass p-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-sm opacity-50">{MONTHS[currentMonth]} {currentYear}</p>
            <p className="text-sm opacity-70">{paidCount}/{members.length} paid</p>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-50">Pot Total</p>
            <p className="text-xl font-bold" style={{ color: 'var(--gold)' }}>
              R{potTotal.toLocaleString()}
            </p>
          </div>
        </div>

        {recipient && (
          <div className="flex items-center gap-3 mb-4 p-3 rounded-xl" style={{ background: 'rgba(232,197,71,0.08)' }}>
            <span className="text-3xl">{recipient.avatar}</span>
            <div className="flex-1">
              <p className="font-semibold">{recipient.name}</p>
              <p className="text-xs opacity-50">This month&apos;s recipient</p>
            </div>
            <p className="font-bold" style={{ color: 'var(--gold)' }}>R{potTotal.toLocaleString()}</p>
          </div>
        )}

        {recipient && (
          <button
            onClick={() => setShowBank(!showBank)}
            className="text-xs underline opacity-50 hover:opacity-80 mb-3"
          >
            {showBank ? 'Hide' : 'Show'} Banking Details
          </button>
        )}

        {showBank && recipient && (
          <div className="p-3 rounded-lg mb-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
            {recipient.bank ? (
              <div className="text-sm flex flex-col gap-1">
                <p><span className="opacity-50">Bank:</span> {recipient.bank}</p>
                <p><span className="opacity-50">Type:</span> {recipient.acc_type}</p>
                <p className="font-mono"><span className="opacity-50">Acc:</span> {recipient.acc_num}</p>
                {recipient.branch && <p><span className="opacity-50">Branch:</span> {recipient.branch}</p>}
                {recipient.phone && <p><span className="opacity-50">Phone:</span> {recipient.phone}</p>}
              </div>
            ) : (
              <p className="text-sm opacity-50">No banking details added yet</p>
            )}
          </div>
        )}

        {/* Progress bar */}
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${paidPercent}%`, background: 'var(--green)' }}
          />
        </div>
      </div>

      {/* Monthly contribution */}
      <div className="glass p-4 flex items-center justify-between">
        <div>
          <p className="text-xs opacity-50 mb-1">Monthly Contribution</p>
          {editAmount ? (
            <div className="flex items-center gap-2">
              <span className="font-bold">R</span>
              <input
                type="number"
                value={amountVal}
                onChange={(e) => setAmountVal(parseInt(e.target.value) || 0)}
                className="input-field w-24 py-1 px-2 text-sm"
              />
              <button onClick={saveAmount} className="btn-ghost text-xs">Save</button>
              <button onClick={() => setEditAmount(false)} className="text-xs opacity-50">Cancel</button>
            </div>
          ) : (
            <p className="text-lg font-bold">R{group.monthly_amount.toLocaleString()}</p>
          )}
        </div>
        {is_admin && !editAmount && (
          <button onClick={() => setEditAmount(true)} className="btn-ghost text-xs">Edit</button>
        )}
      </div>

      {/* Members list */}
      <div className="glass p-4">
        <p className="text-sm font-medium opacity-70 mb-3">Members ({members.length})</p>
        <div className="flex flex-col gap-2">
          {members.map((member) => {
            const paid = isUserPaid(member.user_id, currentMonth);
            const isRecipient = member.user_id === recipient?.user_id;
            const isExpanded = expandedMember === member.user_id;
            const isEditing = editingMember === member.user_id;

            return (
              <div key={member.user_id}>
                <div
                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedMember(isExpanded ? null : member.user_id)}
                >
                  <span className="text-xl">{member.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">{member.name}</p>
                      {member.is_admin && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--gold)', color: '#0A0A0C' }}>
                          Admin
                        </span>
                      )}
                      {isRecipient && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--green)', color: '#0A0A0C' }}>
                          Recipient
                        </span>
                      )}
                    </div>
                    <p className="text-xs opacity-40">
                      {member.bank ? `${member.bank} ${maskAccount(member.acc_num)}` : 'No bank details'}
                      {' · '}{memberPaidCount(member.user_id)}/12 paid
                    </p>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(member.user_id, currentMonth, paid);
                    }}
                    disabled={isPending}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all"
                    style={{
                      background: paid ? 'var(--green)' : 'rgba(255,255,255,0.06)',
                      color: paid ? '#0A0A0C' : 'rgba(255,255,255,0.3)',
                    }}
                  >
                    ✓
                  </button>
                </div>

                {isExpanded && (
                  <div className="ml-10 mr-2 mb-2 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    {isEditing && member.user_id === current_user_id ? (
                      <form
                        action={(formData) => {
                          formData.set('group_id', group.id);
                          startTransition(() => {
                            updateMemberProfile(formData);
                          });
                          setEditingMember(null);
                        }}
                        className="flex flex-col gap-3"
                      >
                        <input name="name" defaultValue={member.name || ''} placeholder="Name" className="input-field text-sm" />
                        <BankFields
                          bank={member.bank}
                          accNum={member.acc_num}
                          accType={member.acc_type}
                          branch={member.branch}
                          phone={member.phone}
                        />
                        <div className="flex gap-2">
                          <button type="submit" className="btn-primary text-xs py-2 px-4">Save</button>
                          <button type="button" onClick={() => setEditingMember(null)} className="btn-ghost text-xs">Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        {member.bank ? (
                          <div className="text-sm flex flex-col gap-1 mb-3">
                            <p><span className="opacity-50">Bank:</span> {member.bank}</p>
                            <p><span className="opacity-50">Type:</span> {member.acc_type}</p>
                            <p className="font-mono"><span className="opacity-50">Acc:</span> {member.acc_num}</p>
                            {member.branch && <p><span className="opacity-50">Branch:</span> {member.branch}</p>}
                            {member.phone && <p><span className="opacity-50">Phone:</span> {member.phone}</p>}
                          </div>
                        ) : (
                          <p className="text-sm opacity-50 mb-3">No banking details</p>
                        )}
                        <div className="flex gap-2">
                          {member.user_id === current_user_id && (
                            <button onClick={() => setEditingMember(member.user_id)} className="btn-ghost text-xs">
                              Edit Details
                            </button>
                          )}
                          {(is_admin && member.user_id !== current_user_id) && (
                            <button
                              onClick={() => handleRemove(member.user_id)}
                              className="btn-ghost text-xs"
                              style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
                            >
                              Remove
                            </button>
                          )}
                          {member.user_id === current_user_id && !member.is_admin && (
                            <button
                              onClick={() => handleRemove(current_user_id)}
                              className="btn-ghost text-xs"
                              style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
                            >
                              Leave Group
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming recipients */}
      <div className="glass p-4">
        <p className="text-sm font-medium opacity-70 mb-3">Upcoming Recipients</p>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 5 }, (_, i) => {
            const month = (currentMonth + 1 + i) % 12;
            const r = getRecipientForMonth(month);
            return (
              <div key={i} className="flex-shrink-0 text-center p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', minWidth: '80px' }}>
                <p className="text-xs opacity-50 mb-1">{MONTHS[month]}</p>
                <p className="text-2xl mb-1">{r?.avatar || '?'}</p>
                <p className="text-xs truncate">{r?.name || '-'}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete group (admin only) */}
      {is_admin && (
        <button
          onClick={handleDelete}
          className="btn-ghost w-full text-sm"
          style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
        >
          Delete Group
        </button>
      )}
    </div>
  );
}

function maskAccount(acc: string | null) {
  if (!acc) return '';
  return '••' + acc.slice(-4);
}

// =============================================
// TRACK TAB
// =============================================

function TrackTab({
  group,
  members,
  rotation,
  currentMonth,
  currentYear,
  isUserPaid,
  getRecipientForMonth,
  handleToggle,
  isPending,
  isSavings = false,
}: {
  group: GroupDetails['group'];
  members: MemberWithDetails[];
  rotation: RotationOrder[];
  currentMonth: number;
  currentYear: number;
  isUserPaid: (userId: string, month: number) => boolean;
  getRecipientForMonth: (month: number) => MemberWithDetails | undefined;
  handleToggle: (userId: string, month: number, paid: boolean) => void;
  isPending: boolean;
  isSavings?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="glass p-4 overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: '600px' }}>
          <thead>
            <tr>
              <th className="text-left py-2 px-1 text-xs opacity-50 sticky left-0" style={{ background: 'var(--bg)' }}>Member</th>
              {MONTHS.map((m, i) => (
                <th
                  key={m}
                  className="py-2 px-1 text-xs text-center"
                  style={{
                    color: i === currentMonth ? 'var(--gold)' : undefined,
                    opacity: i === currentMonth ? 1 : 0.5,
                  }}
                >
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.user_id}>
                <td className="py-1 px-1 sticky left-0" style={{ background: 'var(--bg)' }}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{member.avatar}</span>
                    <span className="text-xs truncate max-w-[80px]">{member.name}</span>
                  </div>
                </td>
                {MONTHS.map((_, monthIdx) => {
                  const paid = isUserPaid(member.user_id, monthIdx);
                  const isRecipient = !isSavings && getRecipientForMonth(monthIdx)?.user_id === member.user_id;
                  const isCurrentMonth = monthIdx === currentMonth;

                  return (
                    <td key={monthIdx} className="py-1 px-1 text-center">
                      <button
                        onClick={() => handleToggle(member.user_id, monthIdx, paid)}
                        disabled={isPending}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-xs transition-all mx-auto"
                        style={{
                          background: isCurrentMonth
                            ? 'rgba(232,197,71,0.1)'
                            : 'rgba(255,255,255,0.03)',
                          border: isCurrentMonth
                            ? '1px solid rgba(232,197,71,0.2)'
                            : '1px solid transparent',
                          color: paid ? 'var(--green)' : isRecipient ? 'var(--gold)' : 'rgba(255,255,255,0.1)',
                        }}
                      >
                        {paid ? '✓' : isRecipient ? '★' : ''}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-4 justify-center text-xs opacity-50">
        <span><span style={{ color: 'var(--green)' }}>✓</span> Paid</span>
        {!isSavings && <span><span style={{ color: 'var(--gold)' }}>★</span> Recipient</span>}
        <span>Tap to toggle</span>
      </div>
    </div>
  );
}

// =============================================
// ORDER TAB
// =============================================

function OrderTab({
  group,
  members,
  rotation,
  is_admin,
  currentMonth,
  startTransition,
}: {
  group: GroupDetails['group'];
  members: MemberWithDetails[];
  rotation: RotationOrder[];
  is_admin: boolean;
  currentMonth: number;
  startTransition: (fn: () => void) => void;
}) {
  const [localOrder, setLocalOrder] = useState(rotation.map((r) => r.user_id));

  function moveUp(index: number) {
    if (index === 0) return;
    const newOrder = [...localOrder];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setLocalOrder(newOrder);
    startTransition(() => {
      updateRotationOrder(group.id, newOrder);
    });
  }

  function moveDown(index: number) {
    if (index === localOrder.length - 1) return;
    const newOrder = [...localOrder];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setLocalOrder(newOrder);
    startTransition(() => {
      updateRotationOrder(group.id, newOrder);
    });
  }

  function shuffle() {
    const newOrder = [...localOrder].sort(() => Math.random() - 0.5);
    setLocalOrder(newOrder);
    startTransition(() => {
      updateRotationOrder(group.id, newOrder);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="glass p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium opacity-70">Rotation Order</p>
          {is_admin && (
            <button onClick={shuffle} className="btn-ghost text-xs">
              🔀 Shuffle
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {localOrder.map((userId, index) => {
            const member = members.find((m) => m.user_id === userId);
            if (!member) return null;

            const receiveMonth = index % 12;
            const isNow = index === currentMonth % localOrder.length;

            return (
              <div
                key={userId}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{
                  background: isNow ? 'rgba(232,197,71,0.08)' : 'rgba(255,255,255,0.02)',
                  border: isNow ? '1px solid rgba(232,197,71,0.15)' : '1px solid transparent',
                }}
              >
                <span className="text-sm font-mono opacity-40 w-6 text-center">{index + 1}</span>
                <span className="text-xl">{member.avatar}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{member.name}</p>
                    {isNow && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'var(--gold)', color: '#0A0A0C' }}>
                        NOW
                      </span>
                    )}
                  </div>
                  <p className="text-xs opacity-40">{MONTHS[receiveMonth]}</p>
                </div>
                {is_admin && (
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveUp(index)}
                      className="text-xs opacity-30 hover:opacity-70 px-1"
                      disabled={index === 0}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveDown(index)}
                      className="text-xs opacity-30 hover:opacity-70 px-1"
                      disabled={index === localOrder.length - 1}
                    >
                      ▼
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs opacity-30 text-center mt-4">
          The order repeats cyclically
        </p>
      </div>
    </div>
  );
}
