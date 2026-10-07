import { UpdatePasswordForm } from '@/components/update-password-form';

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <div className="page-shell bg-slate-50 flex items-center justify-center px-4 pb-4">
      <div className="w-full mt-4 max-w-sm bg-white rounded-xl border border-gray-100 shadow-card p-6 sm:p-8">
        <h1 className="text-3xl font-bold text-foreground text-center mb-6">Set Your Password</h1>
        
        <UpdatePasswordForm />

        {message && (
          <div className="text-red-500 mt-4 text-center text-sm font-medium">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
