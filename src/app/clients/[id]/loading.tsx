export default function ClientRoomLoading() {
  return (
    <main className="clients-page" aria-live="polite" aria-busy="true">
      <div className="clients-shell">
        <div className="page-loading-card">
          <span className="page-loading-spinner" aria-hidden="true" />
          <h1>Opening client workspace…</h1>
          <p>Loading actions, requests, and updates. This usually takes a moment.</p>
        </div>
      </div>
    </main>
  );
}
