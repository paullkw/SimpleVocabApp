'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

type Coord = {
  row: number;
  col: number;
};

type WordPlacement = {
  id: string;
  question: Question;
  answer: string;
  cells: string[];
};

type WordSearchPuzzle = {
  size: number;
  grid: string[][];
  placements: WordPlacement[];
};

const MIN_WORD_SEARCH_QUESTIONS = 1;
const MAX_WORD_SEARCH_QUESTIONS = 8;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const normalizeAnswer = (value: string) => value.replace(/[^a-z]/gi, '').toUpperCase();
const keyFromCoord = (row: number, col: number) => `${row},${col}`;

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

const vectors: Array<{ dr: number; dc: number }> = [
  { dr: 0, dc: 1 },   // left to right (horizontal)
  { dr: 1, dc: 0 },   // top to bottom (vertical)
  { dr: 1, dc: 1 },   // diagonal down-right
  { dr: -1, dc: 1 },  // diagonal up-right
];

const getRoundSize = (total: number) =>
  Math.min(MAX_WORD_SEARCH_QUESTIONS, Math.max(MIN_WORD_SEARCH_QUESTIONS, total || 0));

const getDirectionStep = (start: Coord, end: Coord) => {
  const deltaRow = end.row - start.row;
  const deltaCol = end.col - start.col;

  if (deltaRow === 0 && deltaCol === 0) return { dr: 0, dc: 0 };

  const absRow = Math.abs(deltaRow);
  const absCol = Math.abs(deltaCol);

  if (!(deltaRow === 0 || deltaCol === 0 || absRow === absCol)) return null;

  return {
    dr: deltaRow === 0 ? 0 : deltaRow / absRow,
    dc: deltaCol === 0 ? 0 : deltaCol / absCol,
  };
};

const getLinePath = (start: Coord, end: Coord) => {
  const step = getDirectionStep(start, end);
  if (!step) return null;

  const length = Math.max(Math.abs(end.row - start.row), Math.abs(end.col - start.col)) + 1;
  const path: Coord[] = [];

  for (let i = 0; i < length; i += 1) {
    path.push({
      row: start.row + step.dr * i,
      col: start.col + step.dc * i,
    });
  }

  return path;
};

const canPlace = (
  grid: string[][],
  answer: string,
  row: number,
  col: number,
  dr: number,
  dc: number
) => {
  for (let i = 0; i < answer.length; i += 1) {
    const r = row + dr * i;
    const c = col + dc * i;

    if (r < 0 || c < 0 || r >= grid.length || c >= grid.length) return false;

    const existing = grid[r][c];
    if (existing && existing !== answer[i]) return false;
  }

  return true;
};

const placeWord = (
  grid: string[][],
  answer: string,
  row: number,
  col: number,
  dr: number,
  dc: number
) => {
  const cells: string[] = [];

  for (let i = 0; i < answer.length; i += 1) {
    const r = row + dr * i;
    const c = col + dc * i;
    grid[r][c] = answer[i];
    cells.push(keyFromCoord(r, c));
  }

  return cells;
};

const buildPuzzle = (questions: Question[]): WordSearchPuzzle | null => {
  const candidates = questions
    .map((question) => ({
      id: question._id,
      question,
      answer: normalizeAnswer(question.text),
    }))
    .filter((item) => item.answer.length > 0)
    .sort((a, b) => b.answer.length - a.answer.length);

  if (candidates.length === 0) return null;

  const longestWord = candidates[0].answer.length;
  const totalChars = candidates.reduce((sum, item) => sum + item.answer.length, 0);
  const suggested = Math.ceil(Math.sqrt(totalChars)) + 3;
  const size = Math.max(8, Math.min(18, Math.max(longestWord + 2, suggested)));

  for (let attempt = 0; attempt < 150; attempt += 1) {
    const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => ''));
    const placements: WordPlacement[] = [];
    let failed = false;

    for (const candidate of candidates) {
      let placed = false;
      const shuffledDirections = shuffle(vectors);

      for (const vector of shuffledDirections) {
        const starts: Coord[] = [];

        for (let row = 0; row < size; row += 1) {
          for (let col = 0; col < size; col += 1) {
            starts.push({ row, col });
          }
        }

        const shuffledStarts = shuffle(starts);

        for (const start of shuffledStarts) {
          if (!canPlace(grid, candidate.answer, start.row, start.col, vector.dr, vector.dc)) continue;

          const cells = placeWord(grid, candidate.answer, start.row, start.col, vector.dr, vector.dc);
          placements.push({
            id: candidate.id,
            question: candidate.question,
            answer: candidate.answer,
            cells,
          });
          placed = true;
          break;
        }

        if (placed) break;
      }

      if (!placed) {
        failed = true;
        break;
      }
    }

    if (failed) continue;

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (!grid[row][col]) {
          const randomIndex = Math.floor(Math.random() * LETTERS.length);
          grid[row][col] = LETTERS[randomIndex];
        }
      }
    }

    return {
      size,
      grid,
      placements,
    };
  }

  return null;
};

export default function WordSearchPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const testId = params.id as string;

  const [testTitle, setTestTitle] = useState('');
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [roundQuestions, setRoundQuestions] = useState<Question[]>([]);
  const [puzzle, setPuzzle] = useState<WordSearchPuzzle | null>(null);
  const [seenQuestionIds, setSeenQuestionIds] = useState<Set<string>>(new Set());
  const [solvedWordIds, setSolvedWordIds] = useState<Set<string>>(new Set());
  const [solvedCellKeys, setSolvedCellKeys] = useState<Set<string>>(new Set());
  const [dragPathKeys, setDragPathKeys] = useState<string[]>([]);
  const [startCell, setStartCell] = useState<Coord | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadRef = useRef(0);

  const normalizeImageSrc = (question: Question) => {
    if (!question.image) return undefined;
    if (question.image.startsWith('data:')) return question.image;
    const mimeType = question.imageMimeType || 'image/png';
    return `data:${mimeType};base64,${question.image}`;
  };

  const selectRoundQuestions = (source: Question[], seen: Set<string>) => {
    const roundSize = getRoundSize(source.length);
    const unseen = source.filter((q) => !seen.has(q._id));
    const selected: Question[] = shuffle(unseen).slice(0, roundSize);

    if (selected.length < roundSize) {
      const remaining = source.filter((q) => !selected.some((picked) => picked._id === q._id));
      selected.push(...shuffle(remaining).slice(0, roundSize - selected.length));
    }

    return selected;
  };

  const setupRound = (questions: Question[]) => {
    const built = buildPuzzle(questions);
    if (!built) {
      setError('Unable to build a word search puzzle from these questions. Try changing question words and restarting.');
      return false;
    }

    setRoundQuestions(questions);
    setPuzzle(built);
    setSolvedWordIds(new Set());
    setSolvedCellKeys(new Set());
    setDragPathKeys([]);
    setStartCell(null);
    setIsDragging(false);
    setError('');
    return true;
  };

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
          setError('You do not have permission to access this test. Only the creator can use word search.');
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

        const usableQuestions = activeQuestions.filter((q) => normalizeAnswer(q.text).length > 0);
        if (usableQuestions.length < MIN_WORD_SEARCH_QUESTIONS) {
          setError('Word search requires at least 1 active question containing letters.');
          setLoading(false);
          return;
        }

        const initialRound = selectRoundQuestions(usableQuestions, new Set<string>());
        const initialSeen = new Set(initialRound.map((q) => q._id));

        setSeenQuestionIds(initialSeen);
        setupRound(initialRound);
        setLoading(false);
      })
      .catch((err) => {
        if (currentLoad !== loadRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load word search');
        setLoading(false);
      });
  }, [testId, status, session?.user?.id]);

  const checkAndSolvePath = (pathKeys: string[]) => {
    if (!puzzle || pathKeys.length === 0) return;

    const matchedPlacement = puzzle.placements.find((placement) => {
      if (solvedWordIds.has(placement.id)) return false;

      return (
        placement.cells.length === pathKeys.length &&
        placement.cells.every((cell, index) => cell === pathKeys[index])
      );
    });

    if (!matchedPlacement) {
      return;
    }

    setSolvedWordIds((current) => {
      const next = new Set(current);
      next.add(matchedPlacement.id);
      return next;
    });

    setSolvedCellKeys((current) => {
      const next = new Set(current);
      matchedPlacement.cells.forEach((cell) => next.add(cell));
      return next;
    });


  };

  const beginDrag = (row: number, col: number) => {
    const key = keyFromCoord(row, col);
    setStartCell({ row, col });
    setIsDragging(true);
    setDragPathKeys([key]);
  };

  const extendDrag = (row: number, col: number) => {
    if (!isDragging || !startCell) return;

    const path = getLinePath(startCell, { row, col });
    if (!path) return;

    setDragPathKeys(path.map((coord) => keyFromCoord(coord.row, coord.col)));
  };

  const endDrag = () => {
    if (!isDragging) return;
    checkAndSolvePath(dragPathKeys);
    setIsDragging(false);
    setStartCell(null);
    setDragPathKeys([]);
  };

  useEffect(() => {
    if (!isDragging) return;

    const onPointerUp = () => endDrag();
    window.addEventListener('pointerup', onPointerUp);
    return () => window.removeEventListener('pointerup', onPointerUp);
  }, [isDragging, dragPathKeys]);

  const handleRestart = () => {
    if (allQuestions.length < MIN_WORD_SEARCH_QUESTIONS) return;

    const usableQuestions = allQuestions.filter((q) => normalizeAnswer(q.text).length > 0);
    const nextRound = selectRoundQuestions(usableQuestions, seenQuestionIds);
    const nextSeen = new Set(seenQuestionIds);
    nextRound.forEach((q) => nextSeen.add(q._id));

    setSeenQuestionIds(nextSeen);
    setupRound(nextRound);
  };

  const allSolved = puzzle ? solvedWordIds.size === puzzle.placements.length && puzzle.placements.length > 0 : false;

  const solvedLookup = useMemo(() => {
    const next = new Set<string>();
    if (!puzzle) return next;

    for (const placement of puzzle.placements) {
      if (solvedWordIds.has(placement.id)) {
        next.add(placement.id);
      }
    }

    return next;
  }, [puzzle, solvedWordIds]);

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading word search...</p>
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

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">{testTitle} - Word Search</h1>
          <p className="mt-2 text-sm text-gray-600">
            Drag across the grid to find words in horizontal, vertical, or diagonal lines. Found: {solvedWordIds.size} /{' '}
            {roundQuestions.length}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Questions per round: {getRoundSize(allQuestions.length)} (min {MIN_WORD_SEARCH_QUESTIONS}, max {MAX_WORD_SEARCH_QUESTIONS}).
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Restart will prioritize questions you have not done yet, then fill remaining slots with randomized previously shown questions.
          </p>

        </div>

        {puzzle && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Puzzle Grid</h2>
              <div className="overflow-auto">
                <div
                  className="inline-grid gap-1 rounded-xl bg-gray-200 p-2 select-none touch-none"
                  style={{
                    gridTemplateColumns: `repeat(${puzzle.size}, minmax(0, 2.1rem))`,
                  }}
                >
                  {puzzle.grid.map((rowChars, rowIndex) =>
                    rowChars.map((char, colIndex) => {
                      const key = keyFromCoord(rowIndex, colIndex);
                      const inDragPath = dragPathKeys.includes(key);
                      const isSolvedCell = solvedCellKeys.has(key);

                      return (
                        <button
                          key={key}
                          type="button"
                          onPointerDown={() => beginDrag(rowIndex, colIndex)}
                          onPointerEnter={() => extendDrag(rowIndex, colIndex)}
                          onPointerUp={endDrag}
                          className={`h-8 w-8 rounded-md border text-sm font-bold uppercase transition ${
                            inDragPath
                              ? 'border-blue-500 bg-blue-100 text-blue-800'
                              : isSolvedCell
                                ? 'border-green-500 bg-green-100 text-green-800'
                                : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-100'
                          }`}
                        >
                          {char}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Find These Words</h2>
              <div className="space-y-3">
                {puzzle.placements.map((placement, index) => {
                  const solved = solvedLookup.has(placement.id);

                  return (
                    <div
                      key={placement.id}
                      className={`rounded-2xl border p-3 ${
                        solved ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-800">
                        {index + 1}. {solved ? placement.answer : '????'} ({placement.answer.length})
                      </p>
                      <div className="mt-2">
                        {placement.question.image ? (
                          <img
                            src={placement.question.image}
                            alt={`Word clue ${index + 1}`}
                            className="h-24 w-full rounded-lg border border-gray-200 bg-white p-1 object-contain"
                          />
                        ) : (
                          <div className="inline-flex h-24 w-full items-center justify-center rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-500">
                            No image
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {allSolved && (
          <div className="mt-8 rounded-3xl bg-white p-8 text-center shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900">Great work!</h2>
            <p className="mt-2 text-sm text-gray-600">You found all words in this round.</p>
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
