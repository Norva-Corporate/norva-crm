-- ============================================================
-- 012 — Discussion (messagerie interne staff)
-- ============================================================
-- Adds:
--   discussion_channels  — canaux de discussion (style Slack)
--   discussion_messages  — messages markdown + mentions + pj + threads
--   discussion_reads     — last_read_at par (user, channel) pour badges non-lus
-- Plus storage bucket 'discussion-attachments' (privé, auth requise)
-- et exposition Realtime des messages + canaux.
-- ============================================================

-- CHANNELS
create table public.discussion_channels (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index discussion_channels_created_at_idx
  on public.discussion_channels(created_at desc);

alter table public.discussion_channels enable row level security;

create policy "Authenticated users can view channels" on public.discussion_channels
  for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert channels" on public.discussion_channels
  for insert with check (auth.role() = 'authenticated' and auth.uid() = created_by);
create policy "Authenticated users can update channels" on public.discussion_channels
  for update using (auth.role() = 'authenticated');
create policy "Admins can delete channels" on public.discussion_channels
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create trigger set_discussion_channels_updated_at
  before update on public.discussion_channels
  for each row execute procedure public.set_updated_at();

-- MESSAGES
create table public.discussion_messages (
  id uuid primary key default uuid_generate_v4(),
  channel_id uuid not null references public.discussion_channels(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  content text not null,
  parent_id uuid references public.discussion_messages(id) on delete cascade,
  attachments jsonb not null default '[]'::jsonb,
  mentions jsonb not null default '[]'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index discussion_messages_channel_created_idx
  on public.discussion_messages(channel_id, created_at desc);
create index discussion_messages_parent_idx
  on public.discussion_messages(parent_id)
  where parent_id is not null;
create index discussion_messages_user_idx
  on public.discussion_messages(user_id);

alter table public.discussion_messages enable row level security;

create policy "Authenticated users can view active messages" on public.discussion_messages
  for select using (auth.role() = 'authenticated' and deleted_at is null);
create policy "Authenticated users can insert their messages" on public.discussion_messages
  for insert with check (auth.role() = 'authenticated' and auth.uid() = user_id);
create policy "Authors can update their messages" on public.discussion_messages
  for update using (user_id = auth.uid());
create policy "Admins can delete messages" on public.discussion_messages
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create trigger set_discussion_messages_updated_at
  before update on public.discussion_messages
  for each row execute procedure public.set_updated_at();

-- READS (last_read_at par utilisateur + canal)
create table public.discussion_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid not null references public.discussion_channels(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, channel_id)
);

create index discussion_reads_channel_idx
  on public.discussion_reads(channel_id);

alter table public.discussion_reads enable row level security;

create policy "Users can view their reads" on public.discussion_reads
  for select using (user_id = auth.uid());
create policy "Users can insert their reads" on public.discussion_reads
  for insert with check (user_id = auth.uid());
create policy "Users can update their reads" on public.discussion_reads
  for update using (user_id = auth.uid());
create policy "Users can delete their reads" on public.discussion_reads
  for delete using (user_id = auth.uid());

-- REALTIME — expose messages + channels
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'discussion_messages'
  ) then
    alter publication supabase_realtime add table public.discussion_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'discussion_channels'
  ) then
    alter publication supabase_realtime add table public.discussion_channels;
  end if;
end $$;

-- SEED — canal #général si aucun canal n'existe (idempotent)
insert into public.discussion_channels (name, description)
select 'général', 'Canal par défaut de l''équipe'
where not exists (select 1 from public.discussion_channels);

-- STORAGE — bucket privé pour pièces jointes
insert into storage.buckets (id, name, public)
values ('discussion-attachments', 'discussion-attachments', false)
on conflict (id) do nothing;

-- Storage policies (auth requise pour read/insert ; owner pour delete)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Auth can read discussion attachments'
  ) then
    create policy "Auth can read discussion attachments"
      on storage.objects for select
      using (bucket_id = 'discussion-attachments' and auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Auth can upload discussion attachments'
  ) then
    create policy "Auth can upload discussion attachments"
      on storage.objects for insert
      with check (bucket_id = 'discussion-attachments' and auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Owner can delete discussion attachments'
  ) then
    create policy "Owner can delete discussion attachments"
      on storage.objects for delete
      using (bucket_id = 'discussion-attachments' and auth.uid() = owner);
  end if;
end $$;
