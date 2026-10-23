import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const STATUSES = ["todo", "in_progress", "blocked", "in_review", "completed"] as const;
const label = (s: string) => s.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
const dateLabel = (s: string | null) => s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "No due date";

async function context() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase.from("agency_members").select("agency_id, role")
    .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
  if (!membership) redirect("/clients?error=workspace");
  return { supabase, user, membership };
}

async function createTask(form: FormData) {
  "use server";
  const { supabase, user, membership } = await context();
  const clientId = String(form.get("client_id") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const priority = String(form.get("priority") ?? "normal");
  const due = String(form.get("due_at") ?? "");
  if (!clientId || title.length < 2 || title.length > 160) redirect(`/clients/${clientId}?error=task`);
  const { data: client } = await supabase.from("clients").select("id").eq("id", clientId).eq("agency_id", membership.agency_id).maybeSingle();
  if (!client) notFound();
  const { error } = await supabase.from("tasks").insert({
    agency_id: membership.agency_id, client_id: clientId, title, description: description || null,
    status: "todo", priority: ["low","normal","high","urgent"].includes(priority) ? priority : "normal",
    due_at: due ? new Date(`${due}T23:59:00`).toISOString() : null,
    visibility: "client_visible", created_by: user.id
  });
  if (error) redirect(`/clients/${clientId}?error=task`);
  revalidatePath(`/clients/${clientId}`); revalidatePath("/");
  redirect(`/clients/${clientId}?success=task`);
}

async function updateTask(form: FormData) {
  "use server";
  const { supabase, membership } = await context();
  const clientId = String(form.get("client_id") ?? "");
  const taskId = String(form.get("task_id") ?? "");
  const status = String(form.get("status") ?? "");
  if (!clientId || !taskId || !STATUSES.includes(status as typeof STATUSES[number])) redirect(`/clients/${clientId}?error=update`);
  const { error } = await supabase.from("tasks").update({ status }).eq("id", taskId).eq("client_id", clientId).eq("agency_id", membership.agency_id);
  if (error) redirect(`/clients/${clientId}?error=update`);
  revalidatePath(`/clients/${clientId}`); revalidatePath("/");
  redirect(`/clients/${clientId}?success=update`);
}

async function createRequest(form: FormData) {
  "use server";
  const { supabase, user, membership } = await context();
  const clientId = String(form.get("client_id") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const priority = String(form.get("priority") ?? "normal");
  if (!clientId || title.length < 3 || title.length > 160) redirect(`/clients/${clientId}?error=request`);
  const { data: client } = await supabase.from("clients").select("id").eq("id", clientId).eq("agency_id", membership.agency_id).maybeSingle();
  if (!client) notFound();
  const { error } = await supabase.from("tickets").insert({
    agency_id: membership.agency_id, client_id: clientId, title, description: description || null,
    category: "general", priority: ["low","normal","high","urgent"].includes(priority) ? priority : "normal",
    status: "submitted", created_by: user.id
  });
  if (error) redirect(`/clients/${clientId}?error=request`);
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}?success=request`);
}

async function addReply(form: FormData) {
  "use server";
  const { supabase, user, membership } = await context();
  const clientId = String(form.get("client_id") ?? "");
  const ticketId = String(form.get("ticket_id") ?? "");
  const body = String(form.get("body") ?? "").trim();
  if (!clientId || !ticketId || !body || body.length > 3000) redirect(`/clients/${clientId}?error=reply`);
  const { data: ticket } = await supabase.from("tickets").select("id").eq("id", ticketId).eq("client_id", clientId).eq("agency_id", membership.agency_id).maybeSingle();
  if (!ticket) notFound();
  const { error } = await supabase.from("ticket_comments").insert({
    agency_id: membership.agency_id, client_id: clientId, ticket_id: ticketId,
    author_id: user.id, body, visibility: "client_visible"
  });
  if (error) redirect(`/clients/${clientId}?error=reply`);
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}?success=reply`);
}

export default async function ClientRoomPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase, user, membership } = await context();
  const { data: client } = await supabase.from("clients").select("id,name,industry,status,timezone,currency")
    .eq("id", id).eq("agency_id", membership.agency_id).maybeSingle();
  if (!client) notFound();
  const [taskRes, ticketRes, approvalRes, campaignRes] = await Promise.all([
    supabase.from("tasks").select("id,title,description,status,priority,due_at,visibility,created_at")
      .eq("agency_id", membership.agency_id).eq("client_id", id).neq("status", "canceled").order("created_at", { ascending: false }).limit(50),
    supabase.from("tickets").select("id,ticket_number,title,description,status,priority,due_at,created_at")
      .eq("agency_id", membership.agency_id).eq("client_id", id).order("created_at", { ascending: false }).limit(30),
    supabase.from("approvals").select("id,title,status,submitted_at,review_comment")
      .eq("agency_id", membership.agency_id).eq("client_id", id).order("submitted_at", { ascending: false }).limit(20),
    supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("agency_id", membership.agency_id).eq("client_id", id)
  ]);
  const tasks = taskRes.data ?? [];
  const tickets = ticketRes.data ?? [];
  const approvals = approvalRes.data ?? [];
  const openTasks = tasks.filter(t => !["completed","canceled"].includes(t.status));
  const overdue = openTasks.filter(t => t.due_at && new Date(t.due_at).getTime() < Date.now());
  const pending = approvals.filter(a => ["pending","changes_requested"].includes(a.status));
  const openTickets = tickets.filter(t => !["completed","rejected","canceled"].includes(t.status));
  const ids = tickets.map(t => t.id);
  let comments: { id:string; ticket_id:string; body:string; author_id:string|null; created_at:string }[] = [];
  if (ids.length) {
    const { data } = await supabase.from("ticket_comments").select("id,ticket_id,body,author_id,created_at")
      .eq("agency_id", membership.agency_id).eq("client_id", id).eq("visibility", "client_visible")
      .in("ticket_id", ids).order("created_at", { ascending: true }).limit(100);
    comments = data ?? [];
  }
  const messages: Record<string,string> = {
    "success=task":"Action item created and shared.", "success=update":"Action status updated.",
    "success=request":"Client request created.", "success=reply":"Reply added.",
    "error=task":"Could not create action. Check the fields and database permissions.",
    "error=update":"Could not update this action.", "error=request":"Could not create request.",
    "error=reply":"Could not add reply. Check database permissions."
  };
  const messageKey = Object.keys(messages).find(k => { const [a,b] = k.split("="); return String(query[a] ?? "") === b; });

  return <main className="clients-page"><div className="clients-shell">
    <header className="clients-header"><div><Link href="/clients" className="client-room-back">← All clients</Link><p className="clients-breadcrumb">GROWTH OS / CLIENT ROOM</p><h1>{client.name}</h1><p>{client.industry || "Client workspace"} · {label(client.status)} · {client.currency || "INR"}</p></div><Link href="/clients" className="clients-button clients-secondary">All clients</Link></header>
    {messageKey && <p role="status" className={messageKey.startsWith("error=") ? "clients-message clients-error" : "clients-message"}>{messages[messageKey]}</p>}
    <section className="clients-stats">{[
      {label:"Open actions",value:openTasks.length,detail:`${overdue.length} overdue`},
      {label:"Pending approvals",value:pending.length,detail:"Awaiting a decision"},
      {label:"Open requests",value:openTickets.length,detail:"Requests not resolved"},
      {label:"Campaigns",value:campaignRes.count ?? 0,detail:"Linked campaigns"}
    ].map(x=><article className="clients-stat" key={x.label}><p className="clients-stat-label">{x.label}</p><strong className="clients-stat-value">{x.value}</strong><span className="client-room-stat-detail">{x.detail}</span></article>)}</section>
    <div className="client-room-workflow-grid">
      <section className="clients-panel"><h2>Create an action</h2><p className="clients-panel-subtitle">Make the next piece of work clear and visible.</p><form action={createTask} className="client-room-form"><input type="hidden" name="client_id" value={id}/><label>Action title *<input name="title" required minLength={2} maxLength={160} placeholder="e.g. Share next week's campaign plan"/></label><label>Description<textarea name="description" rows={3} maxLength={2000} placeholder="Add context or expected outcome"/></label><div className="client-room-form-row"><label>Priority<select name="priority" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label>Due date<input type="date" name="due_at"/></label></div><button className="clients-primary" type="submit">Create action</button></form></section>
      <section className="clients-panel"><h2>Log a client request</h2><p className="clients-panel-subtitle">Track a question, change request, or issue.</p><form action={createRequest} className="client-room-form"><input type="hidden" name="client_id" value={id}/><label>Request title *<input name="title" required minLength={3} maxLength={160} placeholder="e.g. Update the landing page headline"/></label><label>Details<textarea name="description" rows={3} maxLength={3000} placeholder="What needs to change or be answered?"/></label><label>Priority<select name="priority" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><button className="clients-primary" type="submit">Create request</button></form></section>
    </div>
    <section className="clients-panel"><div className="client-room-section-heading"><div><h2>Action items</h2><p className="clients-panel-subtitle">Update status as work moves forward.</p></div><span className="client-room-count">{openTasks.length} open</span></div>
      {!tasks.length ? <div className="clients-empty"><strong>No action items yet</strong><p>Create the first action above to get work moving.</p></div> : <div className="client-room-record-list">{tasks.map(t=><article className="client-room-record" key={t.id}><div className="client-room-record-copy"><strong>{t.title}</strong>{t.description && <p>{t.description}</p>}<span>{label(t.priority)} priority · Due {dateLabel(t.due_at)} · {label(t.visibility)}</span></div><form action={updateTask} className="client-room-inline-form"><input type="hidden" name="client_id" value={id}/><input type="hidden" name="task_id" value={t.id}/><label className="sr-only" htmlFor={`status-${t.id}`}>Status for {t.title}</label><select id={`status-${t.id}`} name="status" defaultValue={t.status}>{STATUSES.map(s=><option key={s} value={s}>{label(s)}</option>)}</select><button type="submit" className="clients-secondary">Save</button></form></article>)}</div>}
    </section>
    <section className="clients-panel"><div className="client-room-section-heading"><div><h2>Requests & replies</h2><p className="clients-panel-subtitle">Replies created here are client-visible; internal notes are not shown.</p></div><span className="client-room-count">{openTickets.length} open</span></div>
      {!tickets.length ? <div className="clients-empty"><strong>No requests yet</strong><p>Create a request above to start a trackable conversation.</p></div> : <div className="client-room-record-list">{tickets.map(t=><article className="client-room-ticket" key={t.id}><div className="client-room-section-heading"><div><strong>{t.title}</strong><p className="client-room-record-meta">Request #{t.ticket_number} · {label(t.priority)} · {label(t.status)} · {dateLabel(t.created_at)}</p></div><span className={`clients-status ${t.status === "completed" ? "active" : "onboarding"}`}>{label(t.status)}</span></div>{t.description && <p className="client-room-ticket-description">{t.description}</p>}<div className="client-room-comments">{comments.filter(c=>c.ticket_id===t.id).map(c=><div className="client-room-comment" key={c.id}><p>{c.body}</p><span>{c.author_id===user.id ? "You" : "Agency team"} · {new Date(c.created_at).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span></div>)}</div><form action={addReply} className="client-room-reply-form"><input type="hidden" name="client_id" value={id}/><input type="hidden" name="ticket_id" value={t.id}/><label>Reply (visible to client)<textarea name="body" required maxLength={3000} rows={2} placeholder="Write a clear update or response…"/></label><button type="submit" className="clients-secondary">Add reply</button></form></article>)}</div>}
    </section>
    <section className="clients-panel"><h2>Approvals</h2><p className="clients-panel-subtitle">Approval status from existing records. Approval actions can be added after this workflow is verified.</p>{!approvals.length ? <div className="clients-empty"><strong>No approvals yet</strong><p>Approval requests will appear here when submitted.</p></div> : <div className="client-room-record-list">{approvals.map(a=><article className="client-room-record" key={a.id}><div className="client-room-record-copy"><strong>{a.title}</strong><span>Submitted {dateLabel(a.submitted_at)}</span>{a.review_comment && <p>{a.review_comment}</p>}</div><span className={`clients-status ${a.status==="approved"?"active":"onboarding"}`}>{label(a.status)}</span></article>)}</div>}</section>
  </div></main>;
}
