import { Navbar } from "@/components/navbar";
import { WeeklyLogForm } from "@/components/WeeklyLogForm";
import { createClient } from "@/utils/supabase/server";

export default async function LogPage() {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from('members')
    .select('id, first_name, last_name')
    .eq('is_active', true)
    .order('first_name');

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-md bg-amber-50 p-4 border border-amber-200">
          <div className="flex">
            <div className="shrink-0">
              <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-bold text-amber-800">
                Under Construction: This page is being built. Data submission is not yet active.
              </h3>
            </div>
          </div>
        </div>

        <WeeklyLogForm directory={members || []} />
      </main>
    </div>
  );
}
