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

type Card = {
  id: string; // unique card id
  pairId: string; // question._id — two cards share the same pairId
  type: 'image' | 'text';
  text: string;
  image?: string;
};

const MIN_MEMORY_QUESTIONS = 4;
const MAX_MEMORY_QUESTIONS = 8;

export default function MemoryPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const testId = params.id as string;

  const [testTitle, setTestTitle] = useState('');
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIds, setFlippedIds] = useState<string[]>([]);
  const [matchedPairIds, setMatchedPairIds] = useState<Set<string>>(new Set());
  const [seenQuestionIds, setSeenQuestionIds] = useState<Set<string>>(new Set());
  const [isChecking, setIsChecking] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
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
          setError('You do not have permission to access this test. Only the creator can play the memory game.');
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

        if (activeQuestions.length < MIN_MEMORY_QUESTIONS) {
          setError(
            `Memory game requires at least ${MIN_MEMORY_QUESTIONS} active questions. Currently only ${activeQuestions.length} available.`
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
        setError(err instanceof Error ? err.message : 'Failed to load memory game');
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
    const roundSize = Math.min(
      MAX_MEMORY_QUESTIONS,
      Math.max(MIN_MEMORY_QUESTIONS, source.length)
    );
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

  const buildCards = (questions: Question[]): Card[] => {
    const pairs: Card[] = questions.flatMap((q) => [
      {
        id: `${q._id}-image`,
        pairId: q._id,
        type: 'image' as const,
        text: q.text,
        image: q.image,
      },
      {
        id: `${q._id}-text`,
        pairId: q._id,
        type: 'text' as const,
        text: q.text,
        image: q.image,
      },
    ]);
    return shuffle(pairs);
  };

  const setupRound = (questions: Question[]) => {
    setCards(buildCards(questions));
    setFlippedIds([]);
    setMatchedPairIds(new Set());
    setIsChecking(false);
    setMoveCount(0);
  };

  const handleCardClick = (cardId: string, pairId: string) => {
    if (isChecking) return;
    if (matchedPairIds.has(pairId)) return;
    if (flippedIds.includes(cardId)) return;
    if (flippedIds.length >= 2) return;

    const nextFlipped = [...flippedIds, cardId];
    setFlippedIds(nextFlipped);

    if (nextFlipped.length === 2) {
      setMoveCount((c) => c + 1);
      setIsChecking(true);

      const [firstId, secondId] = nextFlipped;
      const firstCard = cards.find((c) => c.id === firstId)!;
      const secondCard = cards.find((c) => c.id === secondId)!;

      if (firstCard.pairId === secondCard.pairId) {
        // Match
        setMatchedPairIds((current) => {
          const next = new Set(current);
          next.add(firstCard.pairId);
          return next;
        });
        setFlippedIds([]);
        setIsChecking(false);
      } else {
        // No match — flip back after delay
        setTimeout(() => {
          setFlippedIds([]);
          setIsChecking(false);
        }, 1000);
      }
    }
  };

  const totalPairs = cards.length / 2;
  const allMatched = totalPairs > 0 && matchedPairIds.size === totalPairs;

  const handleRestart = () => {
    if (allQuestions.length < MIN_MEMORY_QUESTIONS) return;

    const nextRound = selectRoundQuestions(allQuestions, seenQuestionIds);
    const nextSeen = new Set(seenQuestionIds);
    nextRound.forEach((q) => nextSeen.add(q._id));

    setSeenQuestionIds(nextSeen);
    setupRound(nextRound);
  };

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading memory game...</p>
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

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">{testTitle} — Memory Game</h1>
          <p className="mt-2 text-sm text-gray-600">
            Flip cards to find matching image–word pairs. Matched: {matchedPairIds.size} / {totalPairs} &nbsp;·&nbsp; Moves: {moveCount}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Restart will prioritize questions you have not seen yet, then fill remaining slots with randomized previously shown questions.
          </p>
        </div>

        {allMatched ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900">You matched all pairs!</h2>
            <p className="mt-2 text-sm text-gray-600">
              Completed in {moveCount} move{moveCount !== 1 ? 's' : ''}.
            </p>
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
        ) : (
          <div className="grid grid-cols-4 gap-4 sm:grid-cols-4 md:grid-cols-4">
            {cards.map((card) => {
              const isFlipped = flippedIds.includes(card.id) || matchedPairIds.has(card.pairId);
              const isMatched = matchedPairIds.has(card.pairId);

              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handleCardClick(card.id, card.pairId)}
                  disabled={isMatched || isChecking && !flippedIds.includes(card.id) && flippedIds.length >= 2}
                  className={`relative h-36 w-full rounded-2xl border-2 text-sm font-medium transition-all duration-300 focus:outline-none ${
                    isMatched
                      ? 'border-green-300 bg-green-50 text-green-700 cursor-default'
                      : isFlipped
                        ? 'border-blue-300 bg-blue-50 text-blue-900'
                        : 'border-gray-200 bg-white text-gray-900 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
                  }`}
                >
                  {isFlipped ? (
                    <span className="flex h-full w-full items-center justify-center p-2">
                      {card.type === 'image' ? (
                        card.image ? (
                          <img
                            src={card.image}
                            alt="card image"
                            className="max-h-full max-w-full rounded-lg object-contain"
                          />
                        ) : (
                          <span className="text-xs text-gray-400">No image</span>
                        )
                      ) : (
                        <span className="text-center text-xl font-medium leading-snug">{card.text}</span>
                      )}
                    </span>
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
