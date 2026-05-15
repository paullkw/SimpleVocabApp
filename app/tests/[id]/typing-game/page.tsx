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

type FallingCard = {
  id: string;
  questionId: string;
  question: Question;
  position: number;
  matched: boolean;
  xPosition: number;
};

const CARD_WIDTH = 192;
const CARD_HORIZONTAL_GAP = 24;
const CARD_SAFE_TOP_ZONE = 220;
const CARD_SIDE_PADDING = 24;

export default function TypingGamePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const testId = params.id as string;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [testTitle, setTestTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  // Game state
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [userInput, setUserInput] = useState('');
  const [fallingCards, setFallingCards] = useState<FallingCard[]>([]);

  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const cardSpawnRef = useRef<NodeJS.Timeout | null>(null);
  const loadRef = useRef(0);
  const questionIndexRef = useRef(0);
  const nextCardIdRef = useRef(0);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Load test data
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
        setTestTitle(data.title);
        const activeQuestions = data.questions.filter((q: Question) => q.active !== false);
        setQuestions(activeQuestions);
      })
      .catch((err) => {
        if (currentLoad === loadRef.current) {
          setError('Failed to load test');
        }
      })
      .finally(() => {
        if (currentLoad === loadRef.current) {
          setLoading(false);
        }
      });
  }, [testId, status]);

  // Normalize answer
  const normalizeAnswer = (answer: string) => {
    return answer.trim().toLowerCase().replace(/\s+/g, ' ');
  };

  // Start game
  const startGame = () => {
    setGameStarted(true);
    setGameOver(false);
    setScore(0);
    setTimeLeft(60);
    setUserInput('');
    setFallingCards([]);
    questionIndexRef.current = 0;
    nextCardIdRef.current = 0;

    // Spawn first card immediately
    spawnCard();

    // Game loop - update card positions
    gameLoopRef.current = setInterval(() => {
      setFallingCards((prev) => {
        const updated = prev.map((card) => ({
          ...card,
          position: card.position + 2,
          xPosition: card.xPosition, // Explicitly preserve x position
        }));

        // Remove cards that fell off screen or were matched
        const filtered = updated.filter((card) => {
          if (card.position > 600) {
            setScore((s) => Math.max(0, s - 100));
            return false;
          }
          return true;
        });

        return filtered;
      });
    }, 30);

    // Spawn new cards periodically
    cardSpawnRef.current = setInterval(() => {
      spawnCard();
    }, 2000);

    // Timer
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Spawn a card
  const spawnCard = () => {
    if (questions.length === 0) return;

    if (questionIndexRef.current >= questions.length) {
      questionIndexRef.current = 0;
    }

    const question = questions[questionIndexRef.current];

    setFallingCards((prev) => {
      const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
      const laneWidth = CARD_WIDTH + CARD_HORIZONTAL_GAP;
      const spawnAreaWidth = Math.max(CARD_WIDTH, windowWidth - CARD_SIDE_PADDING * 2);
      const laneCount = Math.max(1, Math.floor((spawnAreaWidth + CARD_HORIZONTAL_GAP) / laneWidth));
      const maxX = Math.max(CARD_SIDE_PADDING, windowWidth - CARD_SIDE_PADDING - CARD_WIDTH);

      const availableLanes: number[] = [];

      for (let lane = 0; lane < laneCount; lane += 1) {
        const laneStart = CARD_SIDE_PADDING + lane * laneWidth;
        const laneEnd = Math.min(laneStart + CARD_WIDTH, maxX + CARD_WIDTH);

        // A lane is available only if no visible card is still close to the spawn zone.
        const blockedByNearestCard = prev.some((card) => {
          const cardEndX = card.xPosition + CARD_WIDTH;
          const overlapsLane = card.xPosition < laneEnd && cardEndX > laneStart;
          const tooCloseToTop = card.position < CARD_SAFE_TOP_ZONE;
          return overlapsLane && tooCloseToTop;
        });

        if (!blockedByNearestCard) {
          availableLanes.push(lane);
        }
      }

      // If the screen has no safe lane yet, skip this spawn tick.
      if (availableLanes.length === 0) {
        return prev;
      }

      const selectedLane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
      const rawX = CARD_SIDE_PADDING + selectedLane * laneWidth;
      const xPos = Math.min(rawX, maxX);

      const cardToAdd: FallingCard = {
        id: `card-${nextCardIdRef.current}`,
        questionId: question._id,
        question,
        position: 0,
        matched: false,
        xPosition: xPos,
      };

      nextCardIdRef.current += 1;
      questionIndexRef.current += 1;

      return [...prev, cardToAdd];
    });
  };

  // Handle user input
  const handleInputChange = (value: string) => {
    setUserInput(value);

    if (value.trim().length === 0) return;

    // Check if input matches any falling card
    const matchedIndex = fallingCards.findIndex(
      (card) => !card.matched && normalizeAnswer(card.question.text) === normalizeAnswer(value)
    );

    if (matchedIndex !== -1) {
      setScore((s) => s + 100);
      setFallingCards((prev) => {
        const updated = [...prev];
        updated.splice(matchedIndex, 1);
        return updated;
      });
      setUserInput('');
    }
  };

  // Check if game should end
  useEffect(() => {
    if (gameStarted && timeLeft === 0) {
      setGameOver(true);
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (cardSpawnRef.current) clearInterval(cardSpawnRef.current);
    }
  }, [timeLeft, gameStarted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (cardSpawnRef.current) clearInterval(cardSpawnRef.current);
    };
  }, []);

  const normalizeImageSrc = (question: Question) => {
    if (!question.image) return undefined;
    if (question.image.startsWith('data:')) {
      return question.image;
    }
    const mimeType = question.imageMimeType || 'image/png';
    return `data:${mimeType};base64,${question.image}`;
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading test...</p>
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
        <main className="mx-auto max-w-7xl px-6 py-10">
          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <p className="text-red-600">{error}</p>
            <Link href="/" className="mt-4 inline-flex rounded-2xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Back to Tests
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
        <main className="mx-auto max-w-7xl px-6 py-10">
          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <p className="text-gray-600">No questions in this test.</p>
            <Link href="/" className="mt-4 inline-flex rounded-2xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Back to Tests
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="border-b border-gray-700 bg-gray-800 shadow-sm">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-white">{testTitle} - Typing Game</h1>
          </div>
          <Link href="/" className="text-sm font-medium text-gray-400 hover:text-white">
            Back to Tests
          </Link>
        </nav>
      </header>

      {!gameStarted && !gameOver && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="rounded-3xl bg-white p-8 shadow-lg text-center max-w-md">
            <h2 className="text-2xl font-bold text-gray-900">Typing Game</h2>
            <p className="mt-4 text-gray-600">
              Type the correct answer as cards fall from the top! You have 60 seconds.
            </p>
            <ul className="mt-4 text-left text-sm text-gray-700 space-y-2">
              <li>✓ <strong>+100 points</strong> for each correct answer</li>
              <li>✗ <strong>-100 points</strong> for each card that reaches the bottom</li>
            </ul>
            <button
              onClick={startGame}
              className="mt-6 inline-flex rounded-2xl bg-green-600 px-6 py-3 text-sm font-medium text-white hover:bg-green-700"
            >
              Start Game
            </button>
          </div>
        </div>
      )}

      {gameStarted && !gameOver && (
        <main className="relative w-full h-screen bg-gray-900 overflow-hidden">
          {/* HUD */}
          <div className="absolute top-4 left-4 right-4 z-40 flex justify-between items-center pointer-events-none">
            <div className="bg-black/50 text-white px-4 py-2 rounded-lg">
              <span className="text-sm font-medium">Time: {timeLeft}s</span>
            </div>
            <div className="bg-black/50 text-white px-4 py-2 rounded-lg">
              <span className="text-sm font-medium">Score: {score}</span>
            </div>
          </div>

          {/* Falling Cards */}
          <div className="relative w-full h-full">
            {fallingCards.map((card) => (
              <div
                key={card.id}
                className="absolute w-48 bg-white rounded-lg shadow-lg p-4"
                style={{
                  left: `${card.xPosition}px`,
                  top: `${card.position}px`,
                  willChange: 'top',
                }}
              >
                {card.question.image && (
                  <img
                    src={normalizeImageSrc(card.question)}
                    alt="Question"
                    className="w-full h-32 object-cover rounded-md mb-3"
                  />
                )}
                <p className="text-center font-semibold text-gray-900 text-sm">
                  {card.question.text}
                </p>
              </div>
            ))}
          </div>

          {/* Input Box */}
          <div className="absolute bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4">
            <div className="max-w-2xl mx-auto">
              <input
                type="text"
                value={userInput}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="Type the answer..."
                autoFocus
                className="w-full px-4 py-3 rounded-lg border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="mt-2 text-xs text-gray-400 text-center">
                Type the word shown in the cards above
              </p>
            </div>
          </div>
        </main>
      )}

      {gameOver && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="rounded-3xl bg-white p-8 shadow-lg text-center max-w-md">
            <h2 className="text-3xl font-bold text-gray-900">Game Over!</h2>
            <p className="mt-4 text-5xl font-bold text-green-600">{score}</p>
            <p className="mt-2 text-gray-600">Final Score</p>
            <div className="mt-6 space-y-3">
              <button
                onClick={startGame}
                className="w-full inline-flex justify-center rounded-2xl bg-green-600 px-6 py-3 text-sm font-medium text-white hover:bg-green-700"
              >
                Play Again
              </button>
              <Link
                href="/"
                className="w-full inline-flex justify-center rounded-2xl bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                Back to Tests
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
