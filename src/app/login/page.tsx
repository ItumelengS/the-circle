'use client';

import { useState } from 'react';
import { login, register } from '@/lib/actions';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError('');
    setLoading(true);
    try {
      const result = mode === 'login'
        ? await login(formData)
        : await register(formData);
      if (result?.error) {
        setError(result.error);
      }
    } catch {
      // redirect throws — that's expected
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 fade-in">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center mb-2" style={{ color: 'var(--gold)' }}>
          Stokfela
        </h1>
        <p className="text-center opacity-50 mb-8">
          {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
        </p>

        <div className="glass p-6">
          <div className="flex mb-6 rounded-lg overflow-hidden" style={{ border: '1px solid var(--glass-border)' }}>
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className="flex-1 py-2 text-sm font-medium transition-colors"
              style={{
                background: mode === 'login' ? 'var(--gold)' : 'transparent',
                color: mode === 'login' ? '#0A0A0C' : 'var(--text)',
              }}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className="flex-1 py-2 text-sm font-medium transition-colors"
              style={{
                background: mode === 'register' ? 'var(--gold)' : 'transparent',
                color: mode === 'register' ? '#0A0A0C' : 'var(--text)',
              }}
            >
              Register
            </button>
          </div>

          <form action={handleSubmit} className="flex flex-col gap-4">
            {mode === 'register' && (
              <input
                name="name"
                type="text"
                placeholder="Full name"
                required
                className="input-field"
              />
            )}
            <input
              name="email"
              type="email"
              placeholder="Email address"
              required
              className="input-field"
            />
            <input
              name="password"
              type="password"
              placeholder="Password"
              required
              minLength={6}
              className="input-field"
            />

            {error && (
              <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
