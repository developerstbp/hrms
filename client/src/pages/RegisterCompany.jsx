import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Alert } from "../Components/UI";
import { getError } from "../utils/format";

export default function RegisterCompany() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ companyName: "", companyEmail: "", phone: "", firstName: "", lastName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (user) return <Navigate to="/dashboard" replace />;
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setError(""); setSubmitting(true);
    try { const { data } = await api.post("/auth/register-company", form); login(data); navigate("/dashboard"); }
    catch (err) { setError(getError(err, "Unable to create workspace.")); }
    finally { setSubmitting(false); }
  };
  return <div className="auth-page"><div className="auth-panel auth-brand-panel"><div className="auth-brand"><div className="brand-mark large">H</div><span>People Workspace</span></div><div className="auth-copy"><span className="eyebrow">Start from one account</span><h1>Set up your company and grow the HRMS around your team.</h1><p>Your first account becomes the Company Admin. Departments, employees, HR roles and policies can be configured after setup.</p><div className="auth-points"><span>✓ Email-based account access</span><span>✓ Admin-controlled permissions</span><span>✓ Ready for future email notifications</span></div></div></div><div className="auth-panel auth-form-panel"><form className="auth-form wide-form" onSubmit={submit}><div><span className="eyebrow">Company setup</span><h2>Create your HR workspace</h2><p className="muted">You can update company settings later.</p></div><Alert type="error">{error}</Alert><div className="form-grid two"><label className="field"><span>Company name *</span><input name="companyName" required value={form.companyName} onChange={change} placeholder="Company name" /></label><label className="field"><span>Company email *</span><input name="companyEmail" type="email" required value={form.companyEmail} onChange={change} placeholder="hr@company.com" /></label><label className="field"><span>Company phone</span><input name="phone" value={form.phone} onChange={change} placeholder="Optional" /></label><div /></div><div className="section-label">Administrator account</div><div className="form-grid two"><label className="field"><span>First name *</span><input name="firstName" required value={form.firstName} onChange={change} /></label><label className="field"><span>Last name</span><input name="lastName" value={form.lastName} onChange={change} /></label><label className="field"><span>Admin email *</span><input name="email" type="email" required value={form.email} onChange={change} placeholder="you@company.com" /></label><label className="field"><span>Password *</span><input name="password" type="password" minLength="8" required value={form.password} onChange={change} placeholder="Minimum 8 characters" /></label></div><button className="button primary full" disabled={submitting}>{submitting ? "Creating workspace..." : "Create workspace"}</button><p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p></form></div></div>;
}
