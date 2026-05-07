"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { excerpt, extractMentions } from "@/lib/discussion/mention-format";
import type { Attachment, Mention } from "@/types";

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ============================================================
// CHANNELS
// ============================================================
export async function createChannel(input: {
  name: string;
  description?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  const name = input.name?.trim();
  if (!name) return { success: false, error: "Le nom du canal est obligatoire." };
  if (name.length > 60)
    return { success: false, error: "Le nom doit faire moins de 60 caractères." };

  const { data, error } = await supabase
    .from("discussion_channels")
    .insert({
      name,
      description: input.description?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Création impossible." };
  }
  revalidatePath("/dashboard/discussion");
  return { success: true, data: { id: data.id } };
}

export async function updateChannel(input: {
  id: string;
  name?: string;
  description?: string | null;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) return { success: false, error: "Le nom est obligatoire." };
    patch.name = trimmed;
  }
  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null;
  }
  if (Object.keys(patch).length === 0) {
    return { success: true, data: null };
  }

  const { error } = await supabase
    .from("discussion_channels")
    .update(patch)
    .eq("id", input.id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/discussion");
  return { success: true, data: null };
}

export async function deleteChannel(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("discussion_channels")
    .delete()
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/discussion");
  return { success: true, data: null };
}

// ============================================================
// MESSAGES
// ============================================================
export async function sendMessage(input: {
  channelId: string;
  content: string;
  parentId?: string | null;
  attachments?: Attachment[];
}): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  const content = input.content?.trim();
  if (!content && !(input.attachments && input.attachments.length > 0)) {
    return { success: false, error: "Le message ne peut pas être vide." };
  }

  const mentions: Mention[] = content ? extractMentions(content) : [];

  const { data: inserted, error } = await supabase
    .from("discussion_messages")
    .insert({
      channel_id: input.channelId,
      user_id: user.id,
      content: content ?? "",
      parent_id: input.parentId ?? null,
      attachments: input.attachments ?? [],
      mentions,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { success: false, error: error?.message ?? "Envoi impossible." };
  }

  // Notifications pour mentions @user
  const userMentions = mentions.filter(
    (m) => m.type === "user" && m.id !== user.id
  );
  if (userMentions.length > 0) {
    const [{ data: channel }, { data: profile }] = await Promise.all([
      supabase
        .from("discussion_channels")
        .select("name")
        .eq("id", input.channelId)
        .single(),
      supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single(),
    ]);

    const channelName = (channel?.name as string | undefined) ?? "discussion";
    const authorName =
      (profile?.full_name as string | undefined) ||
      (profile?.email as string | undefined) ||
      "Quelqu'un";
    const body = excerpt(content ?? "", 100);
    const link = `/dashboard/discussion/${input.channelId}?m=${inserted.id}`;

    await supabase.from("notifications").insert(
      userMentions.map((m) => ({
        user_id: m.id,
        type: "discussion_mention",
        title: `${authorName} vous a mentionné dans #${channelName}`,
        body,
        link,
      }))
    );
  }

  revalidatePath(`/dashboard/discussion/${input.channelId}`);
  return { success: true, data: { id: inserted.id } };
}

export async function deleteMessage(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  const { error } = await supabase
    .from("discussion_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/discussion");
  return { success: true, data: null };
}

// ============================================================
// READ TRACKING
// ============================================================
export async function markChannelRead(channelId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  const { error } = await supabase.from("discussion_reads").upsert(
    {
      user_id: user.id,
      channel_id: channelId,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "user_id,channel_id" }
  );
  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

// ============================================================
// ATTACHMENTS
// ============================================================
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export async function uploadAttachment(
  formData: FormData
): Promise<ActionResult<Attachment>> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "Fichier manquant." };
  }
  if (file.size > MAX_FILE_SIZE) {
    return {
      success: false,
      error: `Fichier trop volumineux (max ${MAX_FILE_SIZE / 1024 / 1024} MB).`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = `${user.id}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("discussion-attachments")
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    return { success: false, error: uploadError.message };
  }

  return {
    success: true,
    data: {
      path,
      name: file.name,
      size: file.size,
      mime: file.type || "application/octet-stream",
    },
  };
}

export async function getAttachmentSignedUrl(
  path: string,
  expiresIn = 3600
): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("discussion-attachments")
    .createSignedUrl(path, expiresIn);
  if (error || !data) {
    return { success: false, error: error?.message ?? "URL indisponible." };
  }
  return { success: true, data: { url: data.signedUrl } };
}
