import { updateUserPassword } from './actions';

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-gray-100 shadow-card p-8">
        <h1 className="text-3xl font-bold text-foreground text-center mb-6">Set Your Password</h1>
        
        <form action={updateUserPassword} className="flex flex-col gap-4">
          <input
            type="password"
            name="password"
            placeholder="New Password"
            required
            className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
          />
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            required
            className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
          />
          <button
            type="submit"
            className="w-full bg-primary text-white hover:bg-secondary focus-visible:outline-primary px-6 py-3 rounded-lg font-semibold transition-colors duration-200"
          >
            Save and Continue
          </button>
        </form>

        {message && (
          <div className="text-red-500 mt-4 text-center text-sm font-medium">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
