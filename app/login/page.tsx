import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { LoginForm } from '@/components/login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-xl border border-gray-100 shadow-card p-8 transition-all duration-200">
          <h1 className="text-3xl font-bold leading-snug text-foreground text-center mb-6">Welcome Back</h1>
          
          {/* Inject the interactive client form here */}
          <LoginForm />

          <div className="mt-6 text-center text-sm text-gray-500">
            Don&apos;t have an account? <Link href="/apply" className="text-primary hover:text-secondary font-semibold transition-colors duration-200">Apply to join</Link>
          </div>

          {message && (
            <div className="text-destructive mt-4 text-center text-sm font-medium">
              {message}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}