import { login } from './actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm border-4 border-black rounded-xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white p-8">
        <h1 className="font-bold text-2xl mb-6 text-center text-black">ThinkBiz Director Login</h1>
        
        <form action={login} className="flex flex-col gap-4">
          <input
            type="email"
            name="email"
            placeholder="Email"
            required
            className="w-full border-2 border-black rounded-lg p-3 font-medium text-black"
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            className="w-full border-2 border-black rounded-lg p-3 font-medium text-black"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white font-bold text-lg border-2 border-black rounded-lg p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all"
          >
            Submit
          </button>
        </form>

        {message && (
          <div className="mt-4 text-red-600 font-bold text-center">
            {message}
          </div>
        )}
      </div>
    </main>
  );
}
