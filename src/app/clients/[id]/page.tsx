import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import SubmitButton from "@/components/submit-button";

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
    agency_id: membership.agency_id, client_id: clientId, title, description: description || title,
    category: "general", priority: ["low","normal","high","urgent"].includes(priority) ? priority : "normal",
    status: "submitted", created_by: user.id
  });
  if (error) redirect(`/clients/${clientId}?error=request`);
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}?success=request`);
}

async function createApproval(form: FormData) {
  "use server";
  const { supabase, user, membership } = await context();
  const clientId = String(form.get("client_id") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const ticketId = String(form.get("ticket_id") ?? "");
  const assetUrl = String(form.get("asset_url") ?? "").trim();
  const caption = String(form.get("caption") ?? "").trim();
  const contentType = String(form.get("content_type") ?? "other");
  if (!clientId || title.length < 3 || title.length > 160) redirect(`/clients/${clientId}?error=approval`);
  if (assetUrl && (!/^https?:\/\//i.test(assetUrl) || assetUrl.length > 2000)) redirect(`/clients/${clientId}?error=approval`);
  if (!["image", "video", "caption", "campaign", "landing_page", "other"].includes(contentType)) redirect(`/clients/${clientId}?error=approval`);
  const { data: client } = await supabase.from("clients").select("id").eq("id", clientId).eq("agency_id", membership.agency_id).maybeSingle();
  if (!client) notFound();
  if (ticketId) {
    const { data: ticket } = await supabase.from("tickets").select("id").eq("id", ticketId).eq("client_id", clientId).eq("agency_id", membership.agency_id).maybeSingle();
    if (!ticket) redirect(`/clients/${clientId}?error=approval`);
  }
  const resourceId = ticketId || clientId;
  const { error } = await supabase.from("approvals").insert({
    agency_id: membership.agency_id, client_id: clientId, resource_type: ticketId ? "ticket" : "general",
    resource_id: resourceId, version_number: 1, title, status: "pending", submitted_by: user.id, submitted_at: new Date().toISOString(),
    asset_url: assetUrl || null, caption: caption || null, content_type: contentType
  });
  if (error) redirect(`/clients/${clientId}?error=approval`);
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}?success=approval`);
}


async function updateRequest(form: FormData) {
  "use server";
  const { supabase, membership } = await context();
  const clientId = String(form.get("client_id") ?? "");
  const ticketId = String(form.get("ticket_id") ?? "");
  const status = String(form.get("status") ?? "");
  const allowed = ["submitted", "under_review", "awaiting_client", "approved", "in_progress", "completed", "rejected", "canceled"];
  if (!clientId || !ticketId || !allowed.includes(status)) redirect(`/clients/${clientId}?error=request-update`);
  const { error } = await supabase.from("tickets").update({ status }).eq("id", ticketId).eq("client_id", clientId).eq("agency_id", membership.agency_id);
  if (error) redirect(`/clients/${clientId}?error=request-update`);
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}?success=request-update`);
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
    supabase.from("approvals").select("id,title,status,submitted_at,review_comment,asset_url,caption,content_type")
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
    "success=request":"Client request created.", "success=reply":"Reply added.", "success=request-update":"Request status updated.", "success=approval":"Approval request created.", "success=approval-update":"Approval status updated.",
    "error=task":"Could not create action. Check the fields and database permissions.",
    "error=update":"Could not update this action.", "error=request":"Could not create request.",
    "error=reply":"Could not add reply. Check database permissions.", "error=request-update":"Could not update request status.", "error=approval":"Could not create approval request.", "error=approval-update":"Could not update approval."
  };
  const messageKey = Object.keys(messages).find(k => { const [a,b] = k.split("="); return String(query[a] ?? "") === b; });

  return <main className="clients-page"><div className="clients-shell">
    <header className="clients-header"><div><Link href="/clients" className="client-room-back">← All clients</Link><p className="clients-breadcrumb">GROWTH OS / CLIENT ROOM</p><h1>{client.name}</h1><p>{client.industry || "Client workspace"} · {label(client.status)} · {client.currency || "INR"}</p></div><div className="client-header-actions"><Link href={`/clients/${id}/preview`} className="clients-button clients-primary">Preview client portal ↗</Link><Link href="/portal" className="clients-button clients-secondary">Portal URL ↗</Link><Link href="/clients" className="clients-button clients-secondary">All clients</Link></div></header>
    {messageKey && <p role="status" className={messageKey.startsWith("error=") ? "clients-message clients-error" : "clients-message"}>{messages[messageKey]}</p>}
    <section className="clients-stats">{[
      {label:"Open actions",value:openTasks.length,detail:`${overdue.length} overdue`},
      {label:"Pending approvals",value:pending.length,detail:"Awaiting a decision"},
      {label:"Open requests",value:openTickets.length,detail:"Requests not resolved"},
      {label:"Campaigns",value:campaignRes.count ?? 0,detail:"Linked campaigns"}
    ].map(x=><article className="clients-stat" key={x.label}><p className="clients-stat-label">{x.label}</p><strong className="clients-stat-value">{x.value}</strong><span className="client-room-stat-detail">{x.detail}</span></article>)}</section>
    <div className="client-room-workflow-grid">
      <section className="clients-panel"><h2>Create an action</h2><p className="clients-panel-subtitle">Make the next piece of work clear and visible.</p><form action={createTask} className="client-room-form"><input type="hidden" name="client_id" value={id}/><label>Action title *<input name="title" required minLength={2} maxLength={160} placeholder="e.g. Share next week's campaign plan"/></label><label>Description<textarea name="description" rows={3} maxLength={2000} placeholder="Add context or expected outcome"/></label><div className="client-room-form-row"><label>Priority<select name="priority" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label>Due date<input type="date" name="due_at"/></label></div><SubmitButton className="clients-primary" pendingText="Creating action…">Create action</SubmitButton></form></section>
      <section className="clients-panel"><h2>Log a client request</h2><p className="clients-panel-subtitle">Track a question, change request, or issue.</p><form action={createRequest} className="client-room-form"><input type="hidden" name="client_id" value={id}/><label>Request title *<input name="title" required minLength={3} maxLength={160} placeholder="e.g. Update the landing page headline"/></label><label>Details<textarea name="description" rows={3} maxLength={3000} placeholder="What needs to change or be answered?"/></label><label>Priority<select name="priority" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><SubmitButton className="clients-primary" pendingText="Creating request…">Create request</SubmitButton></form></section>
    </div>
    <section className="clients-panel"><div className="client-room-section-heading"><div><h2>Action items</h2><p className="clients-panel-subtitle">Update status as work moves forward.</p></div><span className="client-room-count">{openTasks.length} open</span></div>
      {!tasks.length ? <div className="clients-empty"><strong>No action items yet</strong><p>Create the first action above to get work moving.</p></div> : <div className="client-room-record-list">{tasks.map(t=><article className="client-room-record" key={t.id}><div className="client-room-record-copy"><strong>{t.title}</strong>{t.description && <p>{t.description}</p>}<span>{label(t.priority)} priority · Due {dateLabel(t.due_at)} · {label(t.visibility)}</span></div><form action={updateTask} className="client-room-inline-form"><input type="hidden" name="client_id" value={id}/><input type="hidden" name="task_id" value={t.id}/><label className="sr-only" htmlFor={`status-${t.id}`}>Status for {t.title}</label><select id={`status-${t.id}`} name="status" defaultValue={t.status}>{STATUSES.map(s=><option key={s} value={s}>{label(s)}</option>)}</select><SubmitButton className="clients-secondary" pendingText="Saving…">Save</SubmitButton></form></article>)}</div>}
    </section>
    <section className="clients-panel"><div className="client-room-section-heading"><div><h2>Requests & replies</h2><p className="clients-panel-subtitle">Replies created here are client-visible; internal notes are not shown.</p></div><span className="client-room-count">{openTickets.length} open</span></div>
      {!tickets.length ? <div className="clients-empty"><strong>No requests yet</strong><p>Create a request above to start a trackable conversation.</p></div> : <div className="client-room-record-list">{tickets.map(t=><article className="client-room-ticket" key={t.id}><div className="client-room-section-heading"><div><strong>{t.title}</strong><p className="client-room-record-meta">Request #{t.ticket_number} · {label(t.priority)} · {label(t.status)} · {dateLabel(t.created_at)}</p></div><form action={updateRequest} className="client-room-inline-form"><input type="hidden" name="client_id" value={id}/><input type="hidden" name="ticket_id" value={t.id}/><label className="sr-only" htmlFor={`request-status-${t.id}`}>Status for request {t.title}</label><select id={`request-status-${t.id}`} name="status" defaultValue={t.status}><option value="submitted">Submitted</option><option value="under_review">Under review</option><option value="awaiting_client">Awaiting client</option><option value="approved">Approved</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="rejected">Rejected</option><option value="canceled">Canceled</option></select><SubmitButton className="clients-secondary" pendingText="Saving…">Save</SubmitButton></form></div>{t.description && <p className="client-room-ticket-description">{t.description}</p>}<div className="client-room-comments">{comments.filter(c=>c.ticket_id===t.id).map(c=><div className="client-room-comment" key={c.id}><p>{c.body}</p><span>{c.author_id===user.id ? "You" : "Agency team"} · {new Date(c.created_at).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span></div>)}</div><form action={addReply} className="client-room-reply-form"><input type="hidden" name="client_id" value={id}/><input type="hidden" name="ticket_id" value={t.id}/><label>Reply (visible to client)<textarea name="body" required maxLength={3000} rows={2} placeholder="Write a clear update or response…"/></label><SubmitButton className="clients-secondary" pendingText="Sending reply…">Add reply</SubmitButton></form></article>)}</div>}
    </section>
    <section className="clients-panel"><div className="client-room-section-heading"><div><h2>Approval center</h2><p className="clients-panel-subtitle">Send creative, campaign plans, landing pages, or other deliverables to the client for a decision.</p></div><span className="client-room-count">{pending.length} awaiting decision</span></div><form action={createApproval} className="client-room-form"><input type="hidden" name="client_id" value={id}/><label>Deliverable name *<input name="title" required minLength={3} maxLength={160} placeholder="e.g. October Meta ad creatives"/></label><label>Content type<select name="content_type" defaultValue="image"><option value="image">Image / creative</option><option value="video">Video</option><option value="caption">Caption / copy</option><option value="campaign">Campaign plan</option><option value="landing_page">Landing page</option><option value="other">Other deliverable</option></select></label><label>Creative URL (optional)<input name="asset_url" type="url" placeholder="https://… (public or shareable link)"/></label><label>Caption / context (optional)<textarea name="caption" rows={3} maxLength={5000} placeholder="Add caption, creative notes, or what the client should review…"/></label><label>Related client request (optional)<select name="ticket_id" defaultValue=""><option value="">Not linked to a request</option>{tickets.map(t=><option key={t.id} value={t.id}>#{t.ticket_number} — {t.title}</option>)}</select></label><p className="clients-panel-subtitle">The client can review and respond in their Client Portal.</p><SubmitButton className="clients-primary" pendingText="Submitting approval…">Submit for approval</SubmitButton></form>{!approvals.length ? <div className="clients-empty"><strong>No deliverables awaiting approval</strong><p>Add the first deliverable above. It will appear here once saved.</p></div> : <div className="client-room-record-list">{approvals.map(a=><article className="client-room-record" key={a.id}><div className="client-room-record-copy"><strong>{a.title}</strong><span>{label(a.content_type ?? "other")} · Submitted {dateLabel(a.submitted_at)} · {label(a.status)}</span>{a.asset_url && <p><a href={a.asset_url} target="_blank" rel="noreferrer">Open creative / deliverable ↗</a></p>}{a.caption && <p>{a.caption}</p>}{a.review_comment && <p>Feedback: {a.review_comment}</p>}</div>{a.status==="pending" || a.status==="changes_requested" ? <span className={`clients-status ${a.status==="approved"?"active":a.status==="pending"?"onboarding":"paused"}`}>{label(a.status)}</span> : <span className={`clients-status ${a.status==="approved"?"active":"onboarding"}`}>{label(a.status)}</span>}</article>)}</div>}</section>
  </div></main>;
}
