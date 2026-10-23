
import {
  Activity,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  LogOut,
  Megaphone,
  MousePointerClick,
  Target,
  TrendingUp,
  Users,
  Wallet,
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

  const { data: memberships, error: membershipError } = await supabase
    .from("agency_members")
    .select("agency_id, role")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (membershipError) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-error">
          <h1>We couldn&apos;t load your workspace</h1>
          <p>
            Please check that the Growth OS database migration has been
            applied and your account has active agency membership.
          </p>
        </div>
      </main>
    );
  }

  const agencyId = memberships?.[0]?.agency_id;

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
            Your login works, but this account isn&apos;t linked to an active
            agency yet. Add an agency and an active agency_members record
            for this user to start seeing workspace data.
          </p>
          <div className="setup-card">
            <Users size={24} />
            <h2>Your workspace is not connected yet</h2>
            <p>
              Your dashboard will show real campaign metrics after your
              agency membership and campaign reporting data are configured.
            </p>
          </div>
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

  const since = new Date();
  since.setDate(since.getDate() - 29);
  const sinceDate = since.toISOString().slice(0, 10);

  const [
    { data: campaignData, error: campaignsError },
    { data: clientData },
    { data: metricData, error: metricsError },
  ] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, name, platform, status, client_id")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("clients")
      .select("id, name")
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
  ]);

  const campaigns = (campaignData ?? []) as CampaignRow[];
  const clients = (clientData ?? []) as ClientRow[];
  const metrics = (metricData ?? []) as MetricRow[];

  const clientNames = new Map(clients.map((client) => [client.id, client.name]));


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
    const spend = dayMetrics.reduce(
      (sum, row) => sum + numberValue(row.spend),
      0
    );
    const revenue = dayMetrics.reduce(
      (sum, row) => sum + numberValue(row.attributed_revenue),
      0
    );

    return {
      date,
      label: day.toLocaleDateString("en-IN", { weekday: "short" }),
      spend,
      revenue,
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
      detail: "Selected currency · 30 days",
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
      detail: "Attributed revenue ÷ spend",
      icon: TrendingUp,
      tone: "purple",
    },
    {
      title: "Conversions",
      value: compactNumber(totals.conversions),
      detail: "Reported campaign conversions",
      icon: MousePointerClick,
      tone: "green",
    },
  ];

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
        <div className="sidebar-link muted">
          <Users size={18} /> Clients
          <span className="coming-soon">Next</span>
        </div>
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
            <p className="dashboard-eyebrow">AGENCY OVERVIEW</p>
            <h1>Good to see you</h1>
            <p className="dashboard-subtitle">
              Here’s how your marketing performance is looking.
            </p>
          </div>
          <div className="date-pill">
            <CalendarDays size={16} />
            Last 30 days
          </div>
        </header>

        {(campaignsError || metricsError) && (
          <div className="dashboard-warning">
            Some reporting data could not be loaded. Check the Supabase
            table permissions and migration status.
          </div>
        )}

        <div className="workspace-line">
          <span className="status-dot" />
          {agency?.name ?? "Your agency"} <span>·</span> {currency} reporting
        </div>

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

            <div className="bar-chart" aria-label="Daily spend and revenue chart">
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
                No reporting records for this period yet. Add campaign metrics
                to populate the chart.
              </p>
            )}
          </article>

          <article className="panel summary-panel">
            <div className="panel-heading">
              <div>
                <h2>Campaign snapshot</h2>
                <p>Your current workspace</p>
              </div>
              <Megaphone size={19} />
            </div>
            <div className="summary-stat">
              <span>Campaigns</span>
              <strong>{campaigns.length}</strong>
            </div>
            <div className="summary-stat">
              <span>Clients</span>
              <strong>{clients.length}</strong>
            </div>
            <div className="summary-stat">
              <span>Impressions</span>
              <strong>{compactNumber(totals.impressions)}</strong>
            </div>
            <div className="summary-stat">
              <span>Click-through rate</span>
              <strong>
                {totals.impressions > 0
                  ? `${((totals.clicks / totals.impressions) * 100).toFixed(2)}%`
                  : "—"}
              </strong>
            </div>
            <div className="summary-footnote">
              <span className="status-dot" />
              Metrics based on stored campaign reports
            </div>
          </article>
        </section>

        <section className="panel campaign-panel">
          <div className="panel-heading">
            <div>
              <h2>Campaign performance</h2>
              <p>Ranked by ad spend · last 30 days</p>
            </div>
            <span className="table-count">
              {campaigns.length} total
            </span>
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
                    const cpl =
                      campaign.totals.leads > 0
                        ? campaign.totals.spend / campaign.totals.leads
                        : null;
                    const roas =
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
                            {campaign.status.replaceAll("_", " ")}
                          </span>
                        </td>
                        <td>{money(campaign.totals.spend, currency)}</td>
                        <td>{compactNumber(campaign.totals.leads)}</td>
                        <td>
                          {cpl === null ? "—" : money(cpl, currency)}
                        </td>
                        <td>{compactNumber(campaign.totals.conversions)}</td>
                        <td>{roas === null ? "—" : `${roas.toFixed(2)}×`}</td>
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
                Create a campaign and add daily performance metrics in
                Supabase. Your campaign table and KPIs will populate
                automatically from those records.
              </p>
            </div>
          )}
        </section>

        <footer className="dashboard-footer">
          <span>Growth OS · Agency command center</span>
          <span>
            <span className="status-dot" /> Connected to your workspace
          </span>
        </footer>
      </section>
    </main>
  );
}
