import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import SubmitButton from "@/components/submit-button";

const STATUSES = ["todo", "in_progress", "blocked", "in_review", "completed", "canceled"] as const;
const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const date = (value: string | null) => value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "No due date";

async function updateTask(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase.from("agency_members").select("agency_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
  if (!membership) redirect("/clients?error=workspace");
  const taskId = String(formData.get("task_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!taskId || !STATUSES.includes(status as typeof STATUSES[number])) redirect("/tasks?error=invalid");
  const { error } = await supabase.from("tasks").update({ status }).eq("id", taskId).eq("agency_id", membership.agency_id);
  if (error) redirect("/tasks?error=update");
  revalidatePath("/tasks"); revalidatePath("/"); revalidatePath("/clients");
  redirect("/tasks?updated=1");
}

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ status?: string; view?: string; error?: string; updated?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase.from("agency_members").select("agency_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
  if (!membership) redirect("/clients?error=workspace");
  const { data: clients } = await supabase.from("clients").select("id,name").eq("agency_id", membership.agency_id).order("name");
  const { data: tasks, error } = await supabase.from("tasks").select("id,client_id,title,description,status,priority,due_at,visibility,created_at").eq("agency_id", membership.agency_id).order("due_at", { ascending: true, nullsFirst: false }).limit(500);
  const names = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const all = tasks ?? [];
  const open = all.filter((t) => !["completed", "canceled"].includes(t.status));
  const overdue = open.filter((t) => t.due_at && t.due_at.slice(0,10) < today);
  const todayTasks = open.filter((t) => t.due_at && t.due_at.slice(0,10) === today);
  const tomorrowDate = new Date(`${today}T12:00:00+05:30`); tomorrowDate.setDate(tomorrowDate.getDate()+1);
  const tomorrow = tomorrowDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const tomorrowTasks = open.filter((t) => t.due_at && t.due_at.slice(0,10) === tomorrow);
  const selected = params.status && STATUSES.includes(params.status as typeof STATUSES[number]) ? params.status : "all";
  const visible = selected === "all" ? all : selected === "overdue" ? overdue : selected === "today" ? todayTasks : selected === "tomorrow" ? tomorrowTasks : all.filter((t) => t.status === selected);
  return <main className="dashboard-page"><aside className="dashboard-sidebar"><div className="dashboard-brand">growth<span>os</span></div><p className="sidebar-label">WORKSPACE</p><Link className="sidebar-link" href="/">▦ Overview</Link><Link className="sidebar-link" href="/clients">♙ Clients</Link><Link className="sidebar-link active" href="/tasks">✓ Tasks & calendar</Link><Link className="sidebar-link" href="/settings">⚙ Service templates</Link><div className="sidebar-bottom"><div className="user-avatar">{(user.email?.[0] ?? "G").toUpperCase()}</div><div className="user-info"><strong>{user.email}</strong><span>Agency workspace</span></div></div></aside>
  <section className="dashboard-main"><header className="dashboard-topbar"><div><p className="dashboard-eyebrow">AGENCY WORKSPACE</p><h1>Tasks & daily plan</h1><p className="dashboard-subtitle">See what is due, what is late, and what is waiting for the next action.</p></div><Link href="/clients" className="clients-primary">+ Create client plan</Link></header>
  {params.error && <div className="dashboard-warning">Could not update the task. Refresh and try again.</div>}{params.updated && <div className="dashboard-success">Task status updated.</div>}{error && <div className="dashboard-warning">Some tasks could not load. Check your workspace permissions.</div>}
  <section className="kpi-grid" aria-label="Task summary"><article className="kpi-card"><div className="kpi-topline">Open tasks</div><div className="kpi-value">{open.length}</div><p className="kpi-detail">Still needs action</p></article><article className="kpi-card"><div className="kpi-topline">Due today</div><div className="kpi-value">{todayTasks.length}</div><p className="kpi-detail">Needs progress today</p></article><article className="kpi-card"><div className="kpi-topline">Due tomorrow</div><div className="kpi-value">{tomorrowTasks.length}</div><p className="kpi-detail">Prepare ahead</p></article><article className="kpi-card"><div className="kpi-topline">Overdue</div><div className="kpi-value">{overdue.length}</div><p className="kpi-detail">Past the due date</p></article></section>
  <nav className="task-filter-row"><Link className={selected === "all" ? "task-filter active" : "task-filter"} href="/tasks">All tasks</Link><Link className={selected === "today" ? "task-filter active" : "task-filter"} href="/tasks?status=today">Due today</Link><Link className={selected === "tomorrow" ? "task-filter active" : "task-filter"} href="/tasks?status=tomorrow">Due tomorrow</Link><Link className={selected === "overdue" ? "task-filter active" : "task-filter"} href="/tasks?status=overdue">Overdue</Link>{STATUSES.map((s) => <Link key={s} className={selected === s ? "task-filter active" : "task-filter"} href={`/tasks?status=${s}`}>{label(s)}</Link>)}</nav>
  <section className="panel owner-list-panel"><div className="panel-heading"><div><h2>{selected === "all" ? "All tasks" : label(selected)}</h2><p>Update status as work moves. Client-visible tasks are shared in the client workspace.</p></div><span className="table-count">{visible.length}</span></div>
  {!visible.length ? <div className="empty-state"><h3>Nothing in this view</h3><p>New client onboarding plans and tasks will appear here automatically.</p></div> : <div className="task-list">{visible.map((task) => <article className="task-card" key={task.id}><div className="task-card-main"><div className="task-title-row"><strong>{task.title}</strong><span className={`task-priority ${task.priority}`}>{label(task.priority)}</span></div><p>{names.get(task.client_id) ?? "Client"} · {task.visibility === "client_visible" ? "Client visible" : "Internal"}</p>{task.description && <p className="task-description">{task.description}</p>}<div className="task-meta"><span>Due: {date(task.due_at)}</span><span className={`task-state ${task.status}`}>{label(task.status)}</span></div></div><form action={updateTask} className="task-status-form"><input type="hidden" name="task_id" value={task.id}/><label>Update status<select name="status" defaultValue={task.status}>{STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></label><SubmitButton className="clients-secondary" pendingText="Saving…">Save</SubmitButton><Link href={`/clients/${task.client_id}`} className="panel-action">Open client ↗</Link></form></article>)}</div>}</section>
  <footer className="dashboard-footer"><span>Growth OS · Daily action centre</span><span>Dates use the agency timezone (Asia/Kolkata).</span></footer></section></main>;
}