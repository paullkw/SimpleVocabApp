import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { Test } from '@/models/Test';
import SettingsForm from './SettingsForm';

export default async function TestSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

  if (!session?.user?.id) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="border-b bg-white shadow-sm">
          <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-2xl font-bold text-gray-900">
              Simple Vocab
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <p className="text-sm text-gray-600">Please sign in to access test settings.</p>
          </div>
        </main>
      </div>
    );
  }

  await connectToDatabase();

  const test = await Test.findById(id)
    .populate('createdBy', 'username')
    .populate('updatedBy', 'username');

  const testCreatorId = test
    ? String(typeof test.createdBy === 'string' ? test.createdBy : test.createdBy?._id || '')
    : '';
  const currentUserId = String(session.user.id || '');

  if (!test || !testCreatorId || testCreatorId !== currentUserId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="border-b bg-white shadow-sm">
          <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-2xl font-bold text-gray-900">
              Simple Vocab
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <p className="text-sm text-gray-600">Test not found or you do not have permission to access this page.</p>
          </div>
        </main>
      </div>
    );
  }

  const createdBy =
    typeof test.createdBy === 'string'
      ? test.createdBy
      : test.createdBy?.username || 'Unknown';
  const updatedBy =
    typeof test.updatedBy === 'string'
      ? test.updatedBy
      : test.updatedBy?.username || 'Unknown';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-2xl font-bold text-gray-900">
            Simple Vocab
          </Link>
          <Link
            href="/"
            className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Test Settings</h1>
            <p className="mt-2 text-sm text-gray-600">Manage settings and actions for this test.</p>
          </div>

          <div className="space-y-4 rounded-3xl border border-gray-200 bg-gray-50 p-6">
            <div>
              <p className="text-sm text-gray-600">Title</p>
              <p className="text-lg font-semibold text-gray-900">{test.title}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Created by</p>
              <p className="text-sm font-medium text-gray-900">{createdBy}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Updated by</p>
              <p className="text-sm font-medium text-gray-900">{updatedBy}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Consecutive correct to inactivate</p>
              <p className="text-sm font-medium text-gray-900">{Number(test.consecutiveCorrectToDeactivate || 3)}</p>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href={`/tests/${id}/edit`}
                className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Edit Test
              </Link>
              <Link
                href={`/tests/${id}/quiz`}
                className="rounded-2xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Multiple Choice
              </Link>
            </div>
          </div>

          <div className="mt-8">
            <SettingsForm
              testId={id}
              initialConsecutiveCorrectToDeactivate={Number(test.consecutiveCorrectToDeactivate || 3)}
            />
          </div>
        </div>
      </main>
    </div>
  );
}