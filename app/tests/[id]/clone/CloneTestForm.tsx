'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type CloneQuestion = {
  id: string;
  text: string;
  image?: string;
  imageMimeType?: string;
  totalIncorrectCount?: number;
};

type Props = {
  testId: string;
  initialTitle: string;
  questions: CloneQuestion[];
};

export default function CloneTestForm({ testId, initialTitle, questions }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>(
    questions.map((question) => question.id)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedCount = selectedQuestionIds.length;

  const selectedLookup = useMemo(() => new Set(selectedQuestionIds), [selectedQuestionIds]);

  const normalizeImageSrc = (question: CloneQuestion) => {
    if (!question.image) return undefined;
    if (question.image.startsWith('data:')) {
      return question.image;
    }
    const mimeType = question.imageMimeType || 'image/png';
    return `data:${mimeType};base64,${question.image}`;
  };

  const handleToggleQuestion = (questionId: string) => {
    setSelectedQuestionIds((current) => {
      if (current.includes(questionId)) {
        return current.filter((id) => id !== questionId);
      }
      return [...current, questionId];
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    if (selectedQuestionIds.length === 0) {
      setError('Please select at least one question to clone');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/tests/${testId}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          selectedQuestionIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to clone test');
        return;
      }

      router.push('/');
    } catch (err) {
      setError('Unable to clone test');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="clone-title" className="block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          id="clone-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Questions</h2>
          <span className="text-sm text-gray-600">{selectedCount} selected</span>
        </div>

        {questions.length === 0 ? (
          <p className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            This test has no questions to clone.
          </p>
        ) : (
          <div className="space-y-3">
            {questions.map((question, index) => {
              const checked = selectedLookup.has(question.id);
              return (
                <label
                  key={question.id}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggleQuestion(question.id)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">Question {index + 1}</p>
                    <p className="mt-1 break-words text-sm text-gray-700">{question.text || '(No text)'}</p>
                    <p className="mt-1 text-xs text-gray-600">
                      Incorrect count: {Number(question.totalIncorrectCount || 0)}
                    </p>
                    {question.image && (
                      <img
                        src={normalizeImageSrc(question)}
                        alt={`Question ${index + 1}`}
                        className="mt-2 h-20 w-20 rounded-lg object-cover"
                      />
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving || questions.length === 0}
          className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          {saving ? 'Saving...' : 'Save Clone'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
