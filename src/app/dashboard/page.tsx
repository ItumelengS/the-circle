import { auth, signOut } from '@/lib/auth';
import { getUserGroups } from '@/lib/actions';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const groups = await getUserGroups();

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8 fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--gold)' }}>
            Stokfela
          </h1>
          <p className="text-sm opacity-50">Welcome, {session.user.name || session.user.email}</p>
        </div>
        <form action={async () => {
          'use server';
          await signOut({ redirectTo: '/' });
        }}>
          <button type="submit" className="btn-ghost text-sm">
            Sign Out
          </button>
        </form>
      </div>

      <div className="flex gap-3 mb-8">
        <Link href="/create" className="btn-primary flex-1 text-center text-sm">
          Create Group
        </Link>
        <Link
          href="/join"
          className="btn-secondary flex-1 text-center text-sm"
          style={{ borderColor: 'var(--blue)', color: 'var(--blue)' }}
        >
          Join with Code
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="glass p-8 text-center">
          <p className="text-4xl mb-4">🔄</p>
          <p className="opacity-50">No groups yet. Create one or join with an invite code.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <Link key={group.id} href={`/group/${group.id}`} className="glass p-4 block hover:border-gold/20 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{group.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{group.name}</p>
                    {group.is_admin && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--gold)', color: '#0A0A0C' }}>
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-sm opacity-50">
                    {group.member_count} member{group.member_count !== 1 ? 's' : ''} &middot; R{group.monthly_amount.toLocaleString()}/mo
                  </p>
                </div>
                <span className="opacity-30">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
