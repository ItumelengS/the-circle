'use client';

import { useState } from 'react';
import { forgotPassword } from '@/lib/actions';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError('');
    setLoading(true);
    try {
      const result = await forgotPassword(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setSent(true);
      }
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
        <p className="text-center opacity-50 mb-8">Reset your password</p>

        <div className="glass p-6">
          {sent ? (
            <div className="text-center">
              <p className="text-3xl mb-4">✉️</p>
              <p className="mb-2 font-medium">Check your email</p>
              <p className="text-sm opacity-50 mb-6">
                If an account exists with that email, we sent a reset link. Check your inbox and spam folder.
              </p>
              <Link href="/login" className="btn-primary inline-block">
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form action={handleSubmit} className="flex flex-col gap-4">
              <p className="text-sm opacity-50">
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>
              <input
                name="email"
                type="email"
                placeholder="Email address"
                required
                className="input-field"
              />

              {error && (
                <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>

              <Link href="/login" className="text-sm text-center opacity-50 hover:opacity-80">
                Back to Sign In
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
