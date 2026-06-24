import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import SubmitButton from '@/components/SubmitButton';
import { resetPassword } from './actions';

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-xl border border-gray-100 shadow-card p-8">
          <h1 className="text-3xl font-bold leading-snug text-foreground text-center mb-2">
            Reset Password
          </h1>
          <p className="text-sm text-gray-500 text-center mb-6">
            Enter your email address and we will send you a link to reset your password.
          </p>

          <form action={resetPassword}>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors mb-4"
            />
            <SubmitButton
              pendingLabel="Sending link…"
              className="w-full bg-primary text-white hover:bg-secondary rounded-lg px-6 py-3 font-semibold transition-colors duration-200 focus-visible:outline-primary"
            >
              Reset Password
            </SubmitButton>
          </form>

          <Link href="/login" className="text-sm text-gray-500 hover:text-primary transition-colors block text-center mt-6">
            Back to login
          </Link>
          
          {error && (
            <div className="mt-4 text-center text-sm font-medium text-destructive">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 text-center text-sm font-medium text-emerald-600">
              {success}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
