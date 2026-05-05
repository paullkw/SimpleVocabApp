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

type Direction = 'across' | 'down';

type CrosswordEntry = {
  id: string;
  question: Question;
  answer: string;
  row: number;
  col: number;
  direction: Direction;
  number: number;
};

type CrosswordCell = {
  row: number;
  col: number;
  solution: string;
  number?: number;
};

type CrosswordLayout = {
  entries: CrosswordEntry[];
  cells: Record<string, CrosswordCell>;
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
};

type RoundData = {
  questions: Question[];
  layout: CrosswordLayout;
};

type OccupiedCell = {
  char: string;
  directions: Set<Direction>;
};

const MIN_CROSSWORD_QUESTIONS = 4;
const MAX_CROSSWORD_QUESTIONS = 8;

const normalizeAnswer = (value: string) => value.replace(/[^a-z0-9]/gi, '').toUpperCase();
const cellKey = (row: number, col: number) => `${row},${col}`;

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

const canPlaceWord = (
  answer: string,
  row: number,
  col: number,
  direction: Direction,
  occupied: Map<string, OccupiedCell>
) => {
  const stepRow = direction === 'down' ? 1 : 0;
  const stepCol = direction === 'across' ? 1 : 0;

  const beforeKey = cellKey(row - stepRow, col - stepCol);
  if (occupied.has(beforeKey)) return false;

  const afterKey = cellKey(row + stepRow * answer.length, col + stepCol * answer.length);
  if (occupied.has(afterKey)) return false;

  for (let i = 0; i < answer.length; i += 1) {
    const r = row + stepRow * i;
    const c = col + stepCol * i;
    const key = cellKey(r, c);
    const existing = occupied.get(key);

    if (existing) {
      if (existing.char !== answer[i]) return false;
      if (existing.directions.has(direction)) return false;
      continue;
    }

    if (direction === 'across') {
      if (occupied.has(cellKey(r - 1, c)) || occupied.has(cellKey(r + 1, c))) return false;
    } else {
      if (occupied.has(cellKey(r, c - 1)) || occupied.has(cellKey(r, c + 1))) return false;
    }
  }

  return true;
};

const placeWord = (
  entry: Omit<CrosswordEntry, 'number'>,
  occupied: Map<string, OccupiedCell>,
  placed: Array<Omit<CrosswordEntry, 'number'>>
) => {
  const stepRow = entry.direction === 'down' ? 1 : 0;
  const stepCol = entry.direction === 'across' ? 1 : 0;

  for (let i = 0; i < entry.answer.length; i += 1) {
    const r = entry.row + stepRow * i;
    const c = entry.col + stepCol * i;
    const key = cellKey(r, c);
    const existing = occupied.get(key);

    if (existing) {
      existing.directions.add(entry.direction);
    } else {
      occupied.set(key, {
        char: entry.answer[i],
        directions: new Set([entry.direction]),
      });
    }
  }

  placed.push(entry);
};

const countIntersections = (
  answer: string,
  row: number,
  col: number,
  direction: Direction,
  occupied: Map<string, OccupiedCell>
) => {
  const stepRow = direction === 'down' ? 1 : 0;
  const stepCol = direction === 'across' ? 1 : 0;
  let count = 0;

  for (let i = 0; i < answer.length; i += 1) {
    const key = cellKey(row + stepRow * i, col + stepCol * i);
    if (occupied.has(key)) count += 1;
  }

  return count;
};

const buildCrosswordLayout = (questions: Question[]): CrosswordLayout | null => {
  if (questions.length < MIN_CROSSWORD_QUESTIONS) return null;

  const words = questions
    .map((question) => ({
      id: question._id,
      question,
      answer: normalizeAnswer(question.text),
    }))
    .filter((item) => item.answer.length >= 2);

  if (words.length < MIN_CROSSWORD_QUESTIONS) return null;

  const occupied = new Map<string, OccupiedCell>();
  const placed: Array<Omit<CrosswordEntry, 'number'>> = [];

  const first = words[0];
  placeWord(
    {
      id: first.id,
      question: first.question,
      answer: first.answer,
      row: 0,
      col: 0,
      direction: 'across',
    },
    occupied,
    placed
  );

  for (let wordIndex = 1; wordIndex < words.length; wordIndex += 1) {
    const current = words[wordIndex];
    const candidates: Array<Omit<CrosswordEntry, 'number'> & { intersections: number }> = [];

    for (const placedWord of placed) {
      for (let placedIndex = 0; placedIndex < placedWord.answer.length; placedIndex += 1) {
        const placedChar = placedWord.answer[placedIndex];

        for (let currentIndex = 0; currentIndex < current.answer.length; currentIndex += 1) {
          if (current.answer[currentIndex] !== placedChar) continue;

          const nextDirection: Direction = placedWord.direction === 'across' ? 'down' : 'across';
          const intersectionRow =
            placedWord.row + (placedWord.direction === 'down' ? placedIndex : 0);
          const intersectionCol =
            placedWord.col + (placedWord.direction === 'across' ? placedIndex : 0);

          const nextRow = nextDirection === 'down' ? intersectionRow - currentIndex : intersectionRow;
          const nextCol = nextDirection === 'across' ? intersectionCol - currentIndex : intersectionCol;

          if (!canPlaceWord(current.answer, nextRow, nextCol, nextDirection, occupied)) continue;

          candidates.push({
            id: current.id,
            question: current.question,
            answer: current.answer,
            row: nextRow,
            col: nextCol,
            direction: nextDirection,
            intersections: countIntersections(current.answer, nextRow, nextCol, nextDirection, occupied),
          });
        }
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    const maxIntersections = Math.max(...candidates.map((candidate) => candidate.intersections));
    const topCandidates = candidates.filter((candidate) => candidate.intersections === maxIntersections);
    const selected = topCandidates[Math.floor(Math.random() * topCandidates.length)];

    placeWord(
      {
        id: selected.id,
        question: selected.question,
        answer: selected.answer,
        row: selected.row,
        col: selected.col,
        direction: selected.direction,
      },
      occupied,
      placed
    );
  }

  let minRow = Number.POSITIVE_INFINITY;
  let maxRow = Number.NEGATIVE_INFINITY;
  let minCol = Number.POSITIVE_INFINITY;
  let maxCol = Number.NEGATIVE_INFINITY;

  occupied.forEach((_value, key) => {
    const [rowText, colText] = key.split(',');
    const row = Number(rowText);
    const col = Number(colText);

    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
    minCol = Math.min(minCol, col);
    maxCol = Math.max(maxCol, col);
  });

  if (!Number.isFinite(minRow) || !Number.isFinite(minCol)) return null;

  const sortedByStart = [...placed].sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });

  let nextNumber = 1;
  const startNumberMap = new Map<string, number>();
  const entries: CrosswordEntry[] = sortedByStart.map((entry) => {
    const startKey = cellKey(entry.row, entry.col);
    if (!startNumberMap.has(startKey)) {
      startNumberMap.set(startKey, nextNumber);
      nextNumber += 1;
    }

    return {
      ...entry,
      number: startNumberMap.get(startKey) || 0,
    };
  });

  const cells: Record<string, CrosswordCell> = {};
  occupied.forEach((value, key) => {
    const [rowText, colText] = key.split(',');
    const row = Number(rowText);
    const col = Number(colText);

    cells[key] = {
      row,
      col,
      solution: value.char,
      number: startNumberMap.get(key),
    };
  });

  return {
    entries,
    cells,
    minRow,
    maxRow,
    minCol,
    maxCol,
  };
};

export default function CrosswordPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const testId = params.id as string;

  const [testTitle, setTestTitle] = useState('');
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [roundQuestions, setRoundQuestions] = useState<Question[]>([]);
  const [layout, setLayout] = useState<CrosswordLayout | null>(null);
  const [cellInputs, setCellInputs] = useState<Record<string, string>>({});
  const [seenQuestionIds, setSeenQuestionIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentDirection, setCurrentDirection] = useState<Direction | null>(null);
  const [lastFilledCell, setLastFilledCell] = useState<string | null>(null);
  const loadRef = useRef(0);
  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const getRoundSize = (totalQuestions: number) =>
    Math.min(MAX_CROSSWORD_QUESTIONS, Math.max(MIN_CROSSWORD_QUESTIONS, totalQuestions || 0));

  const normalizeImageSrc = (question: Question) => {
    if (!question.image) return undefined;
    if (question.image.startsWith('data:')) return question.image;
    const mimeType = question.imageMimeType || 'image/png';
    return `data:${mimeType};base64,${question.image}`;
  };

  const selectRoundQuestionsBySize = (source: Question[], seen: Set<string>, roundSize: number) => {
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

  const buildRound = (source: Question[], seen: Set<string>): RoundData | null => {
    const cleanedPool = source.filter((q) => normalizeAnswer(q.text).length >= 2);
    const maxSize = Math.min(MAX_CROSSWORD_QUESTIONS, cleanedPool.length);

    for (let size = maxSize; size >= MIN_CROSSWORD_QUESTIONS; size -= 1) {
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const selected = selectRoundQuestionsBySize(cleanedPool, seen, size);
        if (selected.length < MIN_CROSSWORD_QUESTIONS) continue;

        for (let layoutAttempt = 0; layoutAttempt < 50; layoutAttempt += 1) {
          const shuffled = shuffle(selected);
          const ordered = [...shuffled].sort(
            (a, b) => normalizeAnswer(b.text).length - normalizeAnswer(a.text).length
          );
          const built = buildCrosswordLayout(ordered);

          if (built) {
            return { questions: ordered, layout: built };
          }
        }
      }
    }

    return null;
  };

  const setupRound = (round: RoundData) => {
    setRoundQuestions(round.questions);
    setLayout(round.layout);
    setCellInputs({});
    setCurrentDirection(null);
    setLastFilledCell(null);
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
          setError('You do not have permission to access this test. Only the creator can use crossword puzzle.');
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

        if (activeQuestions.length < MIN_CROSSWORD_QUESTIONS) {
          setError(
            `Crossword puzzle requires at least ${MIN_CROSSWORD_QUESTIONS} active questions. Currently only ${activeQuestions.length} available.`
          );
          setLoading(false);
          return;
        }

        const initialRound = buildRound(activeQuestions, new Set<string>());
        if (!initialRound) {
          setError('Unable to build a crossing-letter crossword from these questions. Add more overlapping words and try again.');
          setLoading(false);
          return;
        }

        const initialSeen = new Set(initialRound.questions.map((q) => q._id));

        setSeenQuestionIds(initialSeen);
        setupRound(initialRound);
        setLoading(false);
      })
      .catch((err) => {
        if (currentLoad !== loadRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load crossword puzzle');
        setLoading(false);
      });
  }, [testId, status, session?.user?.id]);

  const handleCellChange = (key: string, value: string) => {
    const nextValue = value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(-1);
    setCellInputs((current) => {
      const updated = { ...current, [key]: nextValue };
      
      // Check if the entered character is correct
      if (nextValue && layout) {
        const cell = layout.cells[key];
        if (cell && nextValue === cell.solution) {
          // Character is correct, determine direction from previous cell
          let detectedDirection: Direction | null = null;
          
          // If we have a previous cell, detect direction from movement
          if (lastFilledCell && lastFilledCell !== key) {
            const [prevRowStr, prevColStr] = lastFilledCell.split(',');
            const [currRowStr, currColStr] = key.split(',');
            const prevRow = Number(prevRowStr);
            const prevCol = Number(prevColStr);
            const currRow = Number(currRowStr);
            const currCol = Number(currColStr);
            
            // Determine direction based on which coordinate changed
            if (currRow !== prevRow) {
              detectedDirection = 'down';
            } else if (currCol !== prevCol) {
              detectedDirection = 'across';
            }
          }
          
          // Update last filled cell for next iteration
          setLastFilledCell(key);
          
          // Focus to next available (empty) cell in the same direction
          const [rowStr, colStr] = key.split(',');
          const row = Number(rowStr);
          const col = Number(colStr);
          
          // Use detected direction, fallback to current direction, then try both
          const directionsToTry: Direction[] = [];
          if (detectedDirection) {
            directionsToTry.push(detectedDirection);
            setCurrentDirection(detectedDirection);
          } else if (currentDirection) {
            directionsToTry.push(currentDirection);
          } else {
            directionsToTry.push('across', 'down');
          }
          
          // Find entries that contain this cell, prioritize the detected/current direction
          let targetKey: string | null = null;
          
          for (const direction of directionsToTry) {
            for (const entry of layout.entries) {
              if (entry.direction !== direction) continue;
              
              const stepRow = entry.direction === 'down' ? 1 : 0;
              const stepCol = entry.direction === 'across' ? 1 : 0;
              
              for (let i = 0; i < entry.answer.length; i += 1) {
                const cellRow = entry.row + stepRow * i;
                const cellCol = entry.col + stepCol * i;
                
                if (cellRow === row && cellCol === col) {
                  // Found the entry in this direction
                  // Look for next empty cell in this direction
                  for (let j = i + 1; j < entry.answer.length; j += 1) {
                    const nextCellRow = entry.row + stepRow * j;
                    const nextCellCol = entry.col + stepCol * j;
                    const nextCellKey = cellKey(nextCellRow, nextCellCol);
                    
                    // Skip already filled cells
                    if (!updated[nextCellKey]) {
                      targetKey = nextCellKey;
                      break;
                    }
                  }
                  break;
                }
              }
              if (targetKey) break;
            }
            if (targetKey) break;
          }
          
          if (targetKey) {
            setTimeout(() => {
              cellRefs.current[targetKey]?.focus();
            }, 0);
          }
        }
      }
      
      return updated;
    });
  };

  const isCellCorrect = (key: string) => {
    if (!layout) return false;
    const cell = layout.cells[key];
    if (!cell) return false;
    return (cellInputs[key] || '').toUpperCase() === cell.solution;
  };

  const isEntrySolved = (entry: CrosswordEntry) => {
    for (let i = 0; i < entry.answer.length; i += 1) {
      const row = entry.row + (entry.direction === 'down' ? i : 0);
      const col = entry.col + (entry.direction === 'across' ? i : 0);
      if (!isCellCorrect(cellKey(row, col))) return false;
    }
    return true;
  };

  const handleCellFocus = (key: string) => {
    // Determine which direction this cell should navigate
    if (!layout) return;
    
    const [rowStr, colStr] = key.split(',');
    const row = Number(rowStr);
    const col = Number(colStr);
    
    // Find the first entry containing this cell and set that as current direction
    for (const entry of layout.entries) {
      const stepRow = entry.direction === 'down' ? 1 : 0;
      const stepCol = entry.direction === 'across' ? 1 : 0;
      
      for (let i = 0; i < entry.answer.length; i += 1) {
        const cellRow = entry.row + stepRow * i;
        const cellCol = entry.col + stepCol * i;
        
        if (cellRow === row && cellCol === col) {
          setCurrentDirection(entry.direction);
          return;
        }
      }
    }
  };

  const solvedCount = layout ? layout.entries.filter((entry) => isEntrySolved(entry)).length : 0;
  const allSolved = layout ? layout.entries.length > 0 && solvedCount === layout.entries.length : false;

  const handleRestart = () => {
    if (allQuestions.length < MIN_CROSSWORD_QUESTIONS) return;

    const nextRound = buildRound(allQuestions, seenQuestionIds);
    if (!nextRound) {
      setError('Unable to build a new crossing-letter crossword for restart. Add more overlapping words and try again.');
      return;
    }

    const nextSeen = new Set(seenQuestionIds);
    nextRound.questions.forEach((q) => nextSeen.add(q._id));

    setSeenQuestionIds(nextSeen);
    setupRound(nextRound);
  };

  const acrossEntries = layout
    ? [...layout.entries]
        .filter((entry) => entry.direction === 'across')
        .sort((a, b) => a.number - b.number)
    : [];

  const downEntries = layout
    ? [...layout.entries]
        .filter((entry) => entry.direction === 'down')
        .sort((a, b) => a.number - b.number)
    : [];

  const gridRows = layout ? layout.maxRow - layout.minRow + 1 : 0;
  const gridCols = layout ? layout.maxCol - layout.minCol + 1 : 0;

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading crossword puzzle...</p>
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
          <h1 className="text-2xl font-bold text-gray-900">{testTitle} - Crossword Puzzle</h1>
          <p className="mt-2 text-sm text-gray-600">
            Fill the crossing-letter grid using image clues. Solved: {solvedCount} / {roundQuestions.length}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Questions per round: {getRoundSize(allQuestions.length)} (min {MIN_CROSSWORD_QUESTIONS}, max {MAX_CROSSWORD_QUESTIONS}).
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Restart will prioritize questions you have not done yet, then fill remaining slots with randomized previously shown questions.
          </p>
        </div>

        {layout && (
          <div className="mb-8 rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Crossword Grid</h2>
            <div className="overflow-x-auto">
              <div
                className="inline-grid gap-1 rounded-xl bg-gray-200 p-2"
                style={{
                  gridTemplateColumns: `repeat(${gridCols}, minmax(0, 2.4rem))`,
                }}
              >
                {Array.from({ length: gridRows }).map((_, rowIndex) =>
                  Array.from({ length: gridCols }).map((__, colIndex) => {
                    const absRow = rowIndex + layout.minRow;
                    const absCol = colIndex + layout.minCol;
                    const key = cellKey(absRow, absCol);
                    const cell = layout.cells[key];

                    if (!cell) {
                      return <div key={key} className="h-10 w-10 rounded-md bg-gray-300" />;
                    }

                    const typed = cellInputs[key] || '';
                    const hasValue = typed.length > 0;
                    const isCorrect = isCellCorrect(key);

                    return (
                      <div key={key} className="relative h-10 w-10">
                        {cell.number && (
                          <span className="absolute left-1 top-0 z-10 text-[9px] font-semibold text-gray-500">
                            {cell.number}
                          </span>
                        )}
                        <input
                          ref={(el) => {
                            if (el) cellRefs.current[key] = el;
                          }}
                          value={typed}
                          onChange={(event) => handleCellChange(key, event.target.value)}
                          onFocus={() => handleCellFocus(key)}
                          className={`h-10 w-10 rounded-md border-2 bg-white text-center text-lg font-bold uppercase focus:outline-none ${
                            !hasValue
                              ? 'border-gray-300 text-gray-900 focus:border-blue-500'
                              : isCorrect
                                ? 'border-green-400 text-green-700 focus:border-green-500'
                                : 'border-red-300 text-red-700 focus:border-red-400'
                          }`}
                          maxLength={1}
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {allSolved ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900">Great work!</h2>
            <p className="mt-2 text-sm text-gray-600">You solved all crossword clues in this round.</p>
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
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Clues</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">Across</h3>
                <div className="space-y-3">
                  {acrossEntries.length === 0 ? (
                    <p className="text-sm text-gray-500">No across clues.</p>
                  ) : (
                    acrossEntries.map((entry) => {
                      const solved = isEntrySolved(entry);
                      return (
                        <div
                          key={`${entry.id}-across`}
                          className={`rounded-2xl border p-3 ${
                            solved ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <p className="text-sm font-semibold text-gray-800">
                            {entry.number}. ({entry.answer.length})
                          </p>
                          <div className="mt-2">
                            {entry.question.image ? (
                              <img
                                src={entry.question.image}
                                alt={`Across clue ${entry.number}`}
                                className="h-32 w-full rounded-lg border border-gray-200 bg-white p-1 object-contain"
                              />
                            ) : (
                              <div className="inline-flex h-32 w-full items-center justify-center rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-500">
                                No image
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">Down</h3>
                <div className="space-y-3">
                  {downEntries.length === 0 ? (
                    <p className="text-sm text-gray-500">No down clues.</p>
                  ) : (
                    downEntries.map((entry) => {
                      const solved = isEntrySolved(entry);
                      return (
                        <div
                          key={`${entry.id}-down`}
                          className={`rounded-2xl border p-3 ${
                            solved ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <p className="text-sm font-semibold text-gray-800">
                            {entry.number}. ({entry.answer.length})
                          </p>
                          <div className="mt-2">
                            {entry.question.image ? (
                              <img
                                src={entry.question.image}
                                alt={`Down clue ${entry.number}`}
                                className="h-32 w-full rounded-lg border border-gray-200 bg-white p-1 object-contain"
                              />
                            ) : (
                              <div className="inline-flex h-32 w-full items-center justify-center rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-500">
                                No image
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
