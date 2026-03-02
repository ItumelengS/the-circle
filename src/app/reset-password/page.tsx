'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { resetPassword } from '@/lib/actions';
import Link from 'next/link';
import { Suspense } from 'react';

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError('');
    setLoading(true);
    formData.set('token', token);
    try {
      const result = await resetPassword(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-sm opacity-50 mb-4">Invalid reset link.</p>
        <Link href="/forgot-password" className="btn-primary inline-block">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <>
      {success ? (
        <div className="text-center">
          <p className="text-3xl mb-4">✅</p>
          <p className="mb-2 font-medium">Password updated</p>
          <p className="text-sm opacity-50 mb-6">
            Your password has been reset. You can now sign in.
          </p>
          <Link href="/login" className="btn-primary inline-block">
            Sign In
          </Link>
        </div>
      ) : (
        <form action={handleSubmit} className="flex flex-col gap-4">
          <p className="text-sm opacity-50">Enter your new password.</p>
          <input
            name="password"
            type="password"
            placeholder="New password"
            required
            minLength={6}
            className="input-field"
          />
          <input
            name="confirm"
            type="password"
            placeholder="Confirm new password"
            required
            minLength={6}
            className="input-field"
          />

          {error && (
            <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 fade-in">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center mb-2" style={{ color: 'var(--gold)' }}>
          Stokfela
        </h1>
        <p className="text-center opacity-50 mb-8">Set a new password</p>

        <div className="glass p-6">
          <Suspense fallback={<p className="text-center opacity-50">Loading...</p>}>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
