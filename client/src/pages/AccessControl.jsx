import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { Alert, Badge, Card, Modal, PageHeader } from "../Components/UI";
import { fullName, getError } from "../utils/format";
import { useAuth } from "../context/AuthContext";

const permissionLabels = {
  "dashboard.view": "Dashboard",
  "employees.view": "View employees",
  "employees.manage": "Manage employees",
  "departments.view": "View departments",
  "departments.manage": "Manage departments",
  "attendance.self": "Own attendance",
  "attendance.view": "View team attendance",
  "attendance.manage": "Manage attendance",
  "leave.self": "Own leave",
  "leave.team": "Leave on behalf",
  "leave.approve": "Approve leave",
  "leave.policies": "Manage leave policies",
  "shift.self": "Own shift & requests",
  "shift.team": "View team shifts",
  "shift.manage": "Manage shifts",
  "payroll.self": "Own payslips",
  "payroll.view": "View payroll",
  "payroll.manage": "Manage payroll",
  "holidays.view": "View holidays",
  "holidays.manage": "Manage holidays",
  "audit.view": "View audit log",
  "company.settings": "Company settings",
  "access.control": "Access control"
};

export default function AccessControl() {
  const { user, refreshMe } = useAuth();
  const [users, setUsers] = useState([]); const [permissions, setPermissions] = useState([]); const [selected, setSelected] = useState(null); const [form, setForm] = useState(null); const [tempPassword, setTempPassword] = useState(""); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const load = async () => { try { const { data } = await api.get("/access"); setUsers(data.users); setPermissions(data.permissions); } catch (err) { setError(getError(err)); } };
  useEffect(() => { load(); }, []);
  const groups = useMemo(() => [
    { title: "People", keys: permissions.filter((p) => p.startsWith("employees") || p.startsWith("departments")) },
    { title: "Attendance, leave & shifts", keys: permissions.filter((p) => p.startsWith("attendance") || p.startsWith("leave") || p.startsWith("shift")) },
    { title: "Payroll", keys: permissions.filter((p) => p.startsWith("payroll")) },
    { title: "Workspace", keys: permissions.filter((p) => p.startsWith("holiday") || p === "dashboard.view" || p === "company.settings" || p === "audit.view") }
  ], [permissions]);
  const edit = (target) => { setSelected(target); setForm({ role: target.role, isActive: target.isActive, permissions: [...target.permissions] }); setTempPassword(""); setError(""); };
  const roleDefaults = (role) => {
    if (role === "admin") return permissions;
    if (role === "hr") return permissions.filter((p) => p !== "access.control");
    if (["hod", "manager"].includes(role)) return ["dashboard.view", "employees.view", "departments.view", "attendance.self", "attendance.view", "leave.self", "leave.team", "leave.approve", "shift.self", "shift.team", "payroll.self", "holidays.view"];
    return ["dashboard.view", "attendance.self", "leave.self", "shift.self", "payroll.self", "holidays.view"];
  };
  const changeRole = (role) => setForm((prev) => ({ ...prev, role, permissions: roleDefaults(role) }));
  const togglePermission = (permission) => setForm((prev) => ({ ...prev, permissions: prev.permissions.includes(permission) ? prev.permissions.filter((p) => p !== permission) : [...prev.permissions, permission] }));
  const resetPassword = async () => {
    if (tempPassword.length < 8) { setError("Temporary password must be at least 8 characters long."); return; }
    try { const { data } = await api.put(`/access/${selected._id}/reset-password`, { temporaryPassword: tempPassword }); setTempPassword(""); setNotice(data.message); setError(""); } catch (err) { setError(getError(err)); }
  };
  const save = async (e) => { e.preventDefault(); try { await api.put(`/access/${selected._id}`, form); const selectedId = selected._id; setSelected(null); setNotice("User access updated successfully."); await load(); if (selectedId === user._id) await refreshMe(); } catch (err) { setError(getError(err)); } };
  return <><PageHeader title="Access Control" description="Administrator-only controls for roles, module permissions and account activation." />{notice && <Alert type="success">{notice}</Alert>}{error && !selected && <Alert type="error">{error}</Alert>}<Card><div className="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Employee profile</th><th>Account</th><th>Permissions</th><th /></tr></thead><tbody>{users.map((item) => <tr key={item._id}><td><strong>{fullName(item)}</strong><small>{item.email}</small></td><td><Badge value={item.role} /></td><td>{item.employee ? <><strong>{item.employee.employeeCode}</strong><small>{item.employee.designation} · {item.employee.departmentId?.name || "No department"}</small></> : <span className="muted">Administrator account</span>}</td><td><Badge value={item.isActive ? "active" : "inactive"} /></td><td>{item.role === "admin" ? "Full administrator access" : `${item.permissions.length} enabled`}</td><td><button className="text-button" onClick={() => edit(item)}>Manage</button></td></tr>)}</tbody></table></div></Card><Card className="security-note"><div className="stat-icon">⌾</div><div><h3>Protected administrator authority</h3><p>Access Control cannot be delegated to HR, HOD, Manager or Employee roles. Administrators can activate or deactivate users, change roles and customize operational permissions.</p></div></Card><Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Manage user access" wide><form onSubmit={save}><Alert type="error">{error}</Alert>{selected && <div className="access-user-head"><span className="avatar">{selected.firstName?.[0]}{selected.lastName?.[0]}</span><div><strong>{fullName(selected)}</strong><span>{selected.email}</span></div></div>}<div className="form-grid two"><label className="field"><span>Role</span><select value={form?.role || "employee"} onChange={(e) => changeRole(e.target.value)} disabled={selected?._id === user._id}><option value="admin">Admin</option><option value="hr">HR</option><option value="hod">HOD</option><option value="manager">Manager</option><option value="employee">Employee</option></select></label><label className="switch-row"><input type="checkbox" checked={Boolean(form?.isActive)} disabled={selected?._id === user._id} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /><span><strong>Account active</strong><small>Inactive users cannot sign in or use existing sessions.</small></span></label></div>{form?.role !== "admin" && <div className="permission-groups">{groups.map((group) => <div className="permission-group" key={group.title}><h3>{group.title}</h3><div className="permission-list">{group.keys.map((permission) => <label className="permission-item" key={permission}><input type="checkbox" checked={form?.permissions.includes(permission)} onChange={() => togglePermission(permission)} /><span><strong>{permissionLabels[permission] || permission}</strong><small>{permission}</small></span></label>)}</div></div>)}</div>}{form?.role === "admin" && <Alert type="info">Admin accounts always receive full access, including Access Control.</Alert>}<div className="password-reset-box"><div><strong>Set temporary password</strong><span>Useful before email-based password recovery is connected. The user will be required to change it after sign-in.</span></div><div className="password-reset-action"><input type="password" minLength="8" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} placeholder="Minimum 8 characters" /><button type="button" className="button secondary" onClick={resetPassword}>Set password</button></div></div><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setSelected(null)}>Cancel</button><button className="button primary">Save access</button></div></form></Modal></>;
}
