import { auth } from '@/lib/auth';
import { getGroupDetails } from '@/lib/actions';
import { redirect } from 'next/navigation';
import GroupView from '@/components/GroupView';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function GroupPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { id } = await params;
  const data = await getGroupDetails(id);

  if (!data) redirect('/dashboard');

  return <GroupView data={data} />;
}
