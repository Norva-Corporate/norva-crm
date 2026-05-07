import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getChannel,
  listChannels,
  listChannelMessages,
} from "@/lib/discussion/queries";
import { DiscussionLayout } from "@/components/discussion/discussion-layout";
import type { Profile } from "@/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ channelId: string }>;
}

export default async function ChannelPage({ params }: PageProps) {
  const { channelId } = await params;

  const [channels, channel, messages] = await Promise.all([
    listChannels(),
    getChannel(channelId),
    listChannelMessages(channelId, 100),
  ]);

  if (!channel) notFound();

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
        channels={channels}
        activeChannel={channel}
        initialMessages={messages}
        currentUserId={user?.id ?? null}
        isAdmin={isAdmin}
      />
    </div>
  );
}
