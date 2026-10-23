import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, BriefcaseBusiness, CheckCheck,
  ChevronDown, CircleHelp, ClipboardList, CreditCard, FileCheck2, FolderKanban,
  LayoutDashboard, MessageSquareText, MoreHorizontal, Plus, Search, Settings2,
  ShieldCheck, Users, Wallet, Zap, Clock3, CircleAlert, ExternalLink
} from "lucide-react";

const tasks = [
  { title: "Approve November ad creatives", client: "Northstar Nutrition", status: "Needs client", tone: "amber", due: "Today" },
  { title: "Review lead quality report", client: "Elevate Dance Studio", status: "In progress", tone: "blue", due: "Today" },
  { title: "Launch retargeting campaign", client: "Blush Bridal", status: "Ready", tone: "green", due: "Oct 25" },
  { title: "Upload monthly performance report", client: "Northstar Nutrition", status: "In progress", tone: "blue", due: "Oct 26" },
];

const clients = [
  { name: "Northstar Nutrition", type: "Lead generation", initials: "NN", color: "lavender", status: "Active", leads: "284", cpl: "₹142" },
  { name: "Elevate Dance Studio", type: "Local acquisition", initials: "ED", color: "mint", status: "Active", leads: "176", cpl: "₹96" },
  { name: "Blush Bridal", type: "Lead generation", initials: "BB", color: "peach", status: "Needs attention", leads: "93", cpl: "₹218" },
];

function MetricCard({ label, value, delta, icon: Icon, note }: { label: string; value: string; delta: string; icon: typeof Users; note: string }) {
  return (
    <div className="metric-card">
      <div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={17} /></span></div>
      <div className="metric-value">{value}</div>
      <div className="metric-foot"><span className="delta"><ArrowUpRight size={14} /> {delta}</span><span>{note}</span></div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Activity size={21} strokeWidth={2.5} /></div>
          <div><strong>growth<span>os</span></strong><small>AGENCY WORKSPACE</small></div>
        </div>
        <div className="workspace-switch">
          <div className="workspace-avatar">G</div>
          <div className="workspace-name"><strong>Growth Studio</strong><small>Agency workspace</small></div>
          <ChevronDown size={16} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="nav-list">
          <a className="nav-item active" href="#"><LayoutDashboard size={18} /> Overview</a>
          <a className="nav-item" href="#clients"><Users size={18} /> Clients <span className="nav-count">12</span></a>
          <a className="nav-item" href="#tasks"><ClipboardList size={18} /> Tasks</a>
          <a className="nav-item" href="#requests"><MessageSquareText size={18} /> Requests <span className="nav-dot" /></a>
          <a className="nav-item" href="#approvals"><FileCheck2 size={18} /> Approvals <span className="nav-count warning">8</span></a>
          <a className="nav-item" href="#reports"><FolderKanban size={18} /> Reports</a>
        </nav>
        <div className="nav-label section-label">MANAGE</div>
        <nav className="nav-list">
          <a className="nav-item" href="#finance"><Wallet size={18} /> Finance</a>
          <a className="nav-item" href="#team"><BriefcaseBusiness size={18} /> Team</a>
          <a className="nav-item" href="#integrations"><Zap size={18} /> Integrations</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-icon"><CircleHelp size={17} /></div><strong>Need a hand?</strong><p>Explore the getting started guide.</p><a href="#getting-started">View guide <ExternalLink size={12} /></a></div>
          <a className="nav-item" href="#settings"><Settings2 size={18} /> Settings</a>
          <div className="profile-row"><div className="profile-avatar">GL</div><div className="profile-info"><strong>Agency Owner</strong><small>owner@growthos.demo</small></div><MoreHorizontal size={18} /></div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">Workspace <span>/</span> <strong>Overview</strong></div>
          <div className="top-actions"><div className="searchbox"><Search size={16} /><span>Search anything...</span><kbd>⌘ K</kbd></div><button className="icon-button" aria-label="Notifications"><Bell size={18} /><i /></button><div className="top-avatar">GL</div></div>
        </header>

        <div className="content">
          <div className="demo-banner"><span className="demo-dot" /><strong>Preview mode</strong><span>Sample data is shown. Connect a database to enable real client workspaces.</span><a href="#getting-started">Setup guide <ExternalLink size={12} /></a></div>
          <div className="page-heading">
            <div><div className="eyebrow">FRIDAY, OCTOBER 23, 2026</div><h1>Good morning, team <span>✦</span></h1><p>Here’s what’s happening across your agency today.</p></div>
            <button className="primary-button"><Plus size={17} /> New client</button>
          </div>

          <div className="section-heading"><div><h2>Agency overview</h2><p>A snapshot of your operations</p></div><button className="period-button">Last 30 days <ChevronDown size={15} /></button></div>
          <div className="metrics-grid">
            <MetricCard label="Active clients" value="12" delta="+2" icon={Users} note="vs. last month" />
            <MetricCard label="Ad spend tracked" value="₹4.82L" delta="+12.8%" icon={Activity} note="sample data" />
            <MetricCard label="Leads generated" value="3,248" delta="+8.4%" icon={ArrowUpRight} note="sample data" />
            <MetricCard label="Open deliverables" value="24" delta="6 due soon" icon={ClipboardList} note="needs attention" />
          </div>

          <div className="dashboard-grid">
            <section className="panel performance-panel" id="reports">
              <div className="panel-heading"><div><h3>Performance overview</h3><p>Illustrative spend and lead trend</p></div><button className="icon-button subtle"><MoreHorizontal size={18} /></button></div>
              <div className="chart-legend"><span><i className="legend-spend" /> Ad spend</span><span><i className="legend-leads" /> Leads</span><span className="chart-period">Oct 1 – Oct 30</span></div>
              <div className="chart-wrap">
                <div className="y-labels"><span>₹60k</span><span>₹40k</span><span>₹20k</span><span>₹0</span></div>
                <svg className="chart" viewBox="0 0 620 205" role="img" aria-label="Illustrative line chart of advertising spend and leads">
                  <defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#6178ee" stopOpacity=".18"/><stop offset="100%" stopColor="#6178ee" stopOpacity="0"/></linearGradient></defs>
                  {[20,70,120,170].map(y=><line key={y} x1="0" y1={y} x2="620" y2={y} stroke="#edf0f5" strokeDasharray="4 5" />)}
                  <path d="M0 145 C35 135 42 104 78 116 S126 145 156 100 S207 85 235 110 S281 60 312 79 S360 118 390 72 S435 88 468 50 S515 72 546 43 S590 55 620 24 L620 180 L0 180 Z" fill="url(#areaFill)" />
                  <path d="M0 145 C35 135 42 104 78 116 S126 145 156 100 S207 85 235 110 S281 60 312 79 S360 118 390 72 S435 88 468 50 S515 72 546 43 S590 55 620 24" fill="none" stroke="#6178ee" strokeWidth="3" strokeLinecap="round"/>
                  <path d="M0 160 C42 154 48 145 78 150 S128 130 156 140 S207 118 235 132 S283 105 312 118 S362 130 390 108 S438 114 468 94 S517 106 546 85 S590 92 620 70" fill="none" stroke="#22a879" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="5 4"/>
                  {[0,78,156,235,312,390,468,546,620].map((x,i)=><text key={x} x={x} y="200" fill="#8a93a5" fontSize="10" textAnchor={i===0?"start":i===8?"end":"middle"}>{["Oct 1","Oct 4","Oct 8","Oct 12","Oct 16","Oct 20","Oct 24","Oct 27","Oct 30"][i]}</text>)}
                </svg>
              </div>
              <div className="chart-foot"><span><span className="foot-dot purple" /> Spend shown in INR</span><span><span className="foot-dot green" /> Leads shown as trend only</span></div>
            </section>

            <section className="panel action-panel">
              <div className="panel-heading"><div><h3>Needs your attention</h3><p>Keep work moving forward</p></div><span className="count-pill">5</span></div>
              <div className="action-item"><div className="action-symbol amber"><FileCheck2 size={17} /></div><div className="action-copy"><strong>Creative approvals</strong><span>8 assets waiting for review</span></div><span className="action-arrow">›</span></div>
              <div className="action-item"><div className="action-symbol blue"><MessageSquareText size={17} /></div><div className="action-copy"><strong>Open client requests</strong><span>3 tickets need assignment</span></div><span className="action-arrow">›</span></div>
              <div className="action-item"><div className="action-symbol red"><CreditCard size={17} /></div><div className="action-copy"><strong>Overdue invoices</strong><span>2 invoices need follow-up</span></div><span className="action-arrow">›</span></div>
              <div className="action-item"><div className="action-symbol green"><CheckCheck size={17} /></div><div className="action-copy"><strong>Tasks due today</strong><span>4 deliverables due today</span></div><span className="action-arrow">›</span></div>
              <a className="text-link" href="#tasks">View all action items <ArrowUpRight size={14} /></a>
            </section>
          </div>

          <section className="panel clients-panel" id="clients">
            <div className="panel-heading"><div><h3>Client portfolio</h3><p>Recent client activity and performance snapshot</p></div><a className="text-link" href="#clients">View all clients <ArrowUpRight size={14} /></a></div>
            <div className="table-scroll"><table><thead><tr><th>CLIENT</th><th>STATUS</th><th>LEADS <span className="info-dot">i</span></th><th>AVG. CPL</th><th>HEALTH</th><th /></tr></thead><tbody>
              {clients.map(c=><tr key={c.name}><td><div className="client-cell"><div className={`client-avatar ${c.color}`}>{c.initials}</div><div><strong>{c.name}</strong><span>{c.type}</span></div></div></td><td><span className={`status ${c.status==="Active"?"active-status":"attention-status"}`}><i />{c.status}</span></td><td className="number-cell">{c.leads}</td><td className="number-cell">{c.cpl}</td><td><div className="health-track"><div style={{width:c.name==="Blush Bridal"?"48%":c.name==="Elevate Dance Studio"?"91%":"78%"}} className={c.name==="Blush Bridal"?"health-low":"health-high"} /></div></td><td><button className="icon-button subtle" aria-label={`More options for ${c.name}`}><MoreHorizontal size={18} /></button></td></tr>)}
            </tbody></table></div>
            <div className="table-foot"><span>Showing 3 of 12 clients · Sample data</span><div><button className="page-button" disabled>Previous</button><button className="page-button">Next <ArrowUpRight size={12}/></button></div></div>
          </section>

          <section className="panel tasks-panel" id="tasks">
            <div className="panel-heading"><div><h3>Tasks & deliverables</h3><p>What your team is working on</p></div><button className="outline-button"><Plus size={15} /> Add task</button></div>
            <div className="task-list">{tasks.map(t=><div className="task-row" key={t.title}><div className="task-check"><span /></div><div className="task-title"><strong>{t.title}</strong><span>{t.client}</span></div><span className={`task-status ${t.tone}`}>{t.status}</span><span className="task-due"><Clock3 size={13} /> {t.due}</span><button className="icon-button subtle" aria-label={`More options for ${t.title}`}><MoreHorizontal size={17} /></button></div>)}</div>
            <div className="tasks-foot"><a href="#tasks" className="text-link">View all tasks <ArrowUpRight size={14} /></a></div>
          </section>

          <footer className="footer"><span>Growth OS <span className="footer-muted">· Agency operations, in one place.</span></span><span><ShieldCheck size={14} /> Secure workspace concept <span className="footer-muted">· Demo build</span></span></footer>
        </div>
      </section>
    </main>
  );
}
