'use client';

import { useState } from 'react';
import { createGroup } from '@/lib/actions';
import { MEMBER_AVATARS, MEMBER_COLORS, GROUP_ICONS } from '@/lib/types';
import BankFields from '@/components/BankFields';
import Link from 'next/link';

export default function CreatePage() {
  const [icon, setIcon] = useState('🔄');
  const [avatar, setAvatar] = useState('😎');
  const [color, setColor] = useState('#E8C547');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    formData.set('icon', icon);
    formData.set('avatar', avatar);
    formData.set('color', color);
    try {
      await createGroup(formData);
    } catch {
      // redirect throws
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8 fade-in">
      <Link href="/dashboard" className="text-sm opacity-50 hover:opacity-80 mb-4 inline-block">
        ← Back
      </Link>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--gold)' }}>
        Create a New Group
      </h1>

      <form action={handleSubmit} className="flex flex-col gap-6">
        {/* Group details */}
        <div className="glass p-5 flex flex-col gap-4">
          <label className="text-sm font-medium opacity-70">Group Details</label>

          <input
            name="name"
            type="text"
            placeholder="Group name"
            required
            className="input-field"
          />

          <div>
            <label className="text-xs opacity-50 mb-2 block">Group Icon</label>
            <div className="flex flex-wrap gap-2">
              {GROUP_ICONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIcon(i)}
                  className="text-2xl p-2 rounded-lg transition-all"
                  style={{
                    background: icon === i ? 'var(--gold)' : 'rgba(255,255,255,0.04)',
                    border: icon === i ? '2px solid var(--gold)' : '2px solid transparent',
                  }}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs opacity-50 mb-1 block">Monthly Amount (Rands)</label>
            <input
              name="monthly_amount"
              type="number"
              defaultValue={500}
              min={1}
              className="input-field"
            />
          </div>
        </div>

        {/* Profile */}
        <div className="glass p-5 flex flex-col gap-4">
          <label className="text-sm font-medium opacity-70">Your Profile</label>

          <div>
            <label className="text-xs opacity-50 mb-2 block">Avatar</label>
            <div className="flex flex-wrap gap-2">
              {MEMBER_AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAvatar(a)}
                  className="text-2xl p-2 rounded-lg transition-all"
                  style={{
                    background: avatar === a ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                    border: avatar === a ? '2px solid var(--gold)' : '2px solid transparent',
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs opacity-50 mb-2 block">Colour</label>
            <div className="flex flex-wrap gap-2">
              {MEMBER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full transition-all"
                  style={{
                    background: c,
                    border: color === c ? '3px solid white' : '3px solid transparent',
                    boxShadow: color === c ? '0 0 0 2px ' + c : 'none',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Banking */}
        <div className="glass p-5">
          <BankFields />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Creating...' : 'Create Group'}
        </button>
      </form>
    </div>
  );
}
