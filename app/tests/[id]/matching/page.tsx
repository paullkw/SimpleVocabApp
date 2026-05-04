'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

type Question = {
  _id: string;
  text: string;
  image?: string;
  imageMimeType?: string;
  active?: boolean;
};

const MIN_MATCHING_QUESTIONS = 2;
const MAX_MATCHING_QUESTIONS = 8;

export default function MatchingPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const testId = params.id as string;

  const [testTitle, setTestTitle] = useState('');
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [roundQuestions, setRoundQuestions] = useState<Question[]>([]);
  const [answerChoices, setAnswerChoices] = useState<Question[]>([]);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [seenQuestionIds, setSeenQuestionIds] = useState<Set<string>>(new Set());
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadRef = useRef(0);

  const getRoundSize = (totalQuestions: number) =>
    Math.min(MAX_MATCHING_QUESTIONS, Math.max(MIN_MATCHING_QUESTIONS, totalQuestions || 0));

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
    setFeedback('');

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
          setError('You do not have permission to access this test. Only the creator can use matching.');
          setLoading(false);
          return;
        }

        const activeQuestions: Question[] = (data.questions || [])
          .filter((q: Question) => q.active && q.text && q.text.trim())
          .map((q: Question) => ({
            ...q,
            image: normalizeImageSrc(q),
          }));

        setTestTitle(data.title || '');
        setAllQuestions(activeQuestions);

        if (activeQuestions.length < MIN_MATCHING_QUESTIONS) {
          setError(
            `Matching requires at least ${MIN_MATCHING_QUESTIONS} active questions. Currently only ${activeQuestions.length} available.`
          );
          setLoading(false);
          return;
        }

        const initialRound = selectRoundQuestions(activeQuestions, new Set<string>());
        const initialSeen = new Set(initialRound.map((q) => q._id));

        setSeenQuestionIds(initialSeen);
        setupRound(initialRound);
        setLoading(false);
      })
      .catch((err) => {
        if (currentLoad !== loadRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load matching exercise');
        setLoading(false);
      });
  }, [testId, status]);

  const normalizeImageSrc = (question: Question) => {
    if (!question.image) return undefined;
    if (question.image.startsWith('data:')) return question.image;
    const mimeType = question.imageMimeType || 'image/png';
    return `data:${mimeType};base64,${question.image}`;
  };

  const shuffle = <T,>(items: T[]) => {
    const next = [...items];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = next[i];
      next[i] = next[j];
      next[j] = temp;
    }
    return next;
  };

  const selectRoundQuestions = (source: Question[], seen: Set<string>) => {
    const roundSize = getRoundSize(source.length);
    const unseen = source.filter((q) => !seen.has(q._id));
    const shuffledUnseen = shuffle(unseen);
    const selected: Question[] = shuffledUnseen.slice(0, roundSize);

    if (selected.length < roundSize) {
      const remaining = source.filter((q) => !selected.some((picked) => picked._id === q._id));
      const shuffledRemaining = shuffle(remaining);
      selected.push(...shuffledRemaining.slice(0, roundSize - selected.length));
    }

    return selected;
  };

  const setupRound = (questions: Question[]) => {
    setRoundQuestions(questions);
    setAnswerChoices(shuffle(questions));
    setMatchedIds(new Set());
    setSelectedPromptId(null);
    setFeedback('');
  };

  const handleSelectPrompt = (questionId: string) => {
    if (matchedIds.has(questionId)) return;
    setSelectedPromptId(questionId);
    setFeedback('');
  };

  const handleSelectAnswer = (questionId: string) => {
    if (!selectedPromptId || matchedIds.has(questionId)) return;

    if (selectedPromptId === questionId) {
      setMatchedIds((current) => {
        const next = new Set(current);
        next.add(questionId);
        return next;
      });
      setSelectedPromptId(null);
      setFeedback('Correct match!');
      return;
    }

    setFeedback('Not matched. Try again.');
  };

  const allMatched = roundQuestions.length > 0 && matchedIds.size === roundQuestions.length;

  const handleRestart = () => {
    if (allQuestions.length < MIN_MATCHING_QUESTIONS) return;

    const nextRound = selectRoundQuestions(allQuestions, seenQuestionIds);
    const nextSeen = new Set(seenQuestionIds);
    nextRound.forEach((q) => nextSeen.add(q._id));

    setSeenQuestionIds(nextSeen);
    setupRound(nextRound);
  };

  const currentRoundSize = getRoundSize(allQuestions.length);

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading matching exercise...</p>
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-2xl font-bold text-gray-900">
            Simple Vocab
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">{testTitle} - Matching</h1>
          <p className="mt-2 text-sm text-gray-600">
            Match each prompt card to the correct answer. Completed: {matchedIds.size} / {roundQuestions.length}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Restart will prioritize questions you have not done yet, then fill remaining slots with randomized previously matched questions.
          </p>
          {feedback && <p className="mt-3 text-sm font-medium text-blue-700">{feedback}</p>}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Prompts</h2>
            <div className="space-y-3">
              {roundQuestions.map((question, index) => {
                const isMatched = matchedIds.has(question._id);
                const isSelected = selectedPromptId === question._id;
                return (
                  <button
                    key={question._id}
                    type="button"
                    disabled={isMatched}
                    onClick={() => handleSelectPrompt(question._id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      isMatched
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : isSelected
                          ? 'border-blue-400 bg-blue-50 text-blue-800'
                          : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
                    } disabled:cursor-not-allowed`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                        {index + 1}
                      </span>
                      {question.image ? (
                        <img
                          src={question.image}
                          alt={`Prompt ${index + 1}`}
                          className="h-28 w-full min-w-0 flex-1 rounded-lg border border-gray-200 bg-white p-1 object-contain"
                        />
                      ) : (
                        <span className="inline-flex h-28 w-full min-w-0 flex-1 items-center justify-center rounded-lg bg-gray-100 px-2 py-1 text-xs text-gray-500">
                          No image
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Answers</h2>
            <div className="space-y-3">
              {answerChoices.map((choice) => {
                const isMatched = matchedIds.has(choice._id);
                return (
                  <button
                    key={choice._id}
                    type="button"
                    disabled={isMatched || !selectedPromptId}
                    onClick={() => handleSelectAnswer(choice._id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      isMatched
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : !selectedPromptId
                          ? 'border-gray-200 bg-gray-50 text-gray-400'
                          : 'border-gray-200 bg-white text-gray-900 hover:bg-gray-50'
                    } disabled:cursor-not-allowed`}
                  >
                    {choice.text}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {allMatched && (
          <div className="mt-8 rounded-3xl bg-white p-8 text-center shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900">Round complete!</h2>
            <p className="mt-2 text-sm text-gray-600">You matched all {roundQuestions.length} questions.</p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleRestart}
                className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                Restart
              </button>
              <Link
                href="/"
                className="rounded-2xl bg-gray-600 px-6 py-3 text-sm font-medium text-white hover:bg-gray-700"
              >
                Back to home
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
