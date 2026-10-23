export default function AppLoading() {
  return (
    <main className="clients-page" aria-live="polite" aria-busy="true">
      <div className="clients-shell">
        <div className="page-loading-card">
          <span className="page-loading-spinner" aria-hidden="true" />
          <h1>Loading Growth OS…</h1>
          <p>Getting your workspace ready.</p>
        </div>
      </div>
    </main>
  );
}
