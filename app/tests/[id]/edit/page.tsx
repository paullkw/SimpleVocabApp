import Link from 'next/link';
import { connectToDatabase } from '@/lib/db';
import { Test } from '@/models/Test';
import EditTestForm from './EditTestForm';

export default async function EditTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  console.log('EditTestPage params:', { id });

  await connectToDatabase();

  const test = await Test.findById(id)
    .populate('createdBy', 'username')
    .populate('updatedBy', 'username')
    .populate('questions', 'text image imageMimeType active');

  console.log('Found test:', test);

  if (!test) {
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
            <p className="text-sm text-gray-600">Test not found.</p>
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

  // Extract only necessary fields from questions to avoid circular references
  const initialQuestions = (test.questions || []).map((q: any) => ({
    id: q._id?.toString(),
    text: q.text || '',
    image: q.image || '',
    imageMimeType: q.imageMimeType || '',
    active: q.active ?? false,
  }));

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
        <div className="mb-8 rounded-3xl bg-white p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Edit Test</h1>
            <p className="text-sm text-gray-600">Update the title for this test.</p>
          </div>

          <EditTestForm
            testId={id}
            initialTitle={test.title}
            createdBy={createdBy}
            updatedBy={updatedBy}
            initialQuestions={initialQuestions}
          />
        </div>
      </main>
    </div>
  );
}
