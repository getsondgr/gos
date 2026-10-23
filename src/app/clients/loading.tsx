export default function ClientsLoading() {
  return (
    <main className="clients-page" aria-live="polite" aria-busy="true">
      <div className="clients-shell">
        <div className="page-loading-card">
          <span className="page-loading-spinner" aria-hidden="true" />
          <h1>Loading your clients…</h1>
          <p>Getting your client workspaces ready.</p>
        </div>
      </div>
    </main>
  );
}
