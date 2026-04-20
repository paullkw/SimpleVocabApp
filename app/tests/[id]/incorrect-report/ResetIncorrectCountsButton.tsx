'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  testId: string;
};

export default function ResetIncorrectCountsButton({ testId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`/api/tests/${testId}/incorrect-counts`, {
        method: 'PATCH',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset incorrect counts');
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset incorrect counts');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleReset}
        disabled={loading}
        className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
      >
        {loading ? 'Resetting...' : 'Reset Incorrect Count'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
