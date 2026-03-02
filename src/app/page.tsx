import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect('/dashboard');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center fade-in">
      <div className="max-w-md">
        <h1 className="text-5xl font-bold mb-2" style={{ color: 'var(--gold)' }}>
          Stokfela
        </h1>
        <p className="text-lg opacity-60 mb-8 tracking-widest uppercase">
          Rotation Society
        </p>
        <p className="text-base opacity-50 mb-12 leading-relaxed">
          Create or join a stokvel savings group. Each month, everyone contributes
          and one member takes the pot. Simple, transparent, and fair.
        </p>
        <Link href="/login" className="btn-primary inline-block text-lg">
          Get Started
        </Link>
      </div>
    </div>
  );
}
