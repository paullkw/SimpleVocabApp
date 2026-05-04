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

type QuizQuestion = {
  question: Question;
  options: string[];
  correctAnswer: string;
};

type AnswerStatus = {
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
};

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const testId = params.id as string;

  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [testData, setTestData] = useState<any>(null);
  const [answers, setAnswers] = useState<Map<string, AnswerStatus>>(new Map());
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [submittingQuestionIds, setSubmittingQuestionIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const loadRef = useRef(0);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (!testId || status !== 'authenticated') return;
    loadRef.current += 1;
    setLoading(true);
    setIsReady(false);
    setQuizQuestions([]);
    setTestData(null);
    setAnswers(new Map());
    setShowResult(false);
    setError('');
    loadQuiz(loadRef.current);
  }, [testId, status]);

  const normalizeImageSrc = (question: Question) => {
    if (!question.image) return undefined;
    if (question.image.startsWith('data:')) {
      return question.image;
    }
    const mimeType = question.imageMimeType || 'image/png';
    return `data:${mimeType};base64,${question.image}`;
  };

  const normalizeAnswerKey = (answer: string) => answer.trim().replace(/\s+/g, ' ').toLowerCase();

  const uniqueAnswers = (answers: string[]) => {
    const seen = new Set<string>();

    return answers.filter((answer) => {
      const normalizedAnswer = normalizeAnswerKey(answer);

      if (!normalizedAnswer || seen.has(normalizedAnswer)) {
        return false;
      }

      seen.add(normalizedAnswer);
      return true;
    });
  };

  const loadQuiz = async (loadId?: number) => {
    const currentLoadId = loadId ?? loadRef.current;
    if (!testId) return;
    try {
      // Fetch the test with questions
      const testResponse = await fetch(`/api/tests/${testId}`);
      if (!testResponse.ok) {
        throw new Error('Failed to load test');
      }
      const testData = await testResponse.json();
      if (currentLoadId !== loadRef.current) return;
      
      // Check if current user is the creator of this test
      const testCreatorId = String(
        typeof testData.createdBy === 'string' ? testData.createdBy : testData.createdBy?._id || ''
      );
      const currentUserId = String(session?.user?.id || '');

      if (!testCreatorId || testCreatorId !== currentUserId) {
        if (currentLoadId === loadRef.current) {
          setError('You do not have permission to access this test. Only the creator can take their own tests.');
          setLoading(false);
          setIsReady(true);
        }
        return;
      }

      setTestData(testData);

      // Filter questions that have text (which is now the answer)
      const questionsWithAnswers = [...(testData.questions || [])]
        .filter((q: Question) => q.active && q.text && q.text.trim())
        .sort(() => 0.5 - Math.random());

      // Check if we have at least 4 active questions
      if (questionsWithAnswers.length < 4) {
        if (currentLoadId === loadRef.current) {
          setError(`This quiz requires at least 4 active questions. Currently only ${questionsWithAnswers.length} active question(s) available.`);
          setLoading(false);
          setIsReady(true);
        }
        return;
      }

      // Use only questions in the current test for random distractors.
      const questionsInCurrentTestWithAnswers = questionsWithAnswers;

      // Generate quiz questions
      const quizQs: QuizQuestion[] = questionsWithAnswers.map((q: Question) => {
        const correctAnswer = q.text.trim();
        const correctAnswerKey = normalizeAnswerKey(correctAnswer);

        // Get 3 random answers from other questions
        const otherAnswers = uniqueAnswers(
          questionsInCurrentTestWithAnswers
            .filter(otherQ => otherQ._id !== q._id)
            .map(otherQ => otherQ.text.trim())
            .filter(answer => normalizeAnswerKey(answer) !== correctAnswerKey)
        );

        // Shuffle and take up to 3
        const shuffled = otherAnswers.sort(() => 0.5 - Math.random());
        let randomAnswers = shuffled.slice(0, 3);

        // Ensure we have at least 3 options total (correct + 3 random)
        // If not enough random answers, add some dummy options
        while (randomAnswers.length < 3) {
          const dummyOptions = ['Incorrect Answer', 'Wrong Choice', 'Not This One'];
          const usedAnswerKeys = new Set(randomAnswers.map(normalizeAnswerKey));
          const availableDummies = dummyOptions.filter(
            opt => !usedAnswerKeys.has(normalizeAnswerKey(opt)) && normalizeAnswerKey(opt) !== correctAnswerKey
          );
          if (availableDummies.length > 0) {
            randomAnswers.push(availableDummies[0]);
          } else {
            // If all dummies are used, add a numbered option
            randomAnswers.push(`Option ${randomAnswers.length + 1}`);
          }
        }

        // Combine correct and random answers, shuffle, and filter out empties
        const options = uniqueAnswers([correctAnswer, ...randomAnswers])
          .filter(opt => opt && opt.trim())
          .sort(() => 0.5 - Math.random());

        return {
          question: {
            ...q,
            image: normalizeImageSrc(q),
          },
          options,
          correctAnswer,
        };
      });

      if (currentLoadId !== loadRef.current) return;
      setQuizQuestions(quizQs);
      setIsReady(true);
    } catch (err) {
      if (currentLoadId === loadRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load quiz');
      }
    } finally {
      if (currentLoadId === loadRef.current) {
        setLoading(false);
      }
    }
  };

  const handleAnswerSelect = async (questionIndex: number, answer: string) => {
    const question = quizQuestions[questionIndex];
    const isCorrect = answer === question.correctAnswer;
    const questionId = question.question._id;

    setSubmittingQuestionIds((current) => new Set(current).add(questionId));

    const newAnswers = new Map(answers);
    newAnswers.set(questionId, {
      questionId,
      selectedAnswer: answer,
      isCorrect,
    });
    setAnswers(newAnswers);

    try {
      const response = await fetch('/api/quiz-results', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          testId,
          answers: [
            {
              questionId,
              isCorrect,
            },
          ],
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      let errorMessage = 'Failed to save answer';

      if (contentType.includes('application/json')) {
        const data = await response.json();
        if (!response.ok) {
          errorMessage = data?.error || errorMessage;
        }
      } else {
        const text = await response.text();
        if (!response.ok) {
          // Some failures can return an HTML error page; avoid JSON parse crashes.
          errorMessage =
            text?.trim().startsWith('<!DOCTYPE') || text?.trim().startsWith('<html')
              ? `Request failed (${response.status}). Please refresh and try again.`
              : text || `Request failed (${response.status})`;
        }
      }

      if (!response.ok) {
        throw new Error(errorMessage);
      }
    } catch (err) {
      const revertedAnswers = new Map(newAnswers);
      revertedAnswers.delete(questionId);
      setAnswers(revertedAnswers);
      setError(err instanceof Error ? err.message : 'Unable to save answer');
    } finally {
      setSubmittingQuestionIds((current) => {
        const updated = new Set(current);
        updated.delete(questionId);
        return updated;
      });
    }
  };

  const handleFinishQuiz = () => {
    setShowResult(true);
  };

  const handleRestart = () => {
    loadRef.current += 1;
    setAnswers(new Map());
    setShowResult(false);
    setLoading(true);
    setIsReady(false);
    setError('');
    loadQuiz(loadRef.current); // Reload to reshuffle
  };

  const getScore = () => {
    let correct = 0;
    answers.forEach(answer => {
      if (answer.isCorrect) correct++;
    });
    return correct;
  };

  if (loading || !isReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading quiz...</p>
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

  if (quizQuestions.length === 0) {
    const hasQuestions = testData && testData.questions && testData.questions.length > 0;
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
            {hasQuestions ? (
              <>
                <p className="text-gray-600 mb-4">This test has questions but none of them have text set up for the multiple choice quiz.</p>
                <Link href={`/tests/${testId}/edit`} className="inline-block rounded-2xl bg-blue-600 px-6 py-3 text-white hover:bg-blue-700">
                  Edit Test to Add Question Text
                </Link>
              </>
            ) : (
              <>
                <p className="text-gray-600 mb-4">No questions found in this test.</p>
                <Link href={`/tests/${testId}/edit`} className="inline-block rounded-2xl bg-blue-600 px-6 py-3 text-white hover:bg-blue-700">
                  Edit Test to Add Questions
                </Link>
              </>
            )}
            <div className="mt-4">
              <Link href="/" className="text-blue-600 hover:underline">
                Back to home
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (showResult) {
    const score = getScore();
    const percentage = Math.round((score / quizQuestions.length) * 100);
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
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Quiz Complete!</h1>
            <p className="text-xl text-gray-600 mb-6">
              Your score: {score} out of {quizQuestions.length} ({percentage}%)
            </p>
            <div className="space-x-4">
              <button
                onClick={handleRestart}
                className="rounded-2xl bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
              >
                Take Quiz Again
              </button>
              <Link
                href="/"
                className="rounded-2xl bg-gray-600 px-6 py-3 text-white hover:bg-gray-700 inline-block"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div key={testId} className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-2xl font-bold text-gray-900">
            Simple Vocab
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6">
          <span className="text-sm text-gray-600">
            Progress: {answers.size} of {quizQuestions.length} questions answered
          </span>
        </div>

        <div className="space-y-8">
          {quizQuestions.map((quizQuestion, questionIndex) => {
            const answerStatus = answers.get(quizQuestion.question._id);
            const isAnswered = !!answerStatus;
            const isSubmittingAnswer = submittingQuestionIds.has(quizQuestion.question._id);
            
            return (
              <div key={quizQuestion.question._id} className="rounded-3xl bg-white p-8 shadow-sm">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Question {questionIndex + 1} of {quizQuestions.length}
                  </h3>
                  
                  {quizQuestion.question.image && (
                    <img
                      src={quizQuestion.question.image}
                      alt="Question"
                      className="max-w-md mx-auto rounded-lg shadow-sm mb-4"
                    />
                  )}
                </div>

                <div className="space-y-3">
                  {quizQuestion.options.map((option, index) => {
                    const isSelected = answerStatus?.selectedAnswer === option;
                    const isCorrectAnswer = option === quizQuestion.correctAnswer;
                    
                    let borderClass = 'border-gray-200 hover:border-gray-300';
                    let bgClass = '';
                    
                    if (isAnswered) {
                      if (isSelected && answerStatus.isCorrect) {
                        borderClass = 'border-green-500';
                        bgClass = 'bg-green-50';
                      } else if (isSelected && !answerStatus.isCorrect) {
                        borderClass = 'border-red-500';
                        bgClass = 'bg-red-50';
                      } else if (isCorrectAnswer) {
                        borderClass = 'border-green-500';
                        bgClass = 'bg-green-50';
                      }
                    } else if (isSelected) {
                      borderClass = 'border-blue-500';
                      bgClass = 'bg-blue-50';
                    }
                    
                    return (
                      <button
                        key={index}
                        onClick={() => !isAnswered && handleAnswerSelect(questionIndex, option)}
                        disabled={isAnswered || isSubmittingAnswer}
                        className={`w-full text-left p-4 rounded-2xl border-2 transition-colors disabled:cursor-default ${borderClass} ${bgClass} ${
                          !isAnswered ? 'cursor-pointer' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-gray-900">{option}</span>
                          {isAnswered && isSelected && (
                            <span className={answerStatus.isCorrect ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                              {answerStatus.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                            </span>
                          )}
                          {isAnswered && isCorrectAnswer && !isSelected && (
                            <span className="text-green-600 font-semibold">✓ Correct Answer</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {isSubmittingAnswer && (
                  <p className="mt-3 text-sm text-gray-500">Saving answer...</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex justify-between">
          <Link
            href="/"
            className="rounded-2xl border border-gray-300 bg-white px-6 py-3 text-gray-700 hover:bg-gray-50"
          >
            Quit Quiz
          </Link>
          <button
            onClick={handleFinishQuiz}
            disabled={answers.size !== quizQuestions.length || submittingQuestionIds.size > 0}
            className="rounded-2xl bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Finish Quiz
          </button>
        </div>
      </main>
    </div>
  );
}