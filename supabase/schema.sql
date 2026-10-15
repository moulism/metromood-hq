-- MetroMood HQ – schéma databáze (Supabase projekt metromood-hq, nogomyljbcpmteclpxny).
-- Už je aplikované. Soubor slouží jako dokumentace / pro založení nového projektu.

-- ============ ČLENOVÉ A ROLE ============
create table public.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  email text,
  display_name text not null,
  role_title text,
  app_role text not null default 'member' check (app_role in ('owner','member')),
  status text not null default 'pending' check (status in ('active','pending','disabled')),
  color text default '#8a8a8a',
  created_at timestamptz not null default now()
);
create unique index members_email_uq on public.members (lower(email)) where email is not null;

create or replace function public.my_member_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.members where user_id = auth.uid() and status = 'active' limit 1
$$;
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.members where user_id = auth.uid() and status = 'active')
$$;
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.members where user_id = auth.uid() and status = 'active' and app_role = 'owner')
$$;

-- Nový účet: když e-mail sedí na připraveného člena, propojí se a je hned aktivní; jinak 'pending'.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare m uuid;
begin
  select id into m from public.members
   where email is not null and lower(email) = lower(new.email) and user_id is null limit 1;
  if m is not null then
    update public.members set user_id = new.id,
      status = case when status = 'disabled' then 'disabled' else 'active' end
     where id = m;
  else
    insert into public.members (user_id, email, display_name, status)
    values (new.id, new.email,
      coalesce(nullif(new.raw_user_meta_data->>'name',''), split_part(new.email,'@',1)), 'pending');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Majitel schválí čekající účet (případně ho propojí s připraveným členem).
create or replace function public.approve_member(pending_id uuid, merge_into uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.members;
begin
  if not public.is_owner() then raise exception 'Jen pro majitele'; end if;
  select * into p from public.members where id = pending_id;
  if p.id is null then raise exception 'Nenalezeno'; end if;
  if merge_into is null then
    update public.members set status = 'active' where id = pending_id;
  else
    update public.members set user_id = null, email = null, status = 'disabled' where id = pending_id;
    update public.members set user_id = p.user_id, email = p.email, status = 'active' where id = merge_into;
  end if;
end $$;

-- ============ SDÍLENÁ DATA (vidí všichni schválení členové) ============
-- drops, tasks, events, content_posts, channels, folders, files, messages, ideas, idea_votes, contacts, app_settings
-- (sloupce viz Supabase → Table editor; app_settings: klíče 'brand_kit' a 'brand_plan')

-- ============ JEN MAJITEL ============
-- budget_lines, expenses, funding_parts, checkpoints, kpi_months

-- ============ RLS (zkráceně) ============
-- sdílené tabulky:  select/insert/update/delete  using (public.is_member())
-- jen majitel:      for all using (public.is_owner())
-- messages:         insert jen jako já (author_id = my_member_id()), mazat své (majitel všechny)
-- app_settings:     číst členové, zapisovat majitel
-- members:          číst členové (+ svůj řádek), zapisovat majitel

-- ============ STORAGE ============
-- bucket 'team' (soukromý, max 50 MB na soubor), přístup jen pro public.is_member()

-- ============ REALTIME ============
-- publication supabase_realtime: messages, tasks
