import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Alert, Badge, Card, EmptyState, Modal, PageHeader } from "../Components/UI";
import { getError } from "../utils/format";

const tabs = [
  { key: "designation", label: "Designations", singular: "Designation", description: "Job titles employees can be assigned to." },
  { key: "location", label: "Locations", singular: "Location", description: "Offices, branches or work locations." },
  { key: "employment-type", label: "Employment Types", singular: "Employment Type", description: "Full time, contract, internship and other employment categories." },
  { key: "grade", label: "Grades / Levels", singular: "Grade / Level", description: "Optional employee levels used for consistent workforce classification." }
];

const blank = { name: "", code: "", description: "", departmentId: "", isActive: true, sortOrder: 0 };

export default function WorkforceSetup() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("departments.manage");
  const [activeTab, setActiveTab] = useState("designation");
  const [items, setItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [masterRes, departmentRes] = await Promise.all([api.get("/master-data"), api.get("/departments")]);
      setItems(masterRes.data);
      setDepartments(departmentRes.data);
      setError("");
    } catch (err) {
      setError(getError(err, "Unable to load workforce setup."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const currentTab = tabs.find((tab) => tab.key === activeTab);
  const visibleItems = useMemo(() => items.filter((item) => item.type === activeTab), [items, activeTab]);

  const openCreate = () => {
    setEditing(null);
    setForm(blank);
    setError("");
    setOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name || "",
      code: item.code || "",
      description: item.description || "",
      departmentId: item.departmentId?._id || "",
      isActive: item.isActive,
      sortOrder: item.sortOrder || 0
    });
    setError("");
    setOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const payload = { ...form, type: activeTab };
      if (editing) await api.put(`/master-data/${editing._id}`, payload);
      else await api.post("/master-data", payload);
      setNotice(`${currentTab.singular} ${editing ? "updated" : "created"} successfully.`);
      setOpen(false);
      await load();
    } catch (err) {
      setError(getError(err, "Unable to save setup item."));
    }
  };

  return <>
    <PageHeader
      title="Workforce Setup"
      description="Configure reusable HR master data once. Employee records then use controlled selections instead of free-text values."
      action={canManage && <button className="button primary" onClick={openCreate}>+ Add {currentTab.singular}</button>}
    />

    {notice && <Alert type="success">{notice}</Alert>}
    {error && !open && <Alert type="error">{error}</Alert>}

    <Card className="setup-intro">
      <div className="setup-checklist">
        <div><span>1</span><strong>Departments</strong><small>Create departments first.</small></div>
        <div><span>2</span><strong>Workforce Setup</strong><small>Add designations, locations and employment types.</small></div>
        <div><span>3</span><strong>Shifts</strong><small>Configure work schedules.</small></div>
        <div><span>4</span><strong>Employees</strong><small>Select from configured values.</small></div>
      </div>
    </Card>

    <div className="setup-tabs" role="tablist">
      {tabs.map((tab) => <button key={tab.key} type="button" className={`setup-tab ${activeTab === tab.key ? "active" : ""}`} onClick={() => { setActiveTab(tab.key); setNotice(""); }}>{tab.label}</button>)}
    </div>

    <Card>
      <div className="card-head">
        <div><h2>{currentTab.label}</h2><p>{currentTab.description}</p></div>
        <Badge value={`${visibleItems.filter((item) => item.isActive).length} active`} />
      </div>

      {loading ? <div className="empty-state"><p>Loading setup data...</p></div> : visibleItems.length ? <div className="table-wrap"><table><thead><tr><th>Name</th><th>Code</th>{activeTab === "designation" && <th>Department</th>}<th>Description</th><th>Status</th>{canManage && <th />}</tr></thead><tbody>{visibleItems.map((item) => <tr key={item._id}><td><strong>{item.name}</strong></td><td>{item.code}</td>{activeTab === "designation" && <td>{item.departmentId?.name || "All departments"}</td>}<td>{item.description || "—"}</td><td><Badge value={item.isActive ? "active" : "inactive"} /></td>{canManage && <td><button className="text-button" onClick={() => openEdit(item)}>Edit</button></td>}</tr>)}</tbody></table></div> : <EmptyState title={`No ${currentTab.label.toLowerCase()} yet`} description={`Add ${currentTab.label.toLowerCase()} before assigning them to employees.`} />}
    </Card>

    <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${currentTab.singular}` : `Add ${currentTab.singular}`}>
      <form onSubmit={submit}>
        <Alert type="error">{error}</Alert>
        <div className="form-grid two">
          <label className="field"><span>Name *</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={activeTab === "designation" ? "Senior Developer" : activeTab === "location" ? "Head Office" : activeTab === "employment-type" ? "Full Time" : "Grade 1"} /></label>
          <label className="field"><span>Code *</span><input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder={activeTab === "designation" ? "SR-DEV" : activeTab === "location" ? "HO" : activeTab === "employment-type" ? "FULL-TIME" : "G1"} /></label>
          {activeTab === "designation" && <label className="field span-two"><span>Department availability</span><select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}><option value="">All departments</option>{departments.filter((d) => d.isActive).map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}</select><small>Choose a department only when this designation should be restricted to that department.</small></label>}
          <label className="field span-two"><span>Description</span><textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          {editing && <label className="switch-row span-two"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /><span><strong>Active</strong><small>Inactive setup values remain attached to existing records but cannot be selected for new assignments.</small></span></label>}
        </div>
        <div className="modal-actions"><button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancel</button><button className="button primary">{editing ? "Save changes" : "Create"}</button></div>
      </form>
    </Modal>
  </>;
}
