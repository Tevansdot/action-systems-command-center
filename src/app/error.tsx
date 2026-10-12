"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>Your workspace couldn’t be loaded</h1>
      <p>
        Try again. For a new live setup, apply the Supabase migration and check
        your environment configuration.
      </p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
      <a className="button secondary" href="/login">
        Return to sign in
      </a>
    </main>
  );
}
