import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import { Test } from '@/models/Test';

export default async function IncorrectReportPage({ params }: { params: Promise<{ id: string }> }) {
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
            <p className="text-sm text-gray-600">Please sign in to access incorrect report.</p>
          </div>
        </main>
      </div>
    );
  }

  await connectToDatabase();

  const test = await Test.findById(id)
    .populate('createdBy', 'username')
    .populate('questions', 'text totalIncorrectCount')
    .lean();

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
            <p className="text-sm text-gray-600">Test not found or you do not have permission to access this report.</p>
          </div>
        </main>
      </div>
    );
  }

  const questions = Array.isArray(test.questions) ? test.questions : [];
  const sortedQuestions = [...questions].sort(
    (a: any, b: any) => Number(b.totalIncorrectCount || 0) - Number(a.totalIncorrectCount || 0)
  );

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

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Incorrect Report</h1>
            <p className="mt-2 text-sm text-gray-600">
              Test: <span className="font-medium text-gray-900">{(test as any).title}</span>
            </p>
          </div>

          {sortedQuestions.length === 0 ? (
            <p className="text-sm text-gray-600">No questions found in this test.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Question</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Incorrect Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {sortedQuestions.map((question: any) => (
                    <tr key={String(question._id)}>
                      <td className="px-4 py-3 text-gray-900">{question.text || '(No text)'}</td>
                      <td className="px-4 py-3 text-gray-900">{Number(question.totalIncorrectCount || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
