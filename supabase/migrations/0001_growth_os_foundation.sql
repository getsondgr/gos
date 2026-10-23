-- Growth OS foundation schema.
-- Review and test policies in a non-production project before storing customer data.
create extension if not exists pgcrypto;

create type public.agency_status as enum ('trialing','active','past_due','suspended','canceled');
create type public.member_status as enum ('invited','active','suspended','removed');
create type public.client_status as enum ('onboarding','active','paused','archived');
create type public.task_status as enum ('backlog','todo','in_progress','blocked','in_review','completed','canceled');
create type public.ticket_status as enum ('submitted','under_review','awaiting_client','approved','in_progress','completed','rejected','canceled');
create type public.approval_status as enum ('pending','approved','changes_requested','rejected','superseded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status public.agency_status not null default 'trialing',
  timezone text not null default 'Asia/Kolkata',
  default_currency char(3) not null default 'INR',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agency_members (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('agency_owner','agency_admin','account_manager','performance_marketer','creative_team','finance_manager')),
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  primary key (agency_id, user_id)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  slug text not null,
  industry text,
  status public.client_status not null default 'onboarding',
  timezone text not null default 'Asia/Kolkata',
  currency char(3) not null default 'INR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, slug),
  unique (agency_id, id)
);

create table public.client_members (
  agency_id uuid not null,
  client_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('client_owner','client_member','client_approver')),
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  primary key (client_id, user_id),
  foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete cascade
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  client_id uuid not null,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('draft','active','paused','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete cascade,
  unique (agency_id, id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  client_id uuid not null,
  project_id uuid,
  title text not null,
  description text,
  status public.task_status not null default 'todo',
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assignee_id uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  visibility text not null default 'client_visible' check (visibility in ('internal','client_visible')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete cascade,
  foreign key (agency_id, project_id) references public.projects(agency_id, id) on delete set null
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  client_id uuid not null,
  ticket_number bigint generated always as identity,
  title text not null,
  description text not null,
  category text not null default 'other',
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status public.ticket_status not null default 'submitted',
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete cascade,
  unique (agency_id, ticket_number)
);

create table public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  client_id uuid not null,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  visibility text not null default 'client_visible' check (visibility in ('internal','client_visible')),
  created_at timestamptz not null default now(),
  foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete cascade
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  client_id uuid not null,
  platform text not null check (platform in ('meta','google','linkedin','tiktok','other')),
  external_account_id text,
  external_campaign_id text,
  name text not null,
  status text not null default 'unknown',
  currency char(3) not null default 'INR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete cascade,
  unique (agency_id, id)
);

create table public.performance_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  client_id uuid not null,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  report_date date not null,
  source text not null default 'manual',
  currency char(3) not null default 'INR',
  spend numeric(18,2) not null default 0 check (spend >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  leads numeric(18,4) not null default 0 check (leads >= 0),
  conversions numeric(18,4) not null default 0 check (conversions >= 0),
  attributed_revenue numeric(18,2) check (attributed_revenue >= 0),
  attribution_window text,
  imported_at timestamptz not null default now(),
  foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete cascade,
  unique (campaign_id, report_date, source, currency)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  client_id uuid not null,
  invoice_number text not null,
  currency char(3) not null default 'INR',
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint not null default 0 check (total_minor >= 0),
  status text not null default 'draft' check (status in ('draft','issued','pending','partially_paid','paid','overdue','void')),
  issue_date date,
  due_date date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete cascade,
  unique (agency_id, invoice_number)
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  provider text not null default 'manual',
  provider_payment_id text,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'INR',
  status text not null default 'pending' check (status in ('pending','processing','paid','failed','refunded')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  client_id uuid,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  visibility text not null default 'client_visible' check (visibility in ('internal','client_visible')),
  resource_type text,
  resource_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (agency_id, client_id) references public.clients(agency_id, id) on delete cascade
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  title text not null,
  body text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id uuid,
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index clients_agency_idx on public.clients(agency_id);
create index tasks_agency_client_status_idx on public.tasks(agency_id, client_id, status);
create index tickets_agency_client_status_idx on public.tickets(agency_id, client_id, status);
create index campaigns_agency_client_idx on public.campaigns(agency_id, client_id);
create index metrics_agency_client_date_idx on public.performance_metrics_daily(agency_id, client_id, report_date desc);
create index invoices_agency_client_status_idx on public.invoices(agency_id, client_id, status);
create index activity_agency_client_created_idx on public.activity_events(agency_id, client_id, created_at desc);

-- Security helper functions: SECURITY DEFINER with a fixed search_path.
-- These helpers only answer membership questions and do not expose table contents.
create or replace function public.is_agency_member(p_agency_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.agency_members m
    where m.agency_id = p_agency_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create or replace function public.is_client_member(p_agency_id uuid, p_client_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.client_members m
    where m.agency_id = p_agency_id
      and m.client_id = p_client_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create or replace function public.is_agency_admin(p_agency_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.agency_members m
    where m.agency_id = p_agency_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('agency_owner','agency_admin')
  );
$$;

alter table public.profiles enable row level security;
alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;
alter table public.clients enable row level security;
alter table public.client_members enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_comments enable row level security;
alter table public.campaigns enable row level security;
alter table public.performance_metrics_daily enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.activity_events enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_self" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profiles_update_self" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "agencies_select_member" on public.agencies for select to authenticated using (public.is_agency_member(id));
create policy "agencies_update_admin" on public.agencies for update to authenticated using (public.is_agency_admin(id)) with check (public.is_agency_admin(id));

create policy "agency_members_select_member" on public.agency_members for select to authenticated using (public.is_agency_member(agency_id));
create policy "agency_members_admin_insert" on public.agency_members for insert to authenticated with check (public.is_agency_admin(agency_id));
create policy "agency_members_admin_update" on public.agency_members for update to authenticated using (public.is_agency_admin(agency_id)) with check (public.is_agency_admin(agency_id));
create policy "agency_members_admin_delete" on public.agency_members for delete to authenticated using (public.is_agency_admin(agency_id));

create policy "clients_select_scoped" on public.clients for select to authenticated using (public.is_agency_member(agency_id) or public.is_client_member(agency_id,id));
create policy "clients_insert_admin" on public.clients for insert to authenticated with check (public.is_agency_admin(agency_id));
create policy "clients_update_admin" on public.clients for update to authenticated using (public.is_agency_admin(agency_id)) with check (public.is_agency_admin(agency_id));
create policy "clients_delete_admin" on public.clients for delete to authenticated using (public.is_agency_admin(agency_id));

create policy "client_members_select_scoped" on public.client_members for select to authenticated using (public.is_agency_member(agency_id) or user_id = (select auth.uid()));
create policy "client_members_admin_insert" on public.client_members for insert to authenticated with check (public.is_agency_admin(agency_id));
create policy "client_members_admin_update" on public.client_members for update to authenticated using (public.is_agency_admin(agency_id)) with check (public.is_agency_admin(agency_id));
create policy "client_members_admin_delete" on public.client_members for delete to authenticated using (public.is_agency_admin(agency_id));

create policy "projects_select_scoped" on public.projects for select to authenticated using (public.is_agency_member(agency_id) or public.is_client_member(agency_id,client_id));
create policy "projects_admin_insert" on public.projects for insert to authenticated with check (public.is_agency_admin(agency_id));
create policy "projects_admin_update" on public.projects for update to authenticated using (public.is_agency_admin(agency_id)) with check (public.is_agency_admin(agency_id));

create policy "tasks_select_scoped" on public.tasks for select to authenticated using (
  (public.is_agency_member(agency_id) and (visibility = 'client_visible' or public.is_agency_admin(agency_id) or exists (
    select 1 from public.agency_members m where m.agency_id = tasks.agency_id and m.user_id = (select auth.uid()) and m.status='active' and m.role in ('account_manager','performance_marketer','creative_team')
  ))) or public.is_client_member(agency_id,client_id) and visibility = 'client_visible'
);
create policy "tasks_insert_agency" on public.tasks for insert to authenticated with check (public.is_agency_member(agency_id));
create policy "tasks_update_agency" on public.tasks for update to authenticated using (public.is_agency_member(agency_id)) with check (public.is_agency_member(agency_id));

create policy "tickets_select_scoped" on public.tickets for select to authenticated using (public.is_agency_member(agency_id) or public.is_client_member(agency_id,client_id));
create policy "tickets_insert_scoped" on public.tickets for insert to authenticated with check (public.is_agency_member(agency_id) or public.is_client_member(agency_id,client_id));
create policy "tickets_update_agency" on public.tickets for update to authenticated using (public.is_agency_member(agency_id)) with check (public.is_agency_member(agency_id));

create policy "ticket_comments_select_scoped" on public.ticket_comments for select to authenticated using (
  (public.is_agency_member(agency_id) and (visibility='client_visible' or public.is_agency_admin(agency_id))) or
  (public.is_client_member(agency_id,client_id) and visibility='client_visible')
);
create policy "ticket_comments_insert_scoped" on public.ticket_comments for insert to authenticated with check (
  (public.is_agency_member(agency_id) and (visibility='client_visible' or public.is_agency_admin(agency_id))) or
  (public.is_client_member(agency_id,client_id) and visibility='client_visible')
);

create policy "campaigns_select_scoped" on public.campaigns for select to authenticated using (public.is_agency_member(agency_id) or public.is_client_member(agency_id,client_id));
create policy "campaigns_insert_agency" on public.campaigns for insert to authenticated with check (public.is_agency_member(agency_id));
create policy "campaigns_update_agency" on public.campaigns for update to authenticated using (public.is_agency_member(agency_id)) with check (public.is_agency_member(agency_id));

create policy "metrics_select_scoped" on public.performance_metrics_daily for select to authenticated using (public.is_agency_member(agency_id) or public.is_client_member(agency_id,client_id));
create policy "metrics_insert_agency" on public.performance_metrics_daily for insert to authenticated with check (public.is_agency_member(agency_id));
create policy "metrics_update_agency" on public.performance_metrics_daily for update to authenticated using (public.is_agency_member(agency_id)) with check (public.is_agency_member(agency_id));

create policy "invoices_select_scoped" on public.invoices for select to authenticated using (public.is_agency_member(agency_id) or public.is_client_member(agency_id,client_id));
create policy "invoices_insert_finance" on public.invoices for insert to authenticated with check (
  exists (select 1 from public.agency_members m where m.agency_id=invoices.agency_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('agency_owner','agency_admin','finance_manager'))
);
create policy "invoices_update_finance" on public.invoices for update to authenticated using (
  exists (select 1 from public.agency_members m where m.agency_id=invoices.agency_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('agency_owner','agency_admin','finance_manager'))
) with check (
  exists (select 1 from public.agency_members m where m.agency_id=invoices.agency_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('agency_owner','agency_admin','finance_manager'))
);

create policy "invoice_items_select_scoped" on public.invoice_items for select to authenticated using (
  exists (select 1 from public.invoices i where i.id=invoice_items.invoice_id and (public.is_agency_member(i.agency_id) or public.is_client_member(i.agency_id,i.client_id)))
);
create policy "invoice_items_write_finance" on public.invoice_items for all to authenticated using (
  exists (select 1 from public.invoices i join public.agency_members m on m.agency_id=i.agency_id where i.id=invoice_items.invoice_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('agency_owner','agency_admin','finance_manager'))
) with check (
  exists (select 1 from public.invoices i join public.agency_members m on m.agency_id=i.agency_id where i.id=invoice_items.invoice_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('agency_owner','agency_admin','finance_manager'))
);

create policy "payments_select_scoped" on public.payments for select to authenticated using (
  exists (select 1 from public.invoices i where i.id=payments.invoice_id and (public.is_agency_member(i.agency_id) or public.is_client_member(i.agency_id,i.client_id)))
);

create policy "activity_select_scoped" on public.activity_events for select to authenticated using (
  (public.is_agency_member(agency_id) and (visibility='client_visible' or public.is_agency_admin(agency_id))) or
  (client_id is not null and public.is_client_member(agency_id,client_id) and visibility='client_visible')
);
create policy "activity_insert_agency" on public.activity_events for insert to authenticated with check (public.is_agency_member(agency_id));

create policy "notifications_select_self" on public.notifications for select to authenticated using (user_id=(select auth.uid()));
create policy "notifications_update_self" on public.notifications for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create policy "audit_select_admin" on public.audit_logs for select to authenticated using (agency_id is not null and public.is_agency_admin(agency_id));
-- Intentionally no client insert/update/delete policy for audit logs.
-- Write audit events through trusted server-side functions.

-- Before production:
-- * Add a secure agency signup/onboarding RPC or server action that creates the agency and owner membership atomically.
-- * Add RLS policies and tests for every future table.
-- * Add storage.objects policies for private files.
-- * Review task visibility and role matrix with automated adversarial tests.
-- * Do not deploy service-role credentials to the browser.

