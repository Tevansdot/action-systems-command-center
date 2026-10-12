import Link from "next/link";
export default function NotFound() {
  return (
    <main className="error-page">
      <h1>This page isn’t here</h1>
      <p>Head back to your workspace to continue.</p>
      <Link className="button primary" href="/dashboard">
        Open dashboard
      </Link>
    </main>
  );
}
