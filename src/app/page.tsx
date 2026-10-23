
import {
  AlertTriangle,
  ClipboardCheck,
  LogOut,
  Users,
  BriefcaseBusiness,
  ArrowUpRight,
} from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type ClientRow = {
  id: string;
  name: string;
  status?: string;
};

type TaskRow = {
  id: string;
  client_id: string;
  title: string;
  status: string;
  priority: string;
  assignee_id: string | null;
  due_at: string | null;
  visibility: string;
};

type ApprovalRow = {
  id: string;
  client_id: string;
  title: string;
  status: string;
  submitted_at: string;
  resource_type: string;
};

const prettyStatus = (status: string) =>
  status.replaceAll("_", " ");

const dateLabel = (date: string | null) => {
  if (!date) return "No due date";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
};

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  async function signOut() {
    "use server";
    const client = await createClient();
    await client.auth.signOut();
    redirect("/login");
  }

  const {
    data: memberships,
    error: membershipError,
  } = await supabase
    .from("agency_members")
    .select("agency_id, role")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (membershipError) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-error">
<h1>We couldn&apos;t load your workspace</h1>
          <p>Check your agency membership and Supabase permissions.</p>
        </div>
      </main>
    );
  }

  const agencyId = memberships?.[0]?.agency_id;

  if (!agencyId) {
    const { data: clientMembership } = await supabase.from("client_members").select("client_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
    if (clientMembership) redirect("/portal");
    return (
      <main className="dashboard-page">
        <header className="dashboard-topbar">
          <div className="dashboard-brand">
            growth<span>os</span>
          </div>
          <form action={signOut}>
            <button className="signout-button" type="submit">
              <LogOut size={16} /> Sign out
            </button>
          </form>
        </header>
        <section className="dashboard-content">
          <p className="dashboard-eyebrow">WORKSPACE SETUP</p>
          <h1>Welcome to Growth OS</h1>
          <p className="dashboard-subtitle">
            Your login works, but this account is not linked to an active
            agency membership yet.
          </p>
        </section>
      </main>
    );
  }

  const { data: agency } = await supabase
    .from("agencies")
    .select("name, default_currency")
    .eq("id", agencyId)
    .maybeSingle();

  const today = new Date();
  const todayDate = today.toISOString().slice(0, 10);

  const [
    { data: clientData, error: clientsError },
    { data: taskData, error: tasksError },
    { data: approvalData, error: approvalsError },
  ] = await Promise.all([
    supabase.from("clients").select("id, name, status").eq("agency_id", agencyId).order("name"),
    supabase.from("tasks").select("id, client_id, title, status, priority, assignee_id, due_at, visibility").eq("agency_id", agencyId).order("due_at", { ascending: true }).limit(200),
    supabase.from("approvals").select("id, client_id, title, status, submitted_at, resource_type").eq("agency_id", agencyId).order("submitted_at", { ascending: false }).limit(100),
  ]);

  const clients = (clientData ?? []) as ClientRow[];
  const tasks = (taskData ?? []) as TaskRow[];
  const approvals = (approvalData ?? []) as ApprovalRow[];

  const clientNames = new Map(
    clients.map((client) => [client.id, client.name])
  );

  const openTasks = tasks.filter(
    (task) =>
      !["completed", "canceled"].includes(String(task.status))
  );

  const overdueTasks = openTasks.filter(
    (task) => task.due_at && task.due_at.slice(0, 10) < todayDate
  );

  const dueSoonTasks = openTasks.filter((task) => {
    if (!task.due_at) return false;
    const due = new Date(task.due_at);
    const daysUntilDue =
      (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntilDue >= 0 && daysUntilDue <= 7;
  });

  const pendingApprovals = approvals.filter((approval) =>
    ["pending", "changes_requested"].includes(
      String(approval.status).toLowerCase()
    )
  );

  const activeCount = clients.filter((client) => client.status === "active").length;
  const onboardingCount = clients.filter((client) => client.status === "onboarding").length;
  const clientTasks = (clientId: string) => openTasks.filter((task) => task.client_id === clientId);
  const clientOverdues = (clientId: string) => overdueTasks.filter((task) => task.client_id === clientId);
  const clientReviews = (clientId: string) => pendingApprovals.filter((approval) => approval.client_id === clientId);
  const attentionTasks = [...overdueTasks, ...dueSoonTasks]
    .filter((task, index, all) => all.findIndex((item) => item.id === task.id) === index)
    .slice(0, 8);

  return (
    <main className="dashboard-page">
      <aside className="dashboard-sidebar">
        <div className="dashboard-brand">growth<span>os</span></div>
        <p className="sidebar-label">WORKSPACE</p>
        <Link className="sidebar-link active" href="/"><BriefcaseBusiness size={18} /> Overview</Link>
        <Link className="sidebar-link" href="/clients"><Users size={18} /> Clients</Link>
        <div className="sidebar-bottom">
          <div className="user-avatar">{(user.email?.[0] ?? "G").toUpperCase()}</div>
          <div className="user-info"><strong>{user.email}</strong><span>{agency?.name ?? "Agency workspace"}</span></div>
          <form action={signOut}><button className="icon-button" type="submit" title="Sign out" aria-label="Sign out"><LogOut size={17} /></button></form>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <p className="dashboard-eyebrow">AGENCY OWNER VIEW</p>
            <h1>Client work at a glance</h1>
            <p className="dashboard-subtitle">See what is moving, what is late, and what needs a client decision.</p>
          </div>
          <Link href="/clients" className="clients-primary">+ Add or view clients</Link>
        </header>

        {(tasksError || approvalsError || clientsError) && (
          <div className="dashboard-warning"><AlertTriangle size={17} /> Some work information could not load. Please check workspace permissions.</div>
        )}

        <section className="kpi-grid" aria-label="Work overview">
          <article className="kpi-card"><div className="kpi-topline"><span>All clients</span><span className="kpi-icon purple"><Users size={19} /></span></div><div className="kpi-value">{clients.length}</div><p className="kpi-detail">{activeCount} active · {onboardingCount} onboarding</p></article>
          <article className="kpi-card"><div className="kpi-topline"><span>Open tasks</span><span className="kpi-icon blue"><ClipboardCheck size={19} /></span></div><div className="kpi-value">{openTasks.length}</div><p className="kpi-detail">Work still to be done</p></article>
          <article className="kpi-card"><div className="kpi-topline"><span>Overdue</span><span className="kpi-icon orange"><AlertTriangle size={19} /></span></div><div className="kpi-value">{overdueTasks.length}</div><p className="kpi-detail">Past the due date</p></article>
          <article className="kpi-card"><div className="kpi-topline"><span>Client reviews</span><span className="kpi-icon green"><ClipboardCheck size={19} /></span></div><div className="kpi-value">{pendingApprovals.length}</div><p className="kpi-detail">Awaiting a decision or changes</p></article>
        </section>

        <section className="panel owner-list-panel client-health-panel">
          <div className="panel-heading"><div><h2>Clients</h2><p>Open a client to see their tasks, overdue work, requests, and reviews.</p></div><Link href="/clients" className="panel-action">Manage clients <ArrowUpRight size={15} /></Link></div>
          {clients.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon"><Users size={24} /></div><h3>No clients yet</h3><p>Add your first client to start tracking work.</p><Link href="/clients" className="primary-link">Add your first client</Link></div>
          ) : (
            <div className="table-scroll"><table className="campaign-table"><thead><tr><th>Client</th><th>Status</th><th>Open tasks</th><th>Overdue</th><th>Client review</th></tr></thead><tbody>
              {clients.map((client) => <tr key={client.id}>
                <td><Link href={`/clients/${client.id}`}><strong>{client.name}</strong></Link></td>
                <td><span className="campaign-status">{prettyStatus(client.status ?? "unknown")}</span></td>
                <td>{clientTasks(client.id).length}</td>
                <td><span className={clientOverdues(client.id).length ? "owner-badge overdue" : "owner-badge completed"}>{clientOverdues(client.id).length}</span></td>
                <td>{clientReviews(client.id).length}</td>
              </tr>)}
            </tbody></table></div>
          )}
        </section>

        <section className="panel owner-list-panel">
          <div className="panel-heading"><div><h2>Needs attention</h2><p>Late work and tasks due soon.</p></div><span className="table-count">{attentionTasks.length}</span></div>
          {!attentionTasks.length ? <div className="empty-state"><h3>Nothing urgent right now</h3><p>Overdue and upcoming tasks will appear here.</p></div> : (
            <div className="owner-task-list">{attentionTasks.map((task) => <div className="owner-task-row" key={task.id}>
              <div className="owner-task-main"><strong>{task.title}</strong><span>{clientNames.get(task.client_id) ?? "Client"} · {task.status.replaceAll("_", " ")}</span></div>
              <span className={task.due_at && task.due_at.slice(0, 10) < todayDate ? "owner-badge overdue" : "owner-badge"}>{dateLabel(task.due_at)}</span>
              <Link href={`/clients/${task.client_id}`} className="panel-action">Open</Link>
            </div>)}</div>
          )}
        </section>

        <footer className="dashboard-footer"><span>Growth OS · Agency workspace</span><span><span className="status-dot" /> Your client work, in one place</span></footer>
      </section>
    </main>
  );
}
