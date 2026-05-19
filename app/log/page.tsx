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
        <WeeklyLogForm directory={members || []} />
      </main>
    </div>
  );
}
