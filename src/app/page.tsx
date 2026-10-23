
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  async function signOut() {
    "use server";

    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const cardStyle = {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "22px",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        color: "#111827",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          padding: "20px 5%",
          background: "white",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <div style={{ fontSize: "24px", fontWeight: 800 }}>
          growth<span style={{ color: "#635bff" }}>os</span>
        </div>

        <form action={signOut}>
          <button
            type="submit"
            style={{
              padding: "10px 16px",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              background: "white",
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </form>
      </header>

      <section style={{ padding: "40px 5%", maxWidth: "1200px", margin: "auto" }}>
        <p style={{ color: "#635bff", fontWeight: 700 }}>
          AGENCY COMMAND CENTER
        </p>

        <h1 style={{ fontSize: "32px", marginBottom: "8px" }}>
          Welcome to Growth OS
        </h1>

        <p style={{ color: "#6b7280", marginBottom: "32px" }}>
          You are signed in as {user.email}.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "18px",
          }}
        >
          <div style={cardStyle}>
            <p style={{ color: "#6b7280" }}>Workspace</p>
            <h2>Growth OS</h2>
            <p>Your workspace is ready to set up.</p>
          </div>

          <div style={cardStyle}>
            <p style={{ color: "#6b7280" }}>Clients</p>
            <h2>Get started</h2>
            <p>Connect your client records when client management is implemented.</p>
          </div>

          <div style={cardStyle}>
            <p style={{ color: "#6b7280" }}>Campaigns</p>
            <h2>Get started</h2>
            <p>Campaign integrations and live reporting still need to be connected.</p>
          </div>
        </div>

        <p style={{ color: "#6b7280", marginTop: "28px", fontSize: "14px" }}>
          This is the initial dashboard screen. Live metrics and client data
          have not yet been connected.
        </p>
      </section>
    </main>
  );
}
