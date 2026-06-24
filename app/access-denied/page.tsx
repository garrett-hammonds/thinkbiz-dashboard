import Link from 'next/link';

export default function AccessDeniedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white shadow-card rounded-xl p-8 text-center border border-gray-100">
        <h1 className="text-2xl font-bold text-foreground mb-4">
          Access Denied
        </h1>
        <p className="text-gray-500 mb-8">
          You do not have permission to view this page. If you believe this is an error, please contact your Club Director or ThinkBiz Support.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex justify-center items-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-secondary focus-visible:outline-primary"
        >
          Return to Dashboard
        </Link>
      </div>
    </main>
  );
}
