'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  testId: string;
  initialTitle: string;
  createdBy: string;
  updatedBy: string;
};

export default function EditTestForm({ testId, initialTitle, createdBy, updatedBy }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch('/api/tests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: testId, title: title.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to update test');
      } else {
        router.push('/');
      }
    } catch (err) {
      setError('Unable to update test');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-3xl bg-white p-8 shadow-sm">
      <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Title
            </label>
            <input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            <p>
              Created by <span className="font-medium text-gray-900">{createdBy}</span>
            </p>
            <p>
              Updated by <span className="font-medium text-gray-900">{updatedBy}</span>
            </p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {saving ? 'Saving…' : 'Save changes'}
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
    </div>
  );
}
