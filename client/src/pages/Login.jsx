import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Alert } from "../Components/UI";
import { getError } from "../utils/format";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e) => {
    e.preventDefault(); setError(""); setSubmitting(true);
    try { const { data } = await api.post("/auth/login", form); login(data); navigate("/dashboard"); }
    catch (err) { setError(getError(err, "Unable to sign in.")); }
    finally { setSubmitting(false); }
  };

  return <div className="auth-page"><div className="auth-panel auth-brand-panel"><div className="auth-brand"><div className="brand-mark large">H</div><span>People Workspace</span></div><div className="auth-copy"><span className="eyebrow">Modern HR operations</span><h1>Everything your people team needs, in one calm workspace.</h1><p>Manage employees, attendance, leave, departments and access without making everyday HR complicated.</p><div className="auth-points"><span>✓ Role-based access</span><span>✓ Employee self-service</span><span>✓ Manager & HOD workflows</span></div></div></div><div className="auth-panel auth-form-panel"><form className="auth-form" onSubmit={submit}><div className="mobile-brand"><div className="brand-mark">H</div><strong>HRMS</strong></div><span className="eyebrow">Welcome back</span><h2>Sign in to your workspace</h2><p className="muted">Use the email address linked with your company account.</p><Alert type="error">{error}</Alert><label className="field"><span>Email address</span><input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@company.com" /></label><label className="field"><span>Password</span><input type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Enter your password" /></label><button className="button primary full" disabled={submitting}>{submitting ? "Signing in..." : "Sign in"}</button><p className="auth-switch">New company? <Link to="/register">Create a workspace</Link></p></form></div></div>;
}
