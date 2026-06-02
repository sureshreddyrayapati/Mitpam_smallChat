create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null,
  avatar_url text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  title text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 4000),
  message_type text not null default 'text' check (message_type in ('text', 'file', 'image', 'audio')),
  attachments jsonb not null default '[]'::jsonb,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.message_receipts (
  message_id uuid not null references public.messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, profile_id)
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (requester_id, recipient_id),
  check (requester_id <> recipient_id)
);

create table if not exists public.friendships (
  profile_a uuid not null references public.profiles(id) on delete cascade,
  profile_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_a, profile_b),
  check (profile_a < profile_b)
);

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

alter table public.messages
  alter column body set default '';

alter table public.messages
  alter column body drop not null;

alter table public.messages
  drop constraint if exists messages_body_check;

alter table public.messages
  add constraint messages_body_check check (char_length(coalesce(body, '')) <= 4000);

alter table public.messages
  add column if not exists message_type text not null default 'text';

alter table public.messages
  add column if not exists attachments jsonb not null default '[]'::jsonb;

alter table public.messages
  add column if not exists edited_at timestamptz;

alter table public.messages
  add column if not exists deleted_at timestamptz;

alter table public.messages
  drop constraint if exists messages_message_type_check;

alter table public.messages
  add constraint messages_message_type_check check (message_type in ('text', 'file', 'image', 'audio'));

create index if not exists idx_messages_conversation_created
  on public.messages(conversation_id, created_at desc);

create index if not exists idx_participants_profile
  on public.conversation_participants(profile_id);

create index if not exists idx_receipts_profile
  on public.message_receipts(profile_id);

create index if not exists idx_friend_requests_recipient
  on public.friend_requests(recipient_id, status);

create index if not exists idx_friendships_profile_b
  on public.friendships(profile_b);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists conversations_touch_updated_at on public.conversations;
create trigger conversations_touch_updated_at
before update on public.conversations
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, 'User'), '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_receipts enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;

drop policy if exists "Profiles are visible to authenticated users" on public.profiles;
create policy "Profiles are visible to authenticated users"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users see conversations they belong to" on public.conversations;
create policy "Users see conversations they belong to"
on public.conversations for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = id
      and cp.profile_id = auth.uid()
  )
);

drop policy if exists "Users see own participations" on public.conversation_participants;
create policy "Users see own participations"
on public.conversation_participants for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_participants mine
    where mine.conversation_id = conversation_participants.conversation_id
      and mine.profile_id = auth.uid()
  )
);

drop policy if exists "Users see messages in own conversations" on public.messages;
create policy "Users see messages in own conversations"
on public.messages for select
to authenticated
using (
  exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id
      and cp.profile_id = auth.uid()
  )
);

drop policy if exists "Users create own receipts in conversations" on public.message_receipts;
create policy "Users create own receipts in conversations"
on public.message_receipts for insert
to authenticated
with check (
  auth.uid() = profile_id
  and exists (
    select 1
    from public.messages m
    join public.conversation_participants cp on cp.conversation_id = m.conversation_id
    where m.id = message_receipts.message_id
      and cp.profile_id = auth.uid()
  )
);

drop policy if exists "Users see receipts in own conversations" on public.message_receipts;
create policy "Users see receipts in own conversations"
on public.message_receipts for select
to authenticated
using (
  exists (
    select 1
    from public.messages m
    join public.conversation_participants cp on cp.conversation_id = m.conversation_id
    where m.id = message_receipts.message_id
      and cp.profile_id = auth.uid()
  )
);

drop policy if exists "Users see their own friend requests" on public.friend_requests;
create policy "Users see their own friend requests"
on public.friend_requests for select
to authenticated
using (auth.uid() = requester_id or auth.uid() = recipient_id);

drop policy if exists "Users create outgoing friend requests" on public.friend_requests;
create policy "Users create outgoing friend requests"
on public.friend_requests for insert
to authenticated
with check (auth.uid() = requester_id and requester_id <> recipient_id);

drop policy if exists "Recipients update friend requests" on public.friend_requests;
create policy "Recipients update friend requests"
on public.friend_requests for update
to authenticated
using (auth.uid() = recipient_id)
with check (auth.uid() = recipient_id);

drop policy if exists "Users see their friendships" on public.friendships;
create policy "Users see their friendships"
on public.friendships for select
to authenticated
using (auth.uid() = profile_a or auth.uid() = profile_b);

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true), ('chat-files', 'chat-files', true)
on conflict (id) do nothing;

drop policy if exists "Users upload own avatars" on storage.objects;
create policy "Users upload own avatars"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users update own avatars" on storage.objects;
create policy "Users update own avatars"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Authenticated users read avatars" on storage.objects;
create policy "Authenticated users read avatars"
on storage.objects for select
to authenticated
using (bucket_id = 'avatars');

drop policy if exists "Users upload chat files" on storage.objects;
create policy "Users upload chat files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'chat-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Authenticated users read chat files" on storage.objects;
create policy "Authenticated users read chat files"
on storage.objects for select
to authenticated
using (bucket_id = 'chat-files');
