import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { WeeklyLogForm } from "@/components/WeeklyLogForm";
import FlashMessage from "@/components/FlashMessage";
import { createClient } from "@/utils/supabase/server";
import { getMemberForUser } from "@/utils/supabase/getMember";
import { getClubDirectory } from "@/utils/supabase/directory";

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const member = await getMemberForUser(supabase, user);

  if (!member) {
    redirect('/access-denied');
  }

  if (!member.profile_completed_at) {
    redirect('/onboarding');
  }

  // Club-scoped: you can record closed business thanking a fellow club member.
  const members = await getClubDirectory(member.current_club_id);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <FlashMessage message={message} />
        <WeeklyLogForm directory={members} />
      </main>
    </div>
  );
}
