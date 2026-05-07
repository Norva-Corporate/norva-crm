import { createClient } from "@/lib/supabase/server";
import type {
  ChannelWithUnread,
  DiscussionChannel,
  DiscussionMessage,
} from "@/types";

export async function listChannels(): Promise<DiscussionChannel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("discussion_channels")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[discussion.listChannels]", error);
    return [];
  }
  return (data ?? []) as DiscussionChannel[];
}

export async function listChannelsWithUnread(
  userId: string
): Promise<ChannelWithUnread[]> {
  const supabase = await createClient();
  const [{ data: channels }, { data: reads }] = await Promise.all([
    supabase
      .from("discussion_channels")
      .select("*")
      .order("created_at", { ascending: true }),
    supabase
      .from("discussion_reads")
      .select("channel_id, last_read_at")
      .eq("user_id", userId),
  ]);

  const lastReadByChannel = new Map<string, string>();
  for (const r of reads ?? []) {
    lastReadByChannel.set(r.channel_id as string, r.last_read_at as string);
  }

  const list = (channels ?? []) as DiscussionChannel[];
  const counts = await Promise.all(
    list.map(async (c) => {
      const lastRead = lastReadByChannel.get(c.id);
      // Unread = non-deleted messages from others since last_read
      const baseQuery = supabase
        .from("discussion_messages")
        .select("id", { count: "exact", head: true })
        .eq("channel_id", c.id)
        .is("deleted_at", null)
        .neq("user_id", userId);
      const { count } = lastRead
        ? await baseQuery.gt("created_at", lastRead)
        : await baseQuery;
      return { id: c.id, count: count ?? 0 };
    })
  );

  const countMap = new Map(counts.map((c) => [c.id, c.count]));
  return list.map((c) => ({
    ...c,
    unread_count: countMap.get(c.id) ?? 0,
    last_read_at: lastReadByChannel.get(c.id) ?? null,
  }));
}

export async function getChannel(
  channelId: string
): Promise<DiscussionChannel | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("discussion_channels")
    .select("*")
    .eq("id", channelId)
    .maybeSingle();
  if (error) {
    console.error("[discussion.getChannel]", error);
    return null;
  }
  return (data ?? null) as DiscussionChannel | null;
}

export async function listChannelMessages(
  channelId: string,
  limit = 100
): Promise<DiscussionMessage[]> {
  const supabase = await createClient();
  // Soft-deleted messages stay in the list — UI renders them as
  // <DeletedMessageItem /> ("Message supprimé").
  const { data, error } = await supabase
    .from("discussion_messages")
    .select(
      `*, author:profiles!discussion_messages_user_id_fkey(id, full_name, avatar_url, email)`
    )
    .eq("channel_id", channelId)
    .is("parent_id", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[discussion.listChannelMessages]", error);
    return [];
  }
  return ((data ?? []) as DiscussionMessage[]).reverse();
}

export async function listThreadMessages(
  parentId: string
): Promise<DiscussionMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("discussion_messages")
    .select(
      `*, author:profiles!discussion_messages_user_id_fkey(id, full_name, avatar_url, email)`
    )
    .eq("parent_id", parentId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[discussion.listThreadMessages]", error);
    return [];
  }
  return (data ?? []) as DiscussionMessage[];
}
