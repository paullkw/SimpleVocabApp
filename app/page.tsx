'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type TestItem = {
  _id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { _id: string; username: string } | string;
  updatedBy: { _id: string; username: string } | string;
};

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [tests, setTests] = useState<TestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [deletingTestId, setDeletingTestId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const loadTests = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/tests');
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to load tests');
      } else {
        setTests(data);
      }
    } catch (err) {
      setError('Unable to load tests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      loadTests();
    }
  }, [status]);

  // Show loading state while checking authentication
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

  // Redirect if not authenticated
  if (!session) {
    return null;
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    setCreateLoading(true);

    try {
      const response = await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create test');
      } else {
        setTests((current) => [data, ...current]);
        setTitle('');
        setShowForm(false);
      }
    } catch (err) {
      setError('Unable to create test');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDelete = async (testId: string, title: string) => {
    const confirmed = window.confirm(`Delete test \"${title}\"? This cannot be undone.`);
    if (!confirmed) return;

    setError('');
    setDeletingTestId(testId);

    try {
      const response = await fetch(`/api/tests/${testId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to delete test');
        return;
      }

      setTests((current) => current.filter((test) => test._id !== testId));
    } catch (err) {
      setError('Unable to delete test');
    } finally {
      setDeletingTestId(null);
    }
  };


  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <Link href="/" className="text-2xl font-bold text-gray-900">
              Simple Vocab
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {session ? (
              <>
                <span className="text-sm text-gray-600">
                  Welcome, <strong>{(session.user as any).username || session.user?.name}</strong>
                </span>
                <button
                  onClick={() => signOut()}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl bg-white p-8 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Test collection</h1>
            <p className="mt-2 text-gray-600">
              Browse the list of tests from the database and create a new one if you are signed in.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {session ? (
              <button
                type="button"
                onClick={() => setShowForm((value) => !value)}
                className="rounded-md bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                {showForm ? 'Cancel' : 'Create test'}
              </button>
            ) : (
              <Link
                href="/login"
                className="rounded-md bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                Sign in to create
              </Link>
            )}
          </div>
        </div>

        {showForm && session && (
          <section className="mb-8 rounded-3xl bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">Create a new test</h2>
            <form className="mt-6 space-y-4" onSubmit={handleCreate}>
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                  Title
                </label>
                <input
                  id="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Enter test title"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={createLoading}
                className="inline-flex items-center justify-center rounded-2xl bg-green-600 px-5 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-400"
              >
                {createLoading ? 'Creating…' : 'Create Test'}
              </button>
            </form>
          </section>
        )}

        <section className="rounded-3xl bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Tests</h2>
              <p className="text-sm text-gray-600">All tests stored in the collection.</p>
            </div>
            {loading && <span className="text-sm text-gray-500">Loading…</span>}
          </div>

          {error && <p className="mb-6 text-sm text-red-600">{error}</p>}

          {tests.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-300 px-6 py-12 text-center text-gray-500">
              No tests found yet.
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tests.map((test) => (
                <div key={test._id} className="rounded-3xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900">{test.title}</h3>
                  <p className="mt-3 text-sm text-gray-600">
                    Created by{' '}
                    <span className="font-medium text-gray-900">
                      {typeof test.createdBy === 'string'
                        ? test.createdBy
                        : test.createdBy?.username || 'Unknown'}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Updated by{' '}
                    <span className="font-medium text-gray-900">
                      {typeof test.updatedBy === 'string'
                        ? test.updatedBy
                        : test.updatedBy?.username || 'Unknown'}
                    </span>
                  </p>
                  {session && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/tests/${test._id}/edit`}
                        className="inline-flex rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/tests/${test._id}/quiz`}
                        className="inline-flex rounded-2xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                      >
                        Multiple Choice
                      </Link>
                      <Link
                        href={`/tests/${test._id}/flashcard`}
                        className="inline-flex rounded-2xl bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
                      >
                        Flashcard
                      </Link>
                      <Link
                        href={`/tests/${test._id}/matching`}
                        className="inline-flex rounded-2xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                      >
                        Matching
                      </Link>
                      <Link
                        href={`/tests/${test._id}/memory`}
                        className="inline-flex rounded-2xl bg-pink-600 px-4 py-2 text-sm font-medium text-white hover:bg-pink-700"
                      >
                        Memory Game
                      </Link>
                      <Link
                        href={`/tests/${test._id}/settings`}
                        className="inline-flex rounded-2xl bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                      >
                        Setting
                      </Link>
                      <Link
                        href={`/tests/${test._id}/incorrect-report`}
                        className="inline-flex rounded-2xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                      >
                        Incorrect Report
                      </Link>
                      <Link
                        href={`/tests/${test._id}/clone`}
                        className="inline-flex rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
                      >
                        Clone
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(test._id, test.title)}
                        disabled={deletingTestId === test._id}
                        className="inline-flex rounded-2xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-400"
                      >
                        {deletingTestId === test._id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  )}
                  <div className="mt-6 space-y-2 text-sm text-gray-500">
                    <p>Created: {new Date(test.createdAt).toLocaleString()}</p>
                    <p>Updated: {new Date(test.updatedAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
