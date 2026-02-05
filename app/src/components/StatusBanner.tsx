export default function StatusBanner() {
  const message = "";

  if (!message) return null;

  return (
    <div className="status-banner" role="status" aria-live="polite">
      {message}
    </div>
  );
}
