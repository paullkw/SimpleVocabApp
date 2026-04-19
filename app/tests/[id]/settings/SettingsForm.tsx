'use client';

import { FormEvent, useState } from 'react';

type Props = {
  testId: string;
  initialConsecutiveCorrectToDeactivate: number;
};

export default function SettingsForm({ testId, initialConsecutiveCorrectToDeactivate }: Props) {
  const [consecutiveCorrectToDeactivate, setConsecutiveCorrectToDeactivate] = useState(
    initialConsecutiveCorrectToDeactivate
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!Number.isInteger(consecutiveCorrectToDeactivate) || consecutiveCorrectToDeactivate < 1) {
      setError('Consecutive correct count must be a whole number greater than 0');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/tests/${testId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consecutiveCorrectToDeactivate }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to update settings');
        return;
      }

      setSuccessMessage('Settings updated successfully');
      setConsecutiveCorrectToDeactivate(Number(data.consecutiveCorrectToDeactivate));
    } catch (err) {
      setError('Unable to update settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-4 rounded-3xl border border-gray-200 bg-gray-50 p-6" onSubmit={handleSubmit}>
      <div>
        <label
          htmlFor="consecutiveCorrectToDeactivate"
          className="block text-sm font-medium text-gray-700"
        >
          Consecutive Correct To Inactivate Question
        </label>
        <input
          id="consecutiveCorrectToDeactivate"
          type="number"
          min={1}
          step={1}
          value={consecutiveCorrectToDeactivate}
          onChange={(event) => setConsecutiveCorrectToDeactivate(Number(event.target.value))}
          className="mt-2 w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none"
        />
        <p className="mt-2 text-sm text-gray-600">
          When a question is answered correctly this many times in a row, it will automatically become inactive.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </form>
  );
}