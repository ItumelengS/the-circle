'use client';

import { useState } from 'react';
import { login, register } from '@/lib/actions';
import { signIn } from 'next-auth/react';
import Link from 'next/link';

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

  function handleGoogle() {
    signIn('google', { callbackUrl: '/dashboard' });
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
          {/* Google Sign-In */}
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl mb-4 font-medium transition-colors"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <span className="text-xs opacity-30">or</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
          </div>

          {/* Email/Password Toggle */}
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

            {mode === 'login' && (
              <Link href="/forgot-password" className="text-sm text-center opacity-50 hover:opacity-80">
                Forgot your password?
              </Link>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
