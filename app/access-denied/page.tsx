import Link from 'next/link';

export default function AccessDeniedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white shadow-lg rounded-xl p-8 text-center border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Access Denied
        </h1>
        <p className="text-gray-600 mb-8">
          You do not have permission to view this page. If you believe this is an error, please contact your Club Director or ThinkBiz Support.
        </p>
        <Link 
          href="/dashboard"
          className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    </main>
  );
}
