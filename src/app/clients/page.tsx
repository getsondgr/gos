
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import SubmitButton from "@/components/submit-button";

const STATUSES = ["onboarding", "active", "paused", "archived"] as const;

type ClientStatus = (typeof STATUSES)[number];

type ClientRow = {
  id: string;
  agency_id: string;
  name: string;
  slug: string;
  industry: string | null;
  status: ClientStatus;
  timezone: string;
  currency: string;
  created_at: string;
};

const statusLabel = (status: ClientStatus) =>
  status.charAt(0).toUpperCase() + status.slice(1);

async function getAgencyId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data, error } = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.agency_id;
}

async function createClientAction(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const agencyId = await getAgencyId(supabase, user.id);
  if (!agencyId) redirect("/clients?error=workspace");

  const name = String(formData.get("name") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim();
  const status = String(formData.get("status") ?? "onboarding");
  const timezone = String(formData.get("timezone") ?? "Asia/Kolkata");
  const currency = String(formData.get("currency") ?? "INR").toUpperCase();
  const startDate = String(formData.get("start_date") ?? new Date().toISOString().slice(0, 10));
  const launchDate = String(formData.get("launch_date") ?? "");
  const services = formData.getAll("services").map(String).filter((service) =>
    ["social_media", "content_approvals", "campaign_management"].includes(service)
  );

  if (
    !name ||
    !/^[A-Z]{3}$/.test(currency) ||
    !STATUSES.includes(status as ClientStatus) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    (launchDate && !/^\d{4}-\d{2}-\d{2}$/.test(launchDate))
  ) {
    redirect("/clients?error=invalid");
  }

  const slug =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70) || `client-${Date.now()}`;

  const { data: createdClient, error } = await supabase.from("clients").insert({
    agency_id: agencyId,
    name,
    slug: `${slug}-${crypto.randomUUID().slice(0, 8)}`,
    industry: industry || null,
    status,
    timezone,
    currency,
  }).select("id").single();

  if (error || !createdClient) redirect("/clients?error=create");

  const addDays = (date: string, offset: number) => {
    const d = new Date(`${date}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const dueAt = (date: string) => new Date(`${date}T23:59:00.000Z`).toISOString();
  const plan: { title: string; description: string; due: string; priority?: string }[] = [];
  if (services.includes("social_media")) {
    plan.push(
      { title: "Collect brand assets and social account access", description: "Confirm logo, brand guidelines, account access, target audience and business goals.", due: startDate },
      { title: "Confirm social media strategy and content pillars", description: "Depends on onboarding details and brand assets.", due: addDays(startDate, 1) },
      { title: "Plan the first content calendar", description: "Set post dates, formats, themes, captions and publishing owners.", due: addDays(startDate, 2) },
      { title: "Schedule approved social content", description: "Only schedule content that has completed client approval.", due: addDays(startDate, 4) },
      { title: "Weekly social content and account check", description: "Review upcoming posts, publishing status and missing assets.", due: addDays(startDate, 7) }
    );
  }
  if (services.includes("content_approvals")) {
    plan.push(
      { title: "Prepare first batch of content creatives", description: "Create the initial images/videos and captions from the approved brief.", due: addDays(startDate, 2) },
      { title: "Submit content batch for client approval", description: "Share each creative and caption for approval in the client workspace.", due: addDays(startDate, 3) },
      { title: "Apply client feedback and prepare final versions", description: "Keep the original version and record all requested changes.", due: addDays(startDate, 4) }
    );
  }
  if (services.includes("campaign_management")) {
    const launch = launchDate || addDays(startDate, 7);
    plan.push(
      { title: "Confirm campaign objective, offer, budget and audience", description: "Campaign foundation. Confirm all inputs with the client.", due: startDate },
      { title: "Prepare campaign angles, ad copy and creatives", description: "Requires approved campaign brief and offer.", due: addDays(launch, -5) },
      { title: "Configure campaign and conversion tracking", description: "Set campaign structure, landing page, conversion events and lead routing.", due: addDays(launch, -4) },
      { title: "Submit campaign creatives for client approval", description: "Campaign must not launch until required creative approvals are recorded.", due: addDays(launch, -3) },
      { title: "Test landing page, forms, tracking and lead routing", description: "Verify the full conversion journey before launch.", due: addDays(launch, -3) },
      { title: "Complete launch readiness checklist", description: "Confirm approvals, budget, targeting, links, tracking and assigned launch owner.", due: addDays(launch, -1), priority: "urgent" },
      { title: "Launch campaign and verify delivery", description: "Launch only after all required approvals and technical checks are complete.", due: launch, priority: "urgent" },
      { title: "First campaign delivery check", description: "Confirm spend, impressions, clicks, conversion tracking and lead flow.", due: addDays(launch, 1) },
      { title: "Initial campaign performance review", description: "Review early delivery and identify any issues requiring action.", due: addDays(launch, 3) }
    );
  }

  if (plan.length) {
    const { error: taskError } = await supabase.from("tasks").insert(plan.map((task) => ({
      agency_id: agencyId,
      client_id: createdClient.id,
      title: task.title,
      description: task.description,
      status: "todo",
      priority: task.priority ?? "normal",
      due_at: dueAt(task.due),
      visibility: "client_visible",
      created_by: user.id
    })));
    if (taskError) redirect("/clients?error=plan");
  }

  revalidatePath("/");
  revalidatePath("/clients");
  redirect(`/clients?created=1&tasks=${plan.length}`);
}

async function updateClientAction(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const agencyId = await getAgencyId(supabase, user.id);
  if (!agencyId) redirect("/clients?error=workspace");

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim();
  const status = String(formData.get("status") ?? "");
  const timezone = String(formData.get("timezone") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").toUpperCase();

  if (
    !id ||
    !name ||
    !timezone ||
    !/^[A-Z]{3}$/.test(currency) ||
    !STATUSES.includes(status as ClientStatus)
  ) {
    redirect("/clients?error=invalid");
  }

  const { error } = await supabase
    .from("clients")
    .update({ name, industry: industry || null, status, timezone, currency })
    .eq("id", id)
    .eq("agency_id", agencyId);

  if (error) redirect("/clients?error=update");
  revalidatePath("/clients");
  redirect("/clients?updated=1");
}

async function deleteClientAction(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const agencyId = await getAgencyId(supabase, user.id);
  if (!agencyId) redirect("/clients?error=workspace");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/clients?error=invalid");

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .eq("agency_id", agencyId);

  if (error) redirect("/clients?error=delete");
  revalidatePath("/clients");
  redirect("/clients?deleted=1");
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const agencyId = await getAgencyId(supabase, user.id);

  if (!agencyId) {
    return (
      <main style={{ padding: 32 }}>
        <h1>Clients</h1>
        <p>Your account is not connected to an active agency.</p>
        <Link href="/">Back to dashboard</Link>
      </main>
    );
  }

  const { data, error } = await supabase
    .from("clients")
    .select("id, agency_id, name, slug, industry, status, timezone, currency, created_at")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });

  const clients = (data ?? []) as ClientRow[];
  const q = String(params.q ?? "").trim().toLowerCase();
  const statusFilter = String(params.status ?? "");
  const filtered = clients.filter((client) => {
    const matchesSearch =
      !q ||
      client.name.toLowerCase().includes(q) ||
      (client.industry ?? "").toLowerCase().includes(q);
    const matchesStatus =
      !statusFilter || client.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const messages: Record<string, string> = {
    "created=1": `Client created and onboarding plan generated (${String(params.tasks ?? "0")} tasks). `,
    "updated=1": "Client updated successfully.",
    "deleted=1": "Client deleted successfully.",
    "error=workspace": "Your agency membership could not be found.",
    "error=invalid": "Please check the information you entered.",
    "error=create": "Client could not be created. Check database permissions and unique constraints.",
    "error=plan": "Client was created, but the service plan could not be generated. Open the client and check task permissions.",
    "error=update": "Client could not be updated. Check database permissions.",
    "error=delete": "Client could not be deleted. It may be linked to campaigns or invoices.",
  };

  const messageKey = Object.entries(messages).find(([key]) => {
    const [param, value] = key.split("=");
    return String(params[param] ?? "") === value;
  })?.[0];

  return (
    <main className="clients-page">
      <div className="clients-shell">
        <header className="clients-header">
          <div>
            <p className="clients-breadcrumb">GROWTH OS / WORKSPACE</p>
            <h1>Clients</h1>
            <p>Keep every client relationship, update, and next action in one place.</p>
          </div>
          <Link href="/" className="clients-button clients-secondary">← Dashboard</Link>
        </header>

        {messageKey && (
          <p role="status" className="clients-message">{messages[messageKey]}</p>
        )}
        {error && (
          <p role="alert" className="clients-message clients-error">
            Could not load clients. Check the Supabase table permissions.
          </p>
        )}

        <section className="clients-stats" aria-label="Client summary">
          {[
            { label: "Total clients", value: clients.length },
            { label: "Active", value: clients.filter((c) => c.status === "active").length },
            { label: "Onboarding", value: clients.filter((c) => c.status === "onboarding").length },
            { label: "Paused", value: clients.filter((c) => c.status === "paused").length },
          ].map((stat) => (
            <article className="clients-stat" key={stat.label}>
              <p className="clients-stat-label">{stat.label}</p>
              <strong className="clients-stat-value">{stat.value}</strong>
            </article>
          ))}
        </section>

        <section className="clients-panel">
          <h2>Add a client</h2>
          <p className="clients-panel-subtitle">Create a shared workspace for a new client. You can update these details later.</p>
          <form action={createClientAction} className="clients-form-grid">
            <label>
              Client / company name *
              <input name="name" required maxLength={120} placeholder="e.g. Acme Industries" />
            </label>
            <label>
              Industry
              <input name="industry" maxLength={100} placeholder="e.g. Healthcare" />
            </label>
            <label>
              Status
              <select name="status" defaultValue="onboarding">
                {STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
              </select>
            </label>
            <label>
              Time zone
              <select name="timezone" defaultValue="Asia/Kolkata">
                <option value="Asia/Kolkata">India (Asia/Kolkata)</option>
                <option value="UTC">UTC</option>
                <option value="Asia/Singapore">Singapore</option>
                <option value="Europe/London">London</option>
                <option value="America/New_York">New York</option>
              </select>
            </label>
            <label>
              Service start date
              <input name="start_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            </label>
            <label>
              Planned campaign launch (optional)
              <input name="launch_date" type="date" />
            </label>
            <fieldset className="service-template-picker">
              <legend>Services & auto-generated work plan</legend>
              <label><input type="checkbox" name="services" value="social_media" defaultChecked /> Social media management</label>
              <label><input type="checkbox" name="services" value="content_approvals" defaultChecked /> Content calendar & creative approvals</label>
              <label><input type="checkbox" name="services" value="campaign_management" /> Campaign management</label>
              <p>Selected services automatically create onboarding tasks, creative approval tasks and campaign launch checks with due dates.</p>
            </fieldset>
            <label>
              Currency
              <select name="currency" defaultValue="INR">
                <option value="INR">INR ₹</option>
                <option value="USD">USD $</option>
                <option value="GBP">GBP £</option>
                <option value="EUR">EUR €</option>
                <option value="SGD">SGD $</option>
              </select>
            </label>
            <div><SubmitButton className="clients-primary" pendingText="Adding client…">+ Add client</SubmitButton></div>
          </form>
        </section>

        <section className="clients-panel">
          <div className="clients-list-heading">
            <div>
              <h2>Your clients</h2>
              <p className="clients-panel-subtitle">{filtered.length} of {clients.length} clients</p>
            </div>
            <form method="get" className="clients-filters">
              <input name="q" defaultValue={q} placeholder="Search name or industry" aria-label="Search name or industry" />
              <select name="status" defaultValue={statusFilter} aria-label="Filter by status">
                <option value="">All statuses</option>
                {STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
              </select>
              <button type="submit" className="clients-secondary">Search</button>
              <Link href="/clients" className="clients-button clients-secondary">Reset</Link>
            </form>
          </div>

          {filtered.length === 0 ? (
            <div className="clients-empty">
              <strong>{clients.length === 0 ? "Your first client starts here" : "No matching clients"}</strong>
              <p>{clients.length === 0 ? "Add a client above to create your first workspace." : "Try another search term or status filter."}</p>
            </div>
          ) : (
            <div className="clients-table-wrap">
              <table className="clients-table">
                <thead>
                  <tr>
                    {["Client", "Industry", "Status", "Time zone", "Currency", "Created", "Actions"].map((heading) => (
                      <th key={heading}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((client) => (
                    <tr key={client.id}>
                      <td>
                        <Link href={`/clients/${client.id}`} className="clients-name">{client.name} ↗</Link>
                        <span className="clients-slug">{client.slug}</span>
                      </td>
                      <td>{client.industry || "—"}</td>
                      <td><span className={`clients-status ${client.status}`}>{statusLabel(client.status)}</span></td>
                      <td>{client.timezone}</td>
                      <td>{client.currency}</td>
                      <td>{new Date(client.created_at).toLocaleDateString("en-IN")}</td>
                      <td>
                        <details className="clients-actions">
                          <summary>Edit / Delete</summary>
                          <form action={updateClientAction}>
                            <input type="hidden" name="id" value={client.id} />
                            <input name="name" required defaultValue={client.name} maxLength={120} aria-label={`Name for ${client.name}`} />
                            <input name="industry" defaultValue={client.industry ?? ""} placeholder="Industry" aria-label="Industry" />
                            <select name="status" defaultValue={client.status} aria-label="Status">
                              {STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                            </select>
                            <select name="timezone" defaultValue={client.timezone} aria-label="Time zone">
                              <option value="Asia/Kolkata">India</option>
                              <option value="UTC">UTC</option>
                              <option value="Asia/Singapore">Singapore</option>
                              <option value="Europe/London">London</option>
                              <option value="America/New_York">New York</option>
                            </select>
                            <select name="currency" defaultValue={client.currency} aria-label="Currency">
                              <option value="INR">INR</option>
                              <option value="USD">USD</option>
                              <option value="GBP">GBP</option>
                              <option value="EUR">EUR</option>
                              <option value="SGD">SGD</option>
                            </select>
                            <SubmitButton className="clients-primary" pendingText="Saving changes…">Save changes</SubmitButton>
                          </form>
                          <form action={deleteClientAction}>
                            <input type="hidden" name="id" value={client.id} />
                            <SubmitButton className="clients-danger" pendingText="Deleting client…">Delete client</SubmitButton>
                          </form>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
