export function PageHeader({ title, description, action }) {
  return <div className="page-header"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div>{action}</div>}</div>;
}

export function Card({ children, className = "" }) { return <section className={`card ${className}`}>{children}</section>; }

export function StatCard({ label, value, helper, icon }) {
  return <div className="stat-card"><div className="stat-icon">{icon}</div><div><span>{label}</span><strong>{value ?? "—"}</strong>{helper && <small>{helper}</small>}</div></div>;
}

export function Badge({ value }) {
  const key = String(value || "").toLowerCase().replace(/\s+/g, "-");
  return <span className={`badge badge-${key}`}>{String(value || "Unknown").replace(/-/g, " ")}</span>;
}

export function Modal({ open, title, onClose, children, wide = false }) {
  if (!open) return null;
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className={`modal ${wide ? "modal-wide" : ""}`}><div className="modal-head"><div><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close">×</button></div>{children}</div></div>;
}

export function EmptyState({ title = "Nothing here yet", description = "Records will appear here when available." }) {
  return <div className="empty-state"><div className="empty-mark">◇</div><h3>{title}</h3><p>{description}</p></div>;
}

export function Alert({ type = "info", children }) { return children ? <div className={`alert alert-${type}`}>{children}</div> : null; }

export function FormField({ label, required, children, hint }) {
  return <label className="field"><span>{label}{required && <b>*</b>}</span>{children}{hint && <small>{hint}</small>}</label>;
}
