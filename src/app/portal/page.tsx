"use server";

import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import SubmitButton from "@/components/submit-button";

const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "No due date";

async function portalContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase.from("client_members")
    .select("agency_id, client_id, role, status")
    .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
  if (!membership) redirect("/?portal=not-linked");
  return { supabase, user, membership };
}

async function submitDecision(form: FormData) {
  "use server";
  const { supabase, user, membership } = await portalContext();
  const approvalId = String(form.get("approval_id") ?? "");
  const status = String(form.get("status") ?? "");
  const comment = String(form.get("review_comment") ?? "").trim();
  if (!approvalId || !["approved", "changes_requested", "rejected"].includes(status)) redirect("/portal?error=decision");
  const { error } = await supabase.from("approvals").update({
    status,
    review_comment: comment || null,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString()
  }).eq("id", approvalId).eq("agency_id", membership.agency_id).eq("client_id", membership.client_id);
  if (error) redirect("/portal?error=decision");
  revalidatePath("/portal");
  revalidatePath(`/clients/${membership.client_id}`);
  revalidatePath("/");
  redirect("/portal?success=decision");
}

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function ClientPortalPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const { supabase, user, membership } = await portalContext();
  const [{ data: client }, { data: tasks }, { data: approvals }, { data: tickets }, { data: agency }] = await Promise.all([
    supabase.from("clients").select("id,name,industry,status").eq("id", membership.client_id).eq("agency_id", membership.agency_id).maybeSingle(),
    supabase.from("tasks").select("id,title,description,status,priority,due_at,created_at").eq("client_id", membership.client_id).eq("agency_id", membership.agency_id).eq("visibility", "client_visible").neq("status", "canceled").order("created_at", { ascending: false }).limit(100),
    supabase.from("approvals").select("id,title,status,submitted_at,review_comment").eq("client_id", membership.client_id).eq("agency_id", membership.agency_id).order("submitted_at", { ascending: false }).limit(50),
    supabase.from("tickets").select("id,ticket_number,title,description,status,priority,created_at").eq("client_id", membership.client_id).eq("agency_id", membership.agency_id).order("created_at", { ascending: false }).limit(50),
    supabase.from("agencies").select("name").eq("id", membership.agency_id).maybeSingle()
  ]);
  if (!client) redirect("/login?error=portal");
  const openTasks = (tasks ?? []).filter((task) => !["completed", "canceled"].includes(task.status));
  const overdueTasks = openTasks.filter((task) => task.due_at && new Date(task.due_at).getTime() < Date.now());
  const waiting = (approvals ?? []).filter((approval) => ["pending", "changes_requested"].includes(approval.status));
  const message = query.success === "decision" ? "Your decision has been saved." : query.error === "decision" ? "We couldn't save that decision. Please try again or contact your agency team." : "";

  return (
    <main className="clients-page portal-page">
      <div className="clients-shell">
        <header className="clients-header">
          <div>
            <p className="clients-breadcrumb">GROWTH OS / CLIENT PORTAL</p>
            <h1>{client.name}</h1>
            <p>Your shared workspace with {agency?.name ?? "your agency"} — work, updates, and decisions in one place.</p>
          </div>
          <form action={signOut}><button className="clients-secondary" type="submit">Sign out</button></form>
        </header>

        {message && <p role="status" className={query.error ? "clients-message clients-error" : "clients-message"}>{message}</p>}

        <section className="portal-welcome">
          <div><span className="portal-overline">YOUR WORKSPACE</span><h2>Here’s where things stand.</h2><p>Review current work and respond when your input is needed.</p></div>
          <span className={`clients-status ${client.status === "active" ? "active" : "onboarding"}`}>{label(client.status)}</span>
        </section>

        <section className="clients-stats portal-stats">
          <article className="clients-stat"><p className="clients-stat-label">Open tasks</p><strong className="clients-stat-value">{openTasks.length}</strong><span className="client-room-stat-detail">Work in progress</span></article>
          <article className="clients-stat"><p className="clients-stat-label">Overdue</p><strong className="clients-stat-value">{overdueTasks.length}</strong><span className="client-room-stat-detail">Past the due date</span></article>
          <article className="clients-stat"><p className="clients-stat-label">Your review</p><strong className="clients-stat-value">{waiting.length}</strong><span className="client-room-stat-detail">Waiting for your decision</span></article>
          <article className="clients-stat"><p className="clients-stat-label">Requests</p><strong className="clients-stat-value">{(tickets ?? []).filter((ticket) => !["completed", "rejected", "canceled"].includes(ticket.status)).length}</strong><span className="client-room-stat-detail">Still being handled</span></article>
        </section>

        <section className="clients-panel">
          <div className="client-room-section-heading"><div><h2>Needs your review</h2><p className="clients-panel-subtitle">Approve a deliverable or tell the team what needs changing.</p></div><span className="client-room-count">{waiting.length} waiting</span></div>
          {!waiting.length ? <div className="portal-empty"><span className="portal-empty-mark">✓</span><strong>You’re all caught up</strong><p>New items needing your decision will appear here.</p></div> : <div className="client-room-record-list">{waiting.map((approval) => <article className="portal-approval" key={approval.id}><div className="client-room-record-copy"><span className="portal-overline">DELIVERABLE · SUBMITTED {dateLabel(approval.submitted_at)}</span><strong>{approval.title}</strong><span>Status: {label(approval.status)}</span>{approval.review_comment && <p>Previous feedback: {approval.review_comment}</p>}</div><form action={submitDecision} className="portal-decision-form"><input type="hidden" name="approval_id" value={approval.id}/><label>Your decision<select name="status" defaultValue={approval.status === "changes_requested" ? "changes_requested" : "approved"}><option value="approved">Approve</option><option value="changes_requested">Request changes</option><option value="rejected">Reject</option></select></label><label>Feedback (optional)<textarea name="review_comment" rows={2} maxLength={2000} placeholder="Add feedback for your agency team…"/></label><SubmitButton className="clients-primary" pendingText="Saving decision…">Send decision</SubmitButton></form></article>)}</div>}
        </section>

        <section className="clients-panel">
          <div className="client-room-section-heading"><div><h2>Current work</h2><p className="clients-panel-subtitle">See what the team is working on and when it is due.</p></div><span className="client-room-count">{openTasks.length} open</span></div>
          {!tasks?.length ? <div className="portal-empty"><strong>No tasks yet</strong><p>Your agency will add work here as the project gets underway.</p></div> : <div className="client-room-record-list">{tasks.map((task) => <article className="client-room-record" key={task.id}><div className="client-room-record-copy"><strong>{task.title}</strong>{task.description && <p>{task.description}</p>}<span>{label(task.priority)} priority · Due {dateLabel(task.due_at)}</span></div><span className={`clients-status ${task.status === "completed" ? "active" : task.status === "blocked" ? "paused" : "onboarding"}`}>{label(task.status)}</span></article>)}</div>}
        </section>

        <section className="clients-panel">
          <div className="client-room-section-heading"><div><h2>Requests & updates</h2><p className="clients-panel-subtitle">Track questions and changes shared with the agency.</p></div><span className="client-room-count">{tickets?.length ?? 0} total</span></div>
          {!tickets?.length ? <div className="portal-empty"><strong>No requests yet</strong><p>Questions and change requests will appear here.</p></div> : <div className="client-room-record-list">{tickets.map((ticket) => <article className="client-room-record" key={ticket.id}><div className="client-room-record-copy"><strong>{ticket.title}</strong><p>{ticket.description}</p><span>Request #{ticket.ticket_number} · {label(ticket.priority)} · {dateLabel(ticket.created_at)}</span></div><span className={`clients-status ${["completed", "approved"].includes(ticket.status) ? "active" : ticket.status === "rejected" ? "paused" : "onboarding"}`}>{label(ticket.status)}</span></article>)}</div>}
        </section>
        <footer className="dashboard-footer"><span>Growth OS · Client portal</span><span>Only your client workspace is shown</span></footer>
      </div>
    </main>
  );
}
