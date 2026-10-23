
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ClipboardCheck,
  LogOut,
  Megaphone,
  MousePointerClick,
  Target,
  TrendingUp,
  Users,
  Wallet,
  BriefcaseBusiness,
  ArrowUpRight,
} from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type MetricRow = {
  campaign_id: string;
  report_date: string;
  spend: number | string;
  impressions: number | string;
  clicks: number | string;
  leads: number | string;
  conversions: number | string;
  attributed_revenue: number | string | null;
  currency: string;
};

type CampaignRow = {
  id: string;
  name: string;
  platform: string;
  status: string;
  client_id: string;
};

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

type MemberRow = {
  user_id: string;
  role: string;
  status: string;
};

type ProjectRow = {
  id: string;
  client_id: string;
  name: string;
  status: string;
};

const numberValue = (value: number | string | null | undefined) =>
  Number(value ?? 0) || 0;

const money = (value: number, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);

const compactNumber = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

const platformName = (platform: string) => {
  const names: Record<string, string> = {
    meta: "Meta Ads",
    google: "Google Ads",
    linkedin: "LinkedIn Ads",
    tiktok: "TikTok Ads",
    other: "Other",
  };
  return names[platform] ?? platform;
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
  const currentRole = memberships?.[0]?.role ?? "team member";

  if (!agencyId) {
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

  const currency = (agency?.default_currency ?? "INR").trim() || "INR";

  const today = new Date();
  const todayDate = today.toISOString().slice(0, 10);
  const since = new Date();
  since.setDate(since.getDate() - 29);
  const sinceDate = since.toISOString().slice(0, 10);

  const [
    { data: campaignData, error: campaignsError },
    { data: clientData, error: clientsError },
    { data: metricData, error: metricsError },
    { data: taskData, error: tasksError },
    { data: approvalData, error: approvalsError },
    { data: memberData, error: membersError },
    { data: projectData, error: projectsError },
  ] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, name, platform, status, client_id")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("clients")
      .select("id, name, status")
      .eq("agency_id", agencyId)
      .order("name"),
    supabase
      .from("performance_metrics_daily")
      .select(
        "campaign_id, report_date, spend, impressions, clicks, leads, conversions, attributed_revenue, currency"
      )
      .eq("agency_id", agencyId)
      .eq("currency", currency)
      .gte("report_date", sinceDate)
      .order("report_date", { ascending: true }),
    supabase
      .from("tasks")
      .select(
        "id, client_id, title, status, priority, assignee_id, due_at, visibility"
      )
      .eq("agency_id", agencyId)
      .order("due_at", { ascending: true })
      .limit(200),
    supabase
      .from("approvals")
      .select("id, client_id, title, status, submitted_at, resource_type")
      .eq("agency_id", agencyId)
      .order("submitted_at", { ascending: false })
      .limit(100),
    supabase
      .from("agency_members")
      .select("user_id, role, status")
      .eq("agency_id", agencyId)
      .eq("status", "active"),
    supabase
      .from("projects")
      .select("id, client_id, name, status")
      .eq("agency_id", agencyId)
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);

  const campaigns = (campaignData ?? []) as CampaignRow[];
  const clients = (clientData ?? []) as ClientRow[];
  const metrics = (metricData ?? []) as MetricRow[];
  const tasks = (taskData ?? []) as TaskRow[];
  const approvals = (approvalData ?? []) as ApprovalRow[];
  const members = (memberData ?? []) as MemberRow[];
  const projects = (projectData ?? []) as ProjectRow[];

  const clientNames = new Map(
    clients.map((client) => [client.id, client.name])
  );

  const activeClients = clients.filter(
    (client) => !client.status || client.status === "active"
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

  const completedTasks = tasks.filter(
    (task) => task.status === "completed"
  );

  const totals = metrics.reduce(
    (result, row) => ({
      spend: result.spend + numberValue(row.spend),
      leads: result.leads + numberValue(row.leads),
      conversions: result.conversions + numberValue(row.conversions),
      revenue:
        result.revenue + numberValue(row.attributed_revenue),
      impressions: result.impressions + numberValue(row.impressions),
      clicks: result.clicks + numberValue(row.clicks),
    }),
    {
      spend: 0,
      leads: 0,
      conversions: 0,
      revenue: 0,
      impressions: 0,
      clicks: 0,
    }
  );

  const cpl = totals.leads > 0 ? totals.spend / totals.leads : null;
  const roas = totals.spend > 0 ? totals.revenue / totals.spend : null;

  const campaignTotals = new Map<
    string,
    {
      spend: number;
      leads: number;
      conversions: number;
      revenue: number;
      impressions: number;
      clicks: number;
    }
  >();

  for (const row of metrics) {
    const current = campaignTotals.get(row.campaign_id) ?? {
      spend: 0,
      leads: 0,
      conversions: 0,
      revenue: 0,
      impressions: 0,
      clicks: 0,
    };

    current.spend += numberValue(row.spend);
    current.leads += numberValue(row.leads);
    current.conversions += numberValue(row.conversions);
    current.revenue += numberValue(row.attributed_revenue);
    current.impressions += numberValue(row.impressions);
    current.clicks += numberValue(row.clicks);
    campaignTotals.set(row.campaign_id, current);
  }

  const topCampaigns = campaigns
    .map((campaign) => ({
      ...campaign,
      totals: campaignTotals.get(campaign.id) ?? {
        spend: 0,
        leads: 0,
        conversions: 0,
        revenue: 0,
        impressions: 0,
        clicks: 0,
      },
    }))
    .sort((a, b) => b.totals.spend - a.totals.spend)
    .slice(0, 8);

  const trend = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - index));
    const date = day.toISOString().slice(0, 10);
    const dayMetrics = metrics.filter((row) => row.report_date === date);

    return {
      date,
      label: day.toLocaleDateString("en-IN", { weekday: "short" }),
      spend: dayMetrics.reduce(
        (sum, row) => sum + numberValue(row.spend),
        0
      ),
      revenue: dayMetrics.reduce(
        (sum, row) => sum + numberValue(row.attributed_revenue),
        0
      ),
    };
  });

  const maxTrend = Math.max(
    1,
    ...trend.map((day) => Math.max(day.spend, day.revenue))
  );

  const kpis = [
    {
      title: "Attributed revenue",
      value: money(totals.revenue, currency),
      detail: "Campaign-attributed",
      icon: CircleDollarSign,
      tone: "purple",
    },
    {
      title: "Ad spend",
      value: money(totals.spend, currency),
      detail: "Last 30 days",
      icon: Wallet,
      tone: "blue",
    },
    {
      title: "Leads generated",
      value: compactNumber(totals.leads),
      detail: `${compactNumber(totals.clicks)} clicks`,
      icon: Users,
      tone: "green",
    },
    {
      title: "Cost per lead",
      value: cpl === null ? "—" : money(cpl, currency),
      detail: "Spend divided by leads",
      icon: Target,
      tone: "orange",
    },
    {
      title: "ROAS",
      value: roas === null ? "—" : `${roas.toFixed(2)}×`,
      detail: "Revenue ÷ spend",
      icon: TrendingUp,
      tone: "purple",
    },
    {
      title: "Conversions",
      value: compactNumber(totals.conversions),
      detail: "Reported conversions",
      icon: MousePointerClick,
      tone: "green",
    },
  ];

  const operationalErrors = [
    tasksError,
    approvalsError,
    membersError,
    projectsError,
    clientsError,
  ].filter(Boolean);

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
