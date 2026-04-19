import Link from 'next/link';
import { connectToDatabase } from '@/lib/db';
import { Test } from '@/models/Test';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import CloneTestForm from './CloneTestForm';

function formatDateTimeSuffix(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export default async function CloneTestPage({ params }: { params: Promise<{ id: string }> }) {
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
            <p className="text-sm text-gray-600">Please sign in to clone tests.</p>
          </div>
        </main>
      </div>
    );
  }

  await connectToDatabase();

  const test = await Test.findById(id)
    .populate('createdBy', 'username')
    .populate('questions', 'text image imageMimeType totalIncorrectCount')
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
            <p className="text-sm text-gray-600">Test not found or you do not have permission to clone this test.</p>
          </div>
        </main>
      </div>
    );
  }

  const now = new Date();
  const initialTitle = `${(test as any).title} ${formatDateTimeSuffix(now)}`;
  const questions = (Array.isArray((test as any).questions) ? (test as any).questions : [])
    .map((question: any) => ({
      id: String(question._id),
      text: question.text || '',
      image: question.image || '',
      imageMimeType: question.imageMimeType || '',
      totalIncorrectCount: Number(question.totalIncorrectCount || 0),
    }))
    .sort((a: any, b: any) => b.totalIncorrectCount - a.totalIncorrectCount);

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

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Clone Test</h1>
            <p className="mt-2 text-sm text-gray-600">Select questions and create a cloned test.</p>
          </div>

          <CloneTestForm testId={id} initialTitle={initialTitle} questions={questions} />
        </div>
      </main>
    </div>
  );
}
