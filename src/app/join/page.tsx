'use client';

import { useState } from 'react';
import { joinGroup } from '@/lib/actions';
import { MEMBER_AVATARS, MEMBER_COLORS } from '@/lib/types';
import BankFields from '@/components/BankFields';
import Link from 'next/link';

export default function JoinPage() {
  const [avatar, setAvatar] = useState('😎');
  const [color, setColor] = useState('#E8C547');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError('');
    setLoading(true);
    formData.set('avatar', avatar);
    formData.set('color', color);
    try {
      const result = await joinGroup(formData);
      if (result?.error) setError(result.error);
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
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--blue)' }}>
        Join a Group
      </h1>

      <form action={handleSubmit} className="flex flex-col gap-6">
        {/* Invite code */}
        <div className="glass p-5 flex flex-col items-center gap-4">
          <label className="text-sm font-medium opacity-70">Invite Code</label>
          <input
            name="code"
            type="text"
            placeholder="ABC123"
            maxLength={6}
            required
            className="input-field text-center text-2xl font-mono tracking-[0.3em] uppercase"
            style={{ maxWidth: '200px' }}
          />
          {error && (
            <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>
          )}
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
                    border: avatar === a ? '2px solid var(--blue)' : '2px solid transparent',
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

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full"
          style={{ background: loading ? undefined : 'linear-gradient(135deg, #47B5E8, #2A8BC0)' }}
        >
          {loading ? 'Joining...' : 'Join Group'}
        </button>
      </form>
    </div>
  );
}
