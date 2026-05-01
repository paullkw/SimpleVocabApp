'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

type Question = {
  _id: string;
  text: string;
  image?: string;
  imageMimeType?: string;
  active?: boolean;
};

export default function FlashcardPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const testId = params.id as string;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [testTitle, setTestTitle] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadRef = useRef(0);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (!testId || status !== 'authenticated') return;
    loadRef.current += 1;
    const currentLoad = loadRef.current;
    setLoading(true);
    setError('');

    fetch(`/api/tests/${testId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load test');
        return res.json();
      })
      .then((data) => {
        if (currentLoad !== loadRef.current) return;

        const testCreatorId = String(
          typeof data.createdBy === 'string' ? data.createdBy : data.createdBy?._id || ''
        );
        const currentUserId = String(session?.user?.id || '');

        if (!testCreatorId || testCreatorId !== currentUserId) {
          setError('You do not have permission to access this test. Only the creator can view their own flashcards.');
          setLoading(false);
          return;
        }

        setTestTitle(data.title || '');

        const activeQuestions: Question[] = (data.questions || [])
          .filter((q: Question) => q.active)
          .map((q: Question) => ({
            ...q,
            image: normalizeImageSrc(q),
          }));

        setQuestions(activeQuestions);

        // Set starting index based on questionId query param
        const questionId = searchParams.get('questionId');
        if (questionId) {
          const idx = activeQuestions.findIndex((q) => q._id === questionId);
          setCurrentIndex(idx >= 0 ? idx : 0);
        } else {
          setCurrentIndex(0);
        }

        setLoading(false);
      })
      .catch((err) => {
        if (currentLoad !== loadRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load flashcards');
        setLoading(false);
      });
  }, [testId, status]);

  const normalizeImageSrc = (question: Question) => {
    if (!question.image) return undefined;
    if (question.image.startsWith('data:')) return question.image;
    const mimeType = question.imageMimeType || 'image/png';
    return `data:${mimeType};base64,${question.image}`;
  };

  const handlePrev = () => {
    setFlipped(false);
    setCurrentIndex((i) => Math.max(0, i - 1));
  };

  const handleNext = () => {
    setFlipped(false);
    setCurrentIndex((i) => Math.min(questions.length - 1, i + 1));
  };

  const handleFlip = () => {
    setFlipped((f) => !f);
  };

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading flashcards...</p>
        </div>
      </div>
    );
  }

  if (error) {
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
          <div className="rounded-3xl bg-white p-8 shadow-sm text-center">
            <p className="text-red-600">{error}</p>
            <Link href="/" className="mt-4 inline-block text-blue-600 hover:underline">
              Back to home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (questions.length === 0) {
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
          <div className="rounded-3xl bg-white p-8 shadow-sm text-center">
            <p className="text-gray-600 mb-4">No active questions found in this test.</p>
            <Link
              href={`/tests/${testId}/edit`}
              className="inline-block rounded-2xl bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
            >
              Edit Test
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const current = questions[currentIndex];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-2xl font-bold text-gray-900">
            Simple Vocab
          </Link>
          <Link
            href={`/tests/${testId}/quiz`}
            className="text-sm text-blue-600 hover:underline"
          >
            Back to Quiz
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">{testTitle}</h1>
          <p className="mt-1 text-sm text-gray-500">
            Card {currentIndex + 1} of {questions.length}
          </p>
        </div>

        {/* Flashcard */}
        <div
          className="relative cursor-pointer"
          style={{ perspective: '1000px' }}
          onClick={handleFlip}
        >
          <div
            className="relative w-full transition-transform duration-500"
            style={{
              transformStyle: 'preserve-3d',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              minHeight: '320px',
            }}
          >
            {/* Front — image */}
            <div
              className="absolute inset-0 rounded-3xl bg-white shadow-sm flex items-center justify-center p-8"
              style={{ backfaceVisibility: 'hidden' }}
            >
              {current.image ? (
                <img
                  src={current.image}
                  alt="Question"
                  className="max-h-64 max-w-full rounded-lg object-contain"
                />
              ) : (
                <p className="text-gray-400 text-lg select-none">Click to flip</p>
              )}
              <span className="absolute bottom-4 right-6 text-xs text-gray-400 select-none">
                Click to reveal answer
              </span>
            </div>

            {/* Back — answer text */}
            <div
              className="absolute inset-0 rounded-3xl bg-blue-600 shadow-sm flex items-center justify-center p-8"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <p className="text-2xl font-semibold text-white text-center select-none">
                {current.text}
              </p>
              <span className="absolute bottom-4 right-6 text-xs text-blue-200 select-none">
                Click to flip back
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="rounded-2xl border border-gray-300 bg-white px-6 py-3 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>

          <button
            onClick={handleFlip}
            className="rounded-2xl bg-gray-100 px-6 py-3 text-gray-700 hover:bg-gray-200"
          >
            Flip
          </button>

          <button
            onClick={handleNext}
            disabled={currentIndex === questions.length - 1}
            className="rounded-2xl border border-gray-300 bg-white px-6 py-3 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      </main>
    </div>
  );
}
