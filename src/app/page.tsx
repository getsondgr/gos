
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
          <h1>We couldn't load your workspace</h1>
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

  return (
    <main className="dashboard-page">
      <aside className="dashboard-sidebar">
        <div className="dashboard-brand">
          growth<span>os</span>
        </div>

        <p className="sidebar-label">WORKSPACE</p>
        <Link className="sidebar-link active" href="/">
          <BarChart3 size={18} /> Overview
        </Link>
        <Link className="sidebar-link" href="/clients">
          <Users size={18} /> Clients
        </Link>
        <div className="sidebar-link muted">
          <Megaphone size={18} /> Campaigns
          <span className="coming-soon">Next</span>
        </div>
        <div className="sidebar-link muted">
          <Activity size={18} /> Reports
          <span className="coming-soon">Next</span>
        </div>

        <div className="sidebar-bottom">
          <div className="user-avatar">
            {(user.email?.[0] ?? "G").toUpperCase()}
          </div>
          <div className="user-info">
            <strong>{user.email}</strong>
            <span>{agency?.name ?? "Agency workspace"}</span>
          </div>
          <form action={signOut}>
            <button
              className="icon-button"
              type="submit"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={17} />
            </button>
          </form>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <p className="dashboard-eyebrow">AGENCY COMMAND CENTER</p>
            <h1>Good to see you</h1>
            <p className="dashboard-subtitle">
              Your performance, priorities, and client work in one place.
            </p>
          </div>
          <div className="date-pill">
            <CalendarDays size={16} /> Last 30 days
          </div>
        </header>

        <div className="workspace-line">
          <span className="status-dot" />
          {agency?.name ?? "Your agency"} <span>·</span>
          {currency} reporting <span>·</span>
          {prettyStatus(currentRole)}
        </div>

        {(campaignsError || metricsError || operationalErrors.length > 0) && (
          <div className="dashboard-warning">
            <AlertTriangle size={17} />
            Some workspace information could not be loaded. Check the
            affected table permissions and Supabase policies.
          </div>
        )}

        <section className="kpi-grid" aria-label="Performance KPIs">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <article className="kpi-card" key={kpi.title}>
                <div className="kpi-topline">
                  <span>{kpi.title}</span>
                  <span className={`kpi-icon ${kpi.tone}`}>
                    <Icon size={19} />
                  </span>
                </div>
                <div className="kpi-value">{kpi.value}</div>
                <p className="kpi-detail">{kpi.detail}</p>
              </article>
            );
          })}
        </section>

        <section className="dashboard-panels">
          <article className="panel trend-panel">
            <div className="panel-heading">
              <div>
                <h2>Spend vs. revenue</h2>
                <p>Daily totals for the last 7 days</p>
              </div>
              <span className="panel-icon">
                <TrendingUp size={18} />
              </span>
            </div>

            <div className="chart-legend">
              <span><i className="legend-spend" /> Ad spend</span>
              <span><i className="legend-revenue" /> Revenue</span>
            </div>

            <div className="bar-chart" aria-label="Daily spend and revenue">
              {trend.map((day) => (
                <div className="bar-day" key={day.date}>
                  <div className="bar-pair">
                    <div
                      className="bar spend-bar"
                      style={{
                        height: `${Math.max(3, (day.spend / maxTrend) * 100)}%`,
                      }}
                      title={`Spend: ${money(day.spend, currency)}`}
                    />
                    <div
                      className="bar revenue-bar"
                      style={{
                        height: `${Math.max(3, (day.revenue / maxTrend) * 100)}%`,
                      }}
                      title={`Revenue: ${money(day.revenue, currency)}`}
                    />
                  </div>
                  <span>{day.label}</span>
                </div>
              ))}
            </div>

            {metrics.length === 0 && (
              <p className="empty-note">
                No reporting records for this period yet. Campaign metrics
                will appear here once reporting data is added.
              </p>
            )}
          </article>

          <article className="panel summary-panel">
            <div className="panel-heading">
              <div>
                <h2>Workspace snapshot</h2>
                <p>Agency-wide activity</p>
              </div>
              <BriefcaseBusiness size={19} />
            </div>
            <div className="summary-stat">
              <span>Clients</span><strong>{clients.length}</strong>
            </div>
            <div className="summary-stat">
              <span>Active clients</span><strong>{activeClients.length}</strong>
            </div>
            <div className="summary-stat">
              <span>Campaigns</span><strong>{campaigns.length}</strong>
            </div>
            <div className="summary-stat">
              <span>Active team members</span><strong>{members.length}</strong>
            </div>
            <div className="summary-stat">
              <span>Projects</span><strong>{projects.length}</strong>
            </div>
            <div className="summary-footnote">
              <span className="status-dot" />
              Based on saved workspace records
            </div>
          </article>
        </section>

        <section className="owner-overview-grid">
          <article className="panel owner-stat-panel">
            <div className="owner-stat-icon overdue"><AlertTriangle size={20} /></div>
            <div>
              <p>Overdue tasks</p>
              <strong>{overdueTasks.length}</strong>
              <span>Open tasks past their due date</span>
            </div>
          </article>
          <article className="panel owner-stat-panel">
            <div className="owner-stat-icon upcoming"><Clock3 size={20} /></div>
            <div>
              <p>Due in 7 days</p>
              <strong>{dueSoonTasks.length}</strong>
              <span>Tasks needing attention soon</span>
            </div>
          </article>
          <article className="panel owner-stat-panel">
            <div className="owner-stat-icon approvals"><ClipboardCheck size={20} /></div>
            <div>
              <p>Pending approvals</p>
              <strong>{pendingApprovals.length}</strong>
              <span>Items awaiting review or changes</span>
            </div>
          </article>
          <article className="panel owner-stat-panel">
            <div className="owner-stat-icon completed"><CheckCircle2 size={20} /></div>
            <div>
              <p>Completed tasks</p>
              <strong>{completedTasks.length}</strong>
              <span>Completed tasks in loaded records</span>
            </div>
          </article>
        </section>

        <section className="dashboard-panels">
          <article className="panel owner-list-panel">
            <div className="panel-heading">
              <div>
                <h2>Needs attention</h2>
                <p>Overdue work and outstanding approvals</p>
              </div>
              <AlertTriangle size={19} />
            </div>

            {overdueTasks.length === 0 && pendingApprovals.length === 0 ? (
              <div className="owner-empty">
                <CheckCircle2 size={22} />
                <p>No overdue tasks or pending approvals found.</p>
              </div>
            ) : (
              <div className="owner-list">
                {overdueTasks.slice(0, 5).map((task) => (
                  <div className="owner-list-item" key={task.id}>
                    <span className="owner-list-symbol overdue">
                      <Clock3 size={16} />
                    </span>
                    <div className="owner-list-copy">
                      <strong>{task.title}</strong>
                      <span>
                        {clientNames.get(task.client_id) ?? "Client"} · Due{" "}
                        {dateLabel(task.due_at)}
                      </span>
                    </div>
                    <span className="owner-badge overdue">Overdue</span>
                  </div>
                ))}
                {pendingApprovals.slice(0, 5).map((approval) => (
                  <div className="owner-list-item" key={approval.id}>
                    <span className="owner-list-symbol approvals">
                      <ClipboardCheck size={16} />
                    </span>
                    <div className="owner-list-copy">
                      <strong>{approval.title}</strong>
                      <span>
                        {clientNames.get(approval.client_id) ?? "Client"} ·{" "}
                        {prettyStatus(approval.status)}
                      </span>
                    </div>
                    <span className="owner-badge approvals">Review</span>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="panel owner-list-panel">
            <div className="panel-heading">
              <div>
                <h2>Upcoming work</h2>
                <p>Open tasks sorted by due date</p>
              </div>
              <CalendarDays size={19} />
            </div>

            {openTasks.length === 0 ? (
              <div className="owner-empty">
                <CheckCircle2 size={22} />
                <p>No open tasks found. New tasks will appear here.</p>
              </div>
            ) : (
              <div className="owner-list">
                {openTasks.slice(0, 8).map((task) => (
                  <div className="owner-list-item" key={task.id}>
                    <span className="owner-list-symbol upcoming">
                      <ArrowUpRight size={16} />
                    </span>
                    <div className="owner-list-copy">
                      <strong>{task.title}</strong>
                      <span>
                        {clientNames.get(task.client_id) ?? "Client"} ·{" "}
                        {prettyStatus(task.status)} ·{" "}
                        {task.assignee_id ? "Assigned" : "Unassigned"}
                      </span>
                    </div>
                    <span className="owner-due">{dateLabel(task.due_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>

        <section className="panel owner-list-panel client-health-panel">
          <div className="panel-heading">
            <div>
              <h2>Client overview</h2>
              <p>Quick visibility into each client's work and performance</p>
            </div>
            <Link href="/clients" className="panel-action">
              Manage clients <ArrowUpRight size={15} />
            </Link>
          </div>

          {clients.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Users size={24} /></div>
              <h3>No clients yet</h3>
              <p>Add your first client to begin organizing projects and campaigns.</p>
              <Link href="/clients" className="primary-link">Open client management</Link>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="campaign-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Status</th>
                    <th>Campaigns</th>
                    <th>Open tasks</th>
                    <th>Overdue</th>
                    <th>Pending approvals</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => {
                    const clientCampaigns = campaigns.filter(
                      (campaign) => campaign.client_id === client.id
                    ).length;
                    const clientOpenTasks = openTasks.filter(
                      (task) => task.client_id === client.id
                    );
                    const clientOverdue = overdueTasks.filter(
                      (task) => task.client_id === client.id
                    ).length;
                    const clientPendingApprovals = pendingApprovals.filter(
                      (approval) => approval.client_id === client.id
                    ).length;

                    return (
                      <tr key={client.id}>
                        <td><strong>{client.name}</strong></td>
                        <td>
                          <span className="campaign-status">
                            {prettyStatus(client.status ?? "unknown")}
                          </span>
                        </td>
                        <td>{clientCampaigns}</td>
                        <td>{clientOpenTasks.length}</td>
                        <td>
                          <span className={clientOverdue > 0 ? "owner-badge overdue" : "owner-badge completed"}>
                            {clientOverdue}
                          </span>
                        </td>
                        <td>{clientPendingApprovals}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel campaign-panel">
          <div className="panel-heading">
            <div>
              <h2>Campaign performance</h2>
              <p>Ranked by ad spend · last 30 days</p>
            </div>
            <span className="table-count">{campaigns.length} total</span>
          </div>

          {topCampaigns.length > 0 ? (
            <div className="table-scroll">
              <table className="campaign-table">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Platform</th>
                    <th>Status</th>
                    <th>Spend</th>
                    <th>Leads</th>
                    <th>CPL</th>
                    <th>Conversions</th>
                    <th>ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {topCampaigns.map((campaign) => {
                    const campaignCpl =
                      campaign.totals.leads > 0
                        ? campaign.totals.spend / campaign.totals.leads
                        : null;
                    const campaignRoas =
                      campaign.totals.spend > 0
                        ? campaign.totals.revenue / campaign.totals.spend
                        : null;

                    return (
                      <tr key={campaign.id}>
                        <td>
                          <strong>{campaign.name}</strong>
                          <span className="table-subtitle">
                            {clientNames.get(campaign.client_id) ?? "Client"}
                          </span>
                        </td>
                        <td>{platformName(campaign.platform)}</td>
                        <td>
                          <span className="campaign-status">
                            {prettyStatus(campaign.status)}
                          </span>
                        </td>
                        <td>{money(campaign.totals.spend, currency)}</td>
                        <td>{compactNumber(campaign.totals.leads)}</td>
                        <td>
                          {campaignCpl === null
                            ? "—"
                            : money(campaignCpl, currency)}
                        </td>
                        <td>{compactNumber(campaign.totals.conversions)}</td>
                        <td>
                          {campaignRoas === null
                            ? "—"
                            : `${campaignRoas.toFixed(2)}×`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon"><BarChart3 size={24} /></div>
              <h3>No campaigns to report yet</h3>
              <p>
                Campaigns and stored daily metrics will appear here when
                reporting data is available.
              </p>
            </div>
          )}
        </section>

        <footer className="dashboard-footer">
          <span>Growth OS · Agency command center</span>
          <span><span className="status-dot" /> Connected to your workspace</span>
        </footer>
      </section>
    </main>
  );
}
