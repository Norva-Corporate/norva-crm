import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listChannels } from "@/lib/discussion/queries";
import { DiscussionLayout } from "@/components/discussion/discussion-layout";
import type { Profile } from "@/types";

export const dynamic = "force-dynamic";

export default async function DiscussionIndexPage() {
  const channels = await listChannels();
  if (channels.length > 0) {
    redirect(`/dashboard/discussion/${channels[0].id}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };
  const isAdmin = (profile as Pick<Profile, "role"> | null)?.role === "admin";

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <DiscussionLayout
        channels={[]}
        activeChannel={null}
        initialMessages={[]}
        currentUserId={user?.id ?? null}
        isAdmin={isAdmin}
      />
    </div>
  );
}
