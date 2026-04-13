'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

export default function Home() {
  const { data: session } = useSession();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b bg-white">
        <nav className="flex h-16 items-center justify-between px-6">
          <h1 className="text-2xl font-bold text-gray-900">Simple Vocab</h1>
          <div className="flex items-center gap-4">
            {session ? (
              <>
                <span className="text-sm text-gray-600">
                  Welcome, <strong>{(session.user as any).username || session.user?.name}</strong>!
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

      {/* Main content */}
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Welcome to Simple Vocab
          </h2>
          <p className="mt-6 text-lg text-gray-600">
            {session
              ? `You're logged in as ${(session.user as any).username || session.user?.name}. Start learning vocabulary!`
              : 'Sign in or create an account to start learning vocabulary.'}
          </p>
          {!session && (
            <div className="mt-10 flex gap-4 justify-center">
              <Link
                href="/login"
                className="rounded-md bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-700"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-md border border-gray-300 px-6 py-3 text-base font-medium text-gray-700 hover:bg-gray-50"
              >
                Create account
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
