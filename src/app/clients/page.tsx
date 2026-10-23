
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  if (
    !name ||
    !/^[A-Z]{3}$/.test(currency) ||
    !STATUSES.includes(status as ClientStatus)
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

  const { error } = await supabase.from("clients").insert({
    agency_id: agencyId,
    name,
    slug: `${slug}-${crypto.randomUUID().slice(0, 8)}`,
    industry: industry || null,
    status,
    timezone,
    currency,
  });

  if (error) redirect("/clients?error=create");
  revalidatePath("/clients");
  redirect("/clients?created=1");
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
    "created=1": "Client created successfully.",
    "updated=1": "Client updated successfully.",
    "deleted=1": "Client deleted successfully.",
    "error=workspace": "Your agency membership could not be found.",
    "error=invalid": "Please check the information you entered.",
    "error=create": "Client could not be created. Check database permissions and unique constraints.",
    "error=update": "Client could not be updated. Check database permissions.",
    "error=delete": "Client could not be deleted. It may be linked to campaigns or invoices.",
  };

  const messageKey = Object.entries(messages).find(([key]) => {
    const [param, value] = key.split("=");
    return String(params[param] ?? "") === value;
  })?.[0];

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 28 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <p style={{ color: "#6b63ed", fontWeight: 700, letterSpacing: 1 }}>GROWTH OS / WORKSPACE</p>
          <h1 style={{ fontSize: 32, margin: "8px 0" }}>Client management</h1>
          <p style={{ color: "#64748b" }}>Manage your agency’s client accounts.</p>
        </div>
        <Link href="/" style={{ padding: "10px 16px", border: "1px solid #ddd", borderRadius: 10, textDecoration: "none" }}>
          ← Dashboard
        </Link>
      </header>

      {messageKey && (
        <p role="status" style={{ padding: 14, background: "#eef2ff", borderRadius: 10 }}>
          {messages[messageKey]}
        </p>
      )}

      {error && (
        <p role="alert" style={{ padding: 14, background: "#fff1f2", borderRadius: 10 }}>
          Could not load clients. Check the Supabase table permissions.
        </p>
      )}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, margin: "24px 0" }}>
        {[
          ["Total clients", clients.length],
          ["Active", clients.filter((c) => c.status === "active").length],
          ["Onboarding", clients.filter((c) => c.status === "onboarding").length],
          ["Paused", clients.filter((c) => c.status === "paused").length],
        ].map(([label, value]) => (
          <article key={label} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: 18 }}>
            <p style={{ color: "#64748b", margin: 0 }}>{label}</p>
            <strong style={{ fontSize: 28 }}>{value}</strong>
          </article>
        ))}
      </section>

      <section style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: 22, marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Add a client</h2>
        <form action={createClientAction} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
          <label>
            Client / company name *
            <input name="name" required maxLength={120} placeholder="e.g. Acme Industries" style={inputStyle} />
          </label>
          <label>
            Industry
            <input name="industry" maxLength={100} placeholder="e.g. Healthcare" style={inputStyle} />
          </label>
          <label>
            Status
            <select name="status" defaultValue="onboarding" style={inputStyle}>
              {STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select>
          </label>
          <label>
            Time zone
            <select name="timezone" defaultValue="Asia/Kolkata" style={inputStyle}>
              <option value="Asia/Kolkata">India (Asia/Kolkata)</option>
              <option value="UTC">UTC</option>
              <option value="Asia/Singapore">Singapore</option>
              <option value="Europe/London">London</option>
              <option value="America/New_York">New York</option>
            </select>
          </label>
          <label>
            Currency
            <select name="currency" defaultValue="INR" style={inputStyle}>
              <option value="INR">INR ₹</option>
              <option value="USD">USD $</option>
              <option value="GBP">GBP £</option>
              <option value="EUR">EUR €</option>
              <option value="SGD">SGD $</option>
            </select>
          </label>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button type="submit" style={primaryButton}>+ Add client</button>
          </div>
        </form>
      </section>

      <section style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0 }}>Your clients</h2>
            <p style={{ color: "#64748b" }}>{filtered.length} of {clients.length} clients</p>
          </div>
          <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input name="q" defaultValue={q} placeholder="Search name or industry" style={{ ...inputStyle, minWidth: 220 }} />
            <select name="status" defaultValue={statusFilter} style={inputStyle}>
              <option value="">All statuses</option>
              {STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select>
            <button type="submit" style={secondaryButton}>Search</button>
            <Link href="/clients" style={{ padding: "10px 14px", border: "1px solid #ddd", borderRadius: 9, textDecoration: "none" }}>Reset</Link>
          </form>
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 12px", color: "#64748b" }}>
            <h3>{clients.length === 0 ? "No clients yet" : "No matching clients"}</h3>
            <p>{clients.length === 0 ? "Add your first client using the form above." : "Try another search or status filter."}</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr>
                  {["Client", "Industry", "Status", "Time zone", "Currency", "Created", "Actions"].map((heading) => (
                    <th key={heading} style={tableHeader}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => (
                  <tr key={client.id}>
                    <td style={tableCell}>
                      <strong>{client.name}</strong>
                      <div style={{ color: "#94a3b8", fontSize: 12 }}>{client.slug}</div>
                    </td>
                    <td style={tableCell}>{client.industry || "—"}</td>
                    <td style={tableCell}>
                      <span style={{ display: "inline-block", borderRadius: 20, padding: "5px 9px", background: client.status === "active" ? "#dcfce7" : client.status === "paused" ? "#fef3c7" : client.status === "archived" ? "#f1f5f9" : "#e0e7ff" }}>
                        {statusLabel(client.status)}
                      </span>
                    </td>
                    <td style={tableCell}>{client.timezone}</td>
                    <td style={tableCell}>{client.currency}</td>
                    <td style={tableCell}>{new Date(client.created_at).toLocaleDateString("en-IN")}</td>
                    <td style={tableCell}>
                      <details>
                        <summary style={{ cursor: "pointer", color: "#4f46e5" }}>Edit / Delete</summary>
                        <form action={updateClientAction} style={{ display: "grid", gap: 8, minWidth: 210, padding: "12px 0" }}>
                          <input type="hidden" name="id" value={client.id} />
                          <input name="name" required defaultValue={client.name} maxLength={120} style={inputStyle} />
                          <input name="industry" defaultValue={client.industry ?? ""} placeholder="Industry" style={inputStyle} />
                          <select name="status" defaultValue={client.status} style={inputStyle}>
                            {STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                          </select>
                          <select name="timezone" defaultValue={client.timezone} style={inputStyle}>
                            <option value="Asia/Kolkata">India</option>
                            <option value="UTC">UTC</option>
                            <option value="Asia/Singapore">Singapore</option>
                            <option value="Europe/London">London</option>
                            <option value="America/New_York">New York</option>
                          </select>
                          <select name="currency" defaultValue={client.currency} style={inputStyle}>
                            <option value="INR">INR</option>
                            <option value="USD">USD</option>
                            <option value="GBP">GBP</option>
                            <option value="EUR">EUR</option>
                            <option value="SGD">SGD</option>
                          </select>
                          <button type="submit" style={primaryButton}>Save changes</button>
                        </form>
                        <form action={deleteClientAction}>
                          <input type="hidden" name="id" value={client.id} />
                          <button type="submit" style={dangerButton}>Delete client</button>
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
    </main>
  );
}

const inputStyle = {
  display: "block",
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "10px 12px",
  marginTop: 6,
  border: "1px solid #cbd5e1",
  borderRadius: 9,
  background: "white",
  color: "#0f172a",
};

const primaryButton = {
  padding: "11px 16px",
  background: "#5b55e7",
  color: "white",
  border: 0,
  borderRadius: 9,
  cursor: "pointer",
  fontWeight: 700,
};

const secondaryButton = {
  padding: "10px 14px",
  background: "white",
  color: "#334155",
  border: "1px solid #cbd5e1",
  borderRadius: 9,
  cursor: "pointer",
};

const dangerButton = {
  padding: "9px 12px",
  background: "#fff1f2",
  color: "#be123c",
  border: "1px solid #fecdd3",
  borderRadius: 9,
  cursor: "pointer",
};

const tableHeader = {
  padding: "12px 10px",
  borderBottom: "1px solid #e5e7eb",
  color: "#64748b",
  fontSize: 12,
  whiteSpace: "nowrap" as const,
};

const tableCell = {
  padding: "14px 10px",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "top" as const,
};
