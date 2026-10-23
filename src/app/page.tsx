import {
  AlertTriangle,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Layers3,
  LogOut,
  ListTodo,
  Users,
} from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type ClientRow = { id: string; name: string; status?: string };
type TaskRow = {
  id: string;
  client_id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  assignee_id: string | null;
  due_at: string | null;
  visibility: string;
  updated_at?: string | null;
  created_at?: string | null;
};
type ApprovalRow = { id: string; client_id: string; title: string; status: string; submitted_at: string; resource_type: string };

const doneStatuses = ["completed", "canceled"];
const prettyStatus = (status: string) => status.replaceAll("_", " ");
const dateKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const dateLabel = (date: string | null) => date ? new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "No due date";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  async function signOut() {
    "use server";
    const client = await createClient();
    await client.auth.signOut();
    redirect("/login");
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("agency_members").select("agency_id, role").eq("user_id", user.id).eq("status", "active");

  if (membershipError) {
    return <main className="dashboard-page"><div className="dashboard-error"><h1>We couldn&apos;t load your workspace</h1><p>Check your agency membership and Supabase permissions.</p></div></main>;
  }

  const agencyId = memberships?.[0]?.agency_id;
  if (!agencyId) {
    const { data: clientMembership } = await supabase.from("client_members").select("client_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
    if (clientMembership) redirect("/portal");
    return <main className="dashboard-page"><header className="dashboard-topbar"><div className="dashboard-brand">growth<span>os</span></div><form action={signOut}><button className="signout-button" type="submit"><LogOut size={16} /> Sign out</button></form></header><section className="dashboard-content"><p className="dashboard-eyebrow">WORKSPACE SETUP</p><h1>Welcome to Growth OS</h1><p className="dashboard-subtitle">Your login works, but this account is not linked to an active agency membership yet.</p></section></main>;
  }

  const { data: agency } = await supabase.from("agencies").select("name").eq("id", agencyId).maybeSingle();
  const today = dateKey(new Date());

  const [
    { data: clientData, error: clientsError },
    { data: taskData, error: tasksError },
    { data: approvalData, error: approvalsError },
  ] = await Promise.all([
    supabase.from("clients").select("id, name, status").eq("agency_id", agencyId).order("name"),
    supabase.from("tasks").select("id, client_id, title, description, status, priority, assignee_id, due_at, visibility, updated_at, created_at").eq("agency_id", agencyId).order("due_at", { ascending: true }).limit(500),
    supabase.from("approvals").select("id, client_id, title, status, submitted_at, resource_type").eq("agency_id", agencyId).order("submitted_at", { ascending: false }).limit(200),
  ]);

  const clients = (clientData ?? []) as ClientRow[];
  const tasks = (taskData ?? []) as TaskRow[];
  const approvals = (approvalData ?? []) as ApprovalRow[];
  const clientNames = new Map(clients.map((client) => [client.id, client.name]));
  const openTasks = tasks.filter((task) => !doneStatuses.includes(task.status));
  const completedTasks = tasks.filter((task) => task.status === "completed");
  const completedToday = completedTasks.filter((task) => task.updated_at && dateKey(new Date(task.updated_at)) === today);
  const todayTasks = openTasks.filter((task) => task.due_at && dateKey(new Date(task.due_at)) === today);
  const overdueTasks = openTasks.filter((task) => task.due_at && dateKey(new Date(task.due_at)) < today);
  const pendingApprovals = approvals.filter((approval) => ["pending", "changes_requested"].includes(approval.status.toLowerCase()));
  const activeCount = clients.filter((client) => client.status === "active").length;
  const onboardingCount = clients.filter((client) => client.status === "onboarding").length;
  const clientOpenTasks = (clientId: string) => openTasks.filter((task) => task.client_id === clientId);
  const clientCompleted = (clientId: string) => completedTasks.filter((task) => task.client_id === clientId);
  const clientToday = (clientId: string) => clientOpenTasks(clientId).filter((task) => task.due_at && dateKey(new Date(task.due_at)) === today);
  const clientOverdue = (clientId: string) => overdueTasks.filter((task) => task.client_id === clientId);
  const clientReview = (clientId: string) => pendingApprovals.filter((approval) => approval.client_id === clientId);
  const attentionTasks = [...overdueTasks, ...todayTasks].filter((task, index, all) => all.findIndex((item) => item.id === task.id) === index).slice(0, 8);
  const workTypes = [
    { label: "To do", count: tasks.filter((task) => ["backlog", "todo"].includes(task.status)).length, className: "work-type-todo" },
    { label: "In progress", count: tasks.filter((task) => task.status === "in_progress").length, className: "work-type-progress" },
    { label: "In review", count: tasks.filter((task) => task.status === "in_review").length, className: "work-type-review" },
    { label: "Blocked", count: tasks.filter((task) => task.status === "blocked").length, className: "work-type-blocked" },
  ];

  return (
    <main className="dashboard-page">
      <aside className="dashboard-sidebar">
        <div className="dashboard-brand">growth<span>os</span></div>
        <p className="sidebar-label">WORKSPACE</p>
        <Link className="sidebar-link active" href="/"><BriefcaseBusiness size={18} /> Overview</Link>
        <Link className="sidebar-link" href="/clients"><Users size={18} /> Clients</Link>
        <Link className="sidebar-link" href="/tasks"><ClipboardCheck size={18} /> Tasks &amp; calendar</Link>
        <Link className="sidebar-link" href="/settings"><BriefcaseBusiness size={18} /> Service templates</Link>
        <div className="sidebar-bottom"><div className="user-avatar">{(user.email?.[0] ?? "G").toUpperCase()}</div><div className="user-info"><strong>{user.email}</strong><span>{agency?.name ?? "Agency workspace"}</span></div><form action={signOut}><button className="icon-button" type="submit" title="Sign out" aria-label="Sign out"><LogOut size={17} /></button></form></div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div><p className="dashboard-eyebrow">AGENCY WORKSPACE / OVERVIEW</p><h1>Your whole agency.<br />One clear view.</h1><p className="dashboard-subtitle">See every client, what needs doing today, what is complete, and where work is stuck.</p></div>
          <Link href="/clients" className="clients-primary">+ Add client</Link>
        </header>

        {(tasksError || approvalsError || clientsError) && <div className="dashboard-warning"><AlertTriangle size={17} /> Some workspace information could not load. Check permissions and refresh.</div>}

        <section className="kpi-grid agency-kpi-grid" aria-label="Agency summary">
          <article className="kpi-card"><div className="kpi-topline"><span>All clients</span><span className="kpi-icon purple"><Users size={19} /></span></div><div className="kpi-value">{clients.length}</div><p className="kpi-detail">{activeCount} active · {onboardingCount} onboarding</p></article>
          <article className="kpi-card"><div className="kpi-topline"><span>Tasks due today</span><span className="kpi-icon orange"><CalendarDays size={19} /></span></div><div className="kpi-value">{todayTasks.length}</div><p className="kpi-detail">Scheduled for today</p></article>
          <article className="kpi-card"><div className="kpi-topline"><span>Completed today</span><span className="kpi-icon green"><CheckCircle2 size={19} /></span></div><div className="kpi-value">{completedToday.length}</div><p className="kpi-detail">{completedTasks.length} completed overall</p></article>
          <article className="kpi-card"><div className="kpi-topline"><span>Still to do</span><span className="kpi-icon blue"><ListTodo size={19} /></span></div><div className="kpi-value">{openTasks.length}</div><p className="kpi-detail">{overdueTasks.length} overdue · {pendingApprovals.length} client reviews</p></article>
        </section>

        <section className="panel agency-work-types">
          <div className="panel-heading"><div><h2>Work status</h2><p>A quick breakdown of the tasks across all clients.</p></div><Link href="/tasks" className="panel-action">Open task centre <ArrowUpRight size={15} /></Link></div>
          <div className="work-type-grid">{workTypes.map((type) => <div className={"work-type-card " + type.className} key={type.label}><span>{type.label}</span><strong>{type.count}</strong></div>)}</div>
        </section>

        <section className="panel agency-client-section">
          <div className="panel-heading"><div><h2>Every client</h2><p>Each client has their own work summary. Select a client to open their Client Room.</p></div><Link href="/clients" className="panel-action">Manage clients <ArrowUpRight size={15} /></Link></div>
          {clients.length === 0 ? <div className="empty-state"><div className="empty-state-icon"><Users size={24} /></div><h3>No clients yet</h3><p>Add your first client to start tracking work.</p><Link href="/clients" className="primary-link">Add your first client</Link></div> : (
            <div className="agency-client-grid">{clients.map((client, index) => {
              const clientTasks = clientOpenTasks(client.id);
              const nextTasks = clientTasks.slice(0, 2);
              return <article className="agency-client-card" key={client.id}>
                <div className="agency-client-card-top"><span className="agency-client-index">{String(index + 1).padStart(2, "0")}</span><span className={"campaign-status " + (client.status === "active" ? "agency-active-status" : "")}>{prettyStatus(client.status ?? "unknown")}</span></div>
                <h3>{client.name}</h3>
                <div className="agency-client-metrics"><div><strong>{clientCompleted(client.id).length}</strong><span>Completed</span></div><div><strong>{clientToday(client.id).length}</strong><span>Due today</span></div><div><strong>{clientTasks.length}</strong><span>To do</span></div></div>
                <div className="agency-client-next"><div className="agency-client-next-heading"><span>Next actions</span><span>{clientOverdue(client.id).length ? clientOverdue(client.id).length + " overdue" : "On track"}</span></div>
                  {nextTasks.length ? nextTasks.map((task) => <div className="agency-mini-task" key={task.id}><span className={"agency-task-dot " + (task.status === "blocked" ? "is-blocked" : task.status === "in_review" ? "is-review" : "")}></span><span className="agency-mini-task-title">{task.title}</span><span className="agency-mini-task-status">{prettyStatus(task.status)}</span></div>) : <p className="agency-no-tasks">{clientCompleted(client.id).length ? "No open tasks — nice work." : "No tasks added yet."}</p>}
                </div>
                <div className="agency-client-footer"><span><Clock3 size={13} /> {clientReview(client.id).length} awaiting review</span><Link href={"/clients/" + client.id}>View client <ArrowUpRight size={15} /></Link></div>
              </article>;
            })}</div>
          )}
        </section>

        <section className="panel owner-list-panel agency-attention-panel">
          <div className="panel-heading"><div><h2>Needs your attention</h2><p>Overdue work and tasks due today, across every client.</p></div><span className="table-count">{attentionTasks.length}</span></div>
          {!attentionTasks.length ? <div className="empty-state"><h3>Nothing urgent right now</h3><p>Tasks due today or past their due date will appear here.</p></div> : <div className="owner-task-list">{attentionTasks.map((task) => <div className="owner-task-row" key={task.id}><div className="owner-task-main"><strong>{task.title}</strong><span>{clientNames.get(task.client_id) ?? "Client"} · {prettyStatus(task.status)}</span></div><span className={task.due_at && dateKey(new Date(task.due_at)) < today ? "owner-badge overdue" : "owner-badge"}>{dateLabel(task.due_at)}</span><Link href={"/clients/" + task.client_id} className="panel-action">Open</Link></div>)}</div>}
        </section>

        <footer className="dashboard-footer"><span>Growth OS · Agency workspace</span><span><span className="status-dot" /> Your client work, in one place</span></footer>
      </section>
    </main>
  );
}
