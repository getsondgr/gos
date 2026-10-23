
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  MessageSquare,
  ClipboardList,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

const readable = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) =>
    letter.toUpperCase()
  );

const dateLabel = (value: string | null) => {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default async function ClientRoomPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: memberships, error: membershipError } = await supabase
    .from("agency_members")
    .select("agency_id, role")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (membershipError) {
    return (
      <main className="dashboard-page">
        <section className="dashboard-main">
          <h1>Could not load your workspace</h1>
          <p>Please check your agency membership and database permissions.</p>
          <Link href="/clients">Back to clients</Link>
        </section>
      </main>
    );
  }

  const agencyId = memberships?.[0]?.agency_id;
  const role = memberships?.[0]?.role ?? "";

  if (!agencyId) redirect("/");

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, name, industry, status, timezone, currency, created_at")
    .eq("id", id)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (clientError) {
    return (
      <main className="dashboard-page">
        <section className="dashboard-main">
          <h1>Could not load this client</h1>
          <p>Refresh the page or check the Supabase permissions.</p>
          <Link href="/clients">Back to clients</Link>
        </section>
      </main>
    );
  }

  if (!client) notFound();

  const [
    { data: tasks, error: tasksError },
    { data: approvals, error: approvalsError },
    { data: tickets, error: ticketsError },
    { data: events, error: eventsError },
    { count: campaignCount },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, status, priority, due_at, visibility, assignee_id")
      .eq("agency_id", agencyId)
      .eq("client_id", id)
      .neq("status", "canceled")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(20),

    supabase
      .from("approvals")
      .select("id, title, status, submitted_at, resource_type")
      .eq("agency_id", agencyId)
      .eq("client_id", id)
      .order("submitted_at", { ascending: false })
      .limit(20),

    supabase
      .from("tickets")
      .select("id, ticket_number, title, status, priority, due_at, created_at")
      .eq("agency_id", agencyId)
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(20),

    supabase
      .from("activity_events")
      .select("id, event_type, visibility, payload, created_at")
      .eq("agency_id", agencyId)
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(10),

    supabase
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .eq("client_id", id),
  ]);

  const openTasks = (tasks ?? []).filter(
    (task) => task.status !== "completed"
  );

  const pendingApprovals = (approvals ?? []).filter(
    (approval) => approval.status === "pending"
  );

  const openTickets = (tickets ?? []).filter(
    (ticket) =>
      !["completed", "rejected", "canceled"].includes(ticket.status)
  );

  const now = new Date();
  const overdueTasks = openTasks.filter(
    (task) => task.due_at && new Date(task.due_at) < now
  );

  const hasErrors =
    tasksError ||
    approvalsError ||
    ticketsError ||
    eventsError;

  return (
    <main className="dashboard-page">
      <aside className="dashboard-sidebar">
        <Link href="/" className="dashboard-brand">
          growth<span>os</span>
        </Link>

        <p className="sidebar-label">WORKSPACE</p>

        <Link className="sidebar-link" href="/">
          <ClipboardList size={18} /> Overview
        </Link>

        <Link className="sidebar-link active" href="/clients">
          <MessageSquare size={18} /> Clients
        </Link>

        <div className="sidebar-bottom">
          <div className="user-avatar">
            {(user.email?.[0] ?? "G").toUpperCase()}
          </div>
          <div className="user-info">
            <strong>{user.email}</strong>
            <span>{readable(role)}</span>
          </div>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <Link
              href="/clients"
              className="client-room-back"
            >
              <ArrowLeft size={16} /> All clients
            </Link>
            <p className="dashboard-eyebrow">CLIENT ROOM</p>
            <h1>{client.name}</h1>
            <p className="dashboard-subtitle">
              One shared view of what is happening and what needs action.
            </p>
          </div>

          <span className="client-room-status">
            <span className="status-dot" />
            {readable(client.status)}
          </span>
        </header>

        {hasErrors && (
          <div className="dashboard-warning">
            Some sections could not load. The visible data may be incomplete;
            check your Supabase table permissions.
          </div>
        )}

        <div className="client-room-summary">
          <article className="client-room-stat">
            <span>Open actions</span>
            <strong>{openTasks.length}</strong>
            <small>{overdueTasks.length} overdue</small>
          </article>

          <article className="client-room-stat">
            <span>Awaiting approval</span>
            <strong>{pendingApprovals.length}</strong>
            <small>Items needing a decision</small>
          </article>

          <article className="client-room-stat">
            <span>Open requests</span>
            <strong>{openTickets.length}</strong>
            <small>Client requests and issues</small>
          </article>

          <article className="client-room-stat">
            <span>Campaigns</span>
            <strong>{campaignCount ?? 0}</strong>
            <small>Linked to this client</small>
          </article>
        </div>

        <div className="client-room-grid">
          <section className="client-room-panel">
            <div className="client-room-panel-heading">
              <div>
                <h2>Action items</h2>
                <p>Work that still needs to move forward.</p>
              </div>
              <ClipboardList size={20} />
            </div>

            {!tasks?.length ? (
              <div className="client-room-empty">
                <CheckCircle2 size={24} />
                <strong>No actions yet</strong>
                <p>Tasks for this client will appear here.</p>
              </div>
            ) : (
              <div className="client-room-list">
                {tasks.map((task) => (
                  <article className="client-room-list-item" key={task.id}>
                    <div className="client-room-item-main">
                      <strong>{task.title}</strong>
                      <span>
                        {readable(task.status)} · {readable(task.priority)}
                      </span>
                    </div>
                    <div className="client-room-item-meta">
                      <span>{dateLabel(task.due_at)}</span>
                      <span className="client-room-tag">
                        {readable(task.visibility)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="client-room-panel">
            <div className="client-room-panel-heading">
              <div>
                <h2>Approvals</h2>
                <p>Items waiting for a decision or already reviewed.</p>
              </div>
              <ShieldCheck size={20} />
            </div>

            {!approvals?.length ? (
              <div className="client-room-empty">
                <ShieldCheck size={24} />
                <strong>No approvals yet</strong>
                <p>Submitted approvals will appear here.</p>
              </div>
            ) : (
              <div className="client-room-list">
                {approvals.map((approval) => (
                  <article
                    className="client-room-list-item"
                    key={approval.id}
                  >
                    <div className="client-room-item-main">
                      <strong>{approval.title}</strong>
                      <span>
                        {readable(approval.resource_type)}
                      </span>
                    </div>
                    <div className="client-room-item-meta">
                      <span>{readable(approval.status)}</span>
                      <span>{dateLabel(approval.submitted_at)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="client-room-panel">
            <div className="client-room-panel-heading">
              <div>
                <h2>Requests</h2>
                <p>Questions, issues, and client requests.</p>
              </div>
              <MessageSquare size={20} />
            </div>

            {!tickets?.length ? (
              <div className="client-room-empty">
                <MessageSquare size={24} />
                <strong>No requests yet</strong>
                <p>Requests will appear here when created.</p>
              </div>
            ) : (
              <div className="client-room-list">
                {tickets.map((ticket) => (
                  <article
                    className="client-room-list-item"
                    key={ticket.id}
                  >
                    <div className="client-room-item-main">
                      <strong>{ticket.title}</strong>
                      <span>
                        Request #{ticket.ticket_number} ·{" "}
                        {readable(ticket.priority)}
                      </span>
                    </div>
                    <div className="client-room-item-meta">
                      <span>{readable(ticket.status)}</span>
                      <span>{dateLabel(ticket.due_at)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="client-room-panel">
            <div className="client-room-panel-heading">
              <div>
                <h2>Recent updates</h2>
                <p>The latest activity recorded for this client.</p>
              </div>
              <Clock3 size={20} />
            </div>

            {!events?.length ? (
              <div className="client-room-empty">
                <Clock3 size={24} />
                <strong>No updates yet</strong>
                <p>New client-visible activity will appear here.</p>
              </div>
            ) : (
              <div className="client-room-list">
                {events.map((event) => (
                  <article className="client-room-list-item" key={event.id}>
                    <div className="client-room-item-main">
                      <strong>{readable(event.event_type)}</strong>
                      <span>
                        {event.visibility === "client_visible"
                          ? "Shared update"
                          : "Internal update"}
                      </span>
                    </div>
                    <div className="client-room-item-meta">
                      <span>
                        {new Date(event.created_at).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="client-room-panel client-room-details">
          <h2>Client details</h2>
          <div className="client-room-detail-grid">
            <div>
              <span>Industry</span>
              <strong>{client.industry || "Not specified"}</strong>
            </div>
            <div>
              <span>Currency</span>
              <strong>{client.currency || "INR"}</strong>
            </div>
            <div>
              <span>Time zone</span>
              <strong>{client.timezone || "Not specified"}</strong>
            </div>
            <div>
              <span>Added on</span>
              <strong>{dateLabel(client.created_at)}</strong>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
