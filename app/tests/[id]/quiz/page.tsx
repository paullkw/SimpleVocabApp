'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type Question = {
  _id: string;
  text: string;
  image?: string;
  imageMimeType?: string;
};

type QuizQuestion = {
  question: Question;
  options: string[];
  correctAnswer: string;
};

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const testId = params.id as string;

  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [testData, setTestData] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadQuiz();
  }, [testId]);

  const loadQuiz = async () => {
    try {
      // Fetch the test with questions
      const testResponse = await fetch(`/api/tests/${testId}`);
      if (!testResponse.ok) {
        throw new Error('Failed to load test');
      }
      const testData = await testResponse.json();
      setTestData(testData);

      // Fetch all questions for random answers
      const allQuestionsResponse = await fetch('/api/questions');
      if (!allQuestionsResponse.ok) {
        throw new Error('Failed to load questions');
      }
      const allQuestions: Question[] = await allQuestionsResponse.json();

      // Filter questions that have text (which is now the answer)
      const questionsWithAnswers = testData.questions.filter((q: Question) => q.text && q.text.trim());

      // Filter all questions that have text for random distractors
      const allQuestionsWithAnswers = allQuestions.filter((q: Question) => q.text && q.text.trim());

      // Generate quiz questions
      const quizQs: QuizQuestion[] = questionsWithAnswers.map((q: Question) => {
        const correctAnswer = q.text.trim();
        // Get 3 random answers from other questions
        const otherAnswers = allQuestionsWithAnswers
          .filter(otherQ => otherQ._id !== q._id)
          .map(otherQ => otherQ.text.trim())
          .filter(answer => answer !== correctAnswer); // Avoid duplicates

        // Shuffle and take up to 3
        const shuffled = otherAnswers.sort(() => 0.5 - Math.random());
        let randomAnswers = shuffled.slice(0, 3);

        // Ensure we have at least 3 options total (correct + 3 random)
        // If not enough random answers, add some dummy options
        while (randomAnswers.length < 3) {
          const dummyOptions = ['Incorrect Answer', 'Wrong Choice', 'Not This One'];
          const availableDummies = dummyOptions.filter(opt => !randomAnswers.includes(opt) && opt !== correctAnswer);
          if (availableDummies.length > 0) {
            randomAnswers.push(availableDummies[0]);
          } else {
            // If all dummies are used, add a numbered option
            randomAnswers.push(`Option ${randomAnswers.length + 1}`);
          }
        }

        // Combine correct and random answers, shuffle, and filter out empties
        const options = [correctAnswer, ...randomAnswers]
          .filter(opt => opt && opt.trim())
          .sort(() => 0.5 - Math.random());

        return {
          question: q,
          options,
          correctAnswer,
        };
      });

      setQuizQuestions(quizQs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quiz');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer);
  };

  const handleNext = () => {
    if (selectedAnswer === quizQuestions[currentQuestionIndex].correctAnswer) {
      setScore(score + 1);
    }

    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer('');
    } else {
      setShowResult(true);
    }
  };

  const handleRestart = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer('');
    setScore(0);
    setShowResult(false);
    loadQuiz(); // Reload to reshuffle
  };

  if (loading) {
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

  const currentQuizQuestion = quizQuestions[currentQuestionIndex];

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
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-600">
                Question {currentQuestionIndex + 1} of {quizQuestions.length}
              </span>
              <span className="text-sm text-gray-600">
                Score: {score}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / quizQuestions.length) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="mb-8">
            {/* Question text is hidden as it contains the answer */}
            {currentQuizQuestion.question.image && (
              <img
                src={currentQuizQuestion.question.image}
                alt="Question"
                className="max-w-md mx-auto rounded-lg shadow-sm"
              />
            )}
          </div>

          <div className="space-y-3 mb-8">
            {currentQuizQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(option)}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-colors ${
                  selectedAnswer === option
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-gray-900">{option}</span>
              </button>
            ))}
          </div>

          <div className="flex justify-between">
            <Link
              href="/"
              className="rounded-2xl border border-gray-300 bg-white px-6 py-3 text-gray-700 hover:bg-gray-50"
            >
              Quit Quiz
            </Link>
            <button
              onClick={handleNext}
              disabled={!selectedAnswer}
              className="rounded-2xl bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {currentQuestionIndex === quizQuestions.length - 1 ? 'Finish Quiz' : 'Next Question'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}