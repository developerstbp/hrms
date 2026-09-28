import {
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "../services/api";

import {
  useAuth,
} from "../context/AuthContext";

import {
  Alert,
  Badge,
  Card,
  EmptyState,
  Modal,
  PageHeader,
} from "../Components/UI";

import {
  fullName,
  getError,
} from "../utils/format";

const blank = {
  name: "",
  code: "",
  description: "",
  hodId: "",
  isActive: true,
};

export default function Departments() {
  const {
    hasPermission,
  } =
    useAuth();

  const canManage =
    hasPermission(
      "departments.manage"
    );

  const canViewEmployees =
    hasPermission(
      "employees.view"
    ) ||
    hasPermission(
      "employees.manage"
    );

  const [
    departments,
    setDepartments,
  ] =
    useState([]);

  const [
    employees,
    setEmployees,
  ] =
    useState([]);

  const [
    form,
    setForm,
  ] =
    useState(
      blank
    );

  const [
    editing,
    setEditing,
  ] =
    useState(null);

  const [
    open,
    setOpen,
  ] =
    useState(false);

  const [
    viewing,
    setViewing,
  ] =
    useState(null);

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    filter,
    setFilter,
  ] =
    useState(
      "active"
    );

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    notice,
    setNotice,
  ] =
    useState("");

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  /*
  |--------------------------------------------------------------------------
  | Load
  |--------------------------------------------------------------------------
  */

  const load =
    async () => {
      try {
        const calls = [
          api.get(
            "/departments"
          ),
        ];

        if (
          canViewEmployees
        ) {
          calls.push(
            api.get(
              "/employees"
            )
          );
        }

        const result =
          await Promise.all(
            calls
          );

        setDepartments(
          result[0]
            .data ||
            []
        );

        if (
          canViewEmployees
        ) {
          setEmployees(
            result[1]
              ?.data ||
              []
          );
        }

        setError(
          ""
        );
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to load departments."
          )
        );
      }
    };

  useEffect(
    () => {
      load();
    },
    []
  );

  /*
  |--------------------------------------------------------------------------
  | Derived
  |--------------------------------------------------------------------------
  */

  const filtered =
    useMemo(
      () => {
        const term =
          search
            .trim()
            .toLowerCase();

        return departments.filter(
          (
            department
          ) => {
            if (
              filter ===
                "active" &&
              !department.isActive
            ) {
              return false;
            }

            if (
              filter ===
                "inactive" &&
              department.isActive
            ) {
              return false;
            }

            if (
              !term
            ) {
              return true;
            }

            return `${department.name} ${department.code} ${department.description || ""} ${fullName(department.hodId)}`
              .toLowerCase()
              .includes(
                term
              );
          }
        );
      },

      [
        departments,
        search,
        filter,
      ]
    );

  const activeEmployees =
    useMemo(
      () =>
        employees.filter(
          (
            employee
          ) =>
            employee.status !==
            "inactive"
        ),

      [
        employees,
      ]
    );

  const departmentMembers =
    useMemo(
      () => {
        if (
          !viewing
        ) {
          return [];
        }

        return employees.filter(
          (
            employee
          ) =>
            (
              employee
                .departmentId
                ?._id ||
              employee.departmentId
            ) ===
            viewing._id
        );
      },

      [
        employees,
        viewing,
      ]
    );

  /*
  |--------------------------------------------------------------------------
  | Open Create
  |--------------------------------------------------------------------------
  */

  const openCreate =
    () => {
      setEditing(
        null
      );

      setForm({
        ...blank,
      });

      setError(
        ""
      );

      setOpen(
        true
      );
    };

  /*
  |--------------------------------------------------------------------------
  | Open Edit
  |--------------------------------------------------------------------------
  */

  const edit =
    (
      department
    ) => {
      setEditing(
        department
      );

      setForm({
        name:
          department.name ||
          "",

        code:
          department.code ||
          "",

        description:
          department.description ||
          "",

        hodId:
          department
            .hodId
            ?._id ||
          "",

        isActive:
          department.isActive !==
          false,
      });

      setError(
        ""
      );

      setOpen(
        true
      );
    };

  /*
  |--------------------------------------------------------------------------
  | Submit
  |--------------------------------------------------------------------------
  */

  const submit =
    async (
      event
    ) => {
      event.preventDefault();

      try {
        setSaving(
          true
        );

        setError(
          ""
        );

        if (
          editing
        ) {
          await api.put(
            `/departments/${editing._id}`,
            form
          );

          setNotice(
            "Department updated successfully."
          );
        } else {
          await api.post(
            "/departments",
            form
          );

          setNotice(
            "Department created successfully."
          );
        }

        setOpen(
          false
        );

        setForm({
          ...blank,
        });

        setEditing(
          null
        );

        await load();
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to save department."
          )
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Active Toggle
  |--------------------------------------------------------------------------
  */

  const toggleDepartment =
    async (
      department
    ) => {
      const next =
        !department.isActive;

      if (
        !next &&
        Number(
          department.activeEmployeeCount ||
            0
        ) >
          0
      ) {
        setError(
          `You cannot deactivate ${department.name} because it still has ${department.activeEmployeeCount} active employee(s).`
        );

        return;
      }

      const confirmed =
        window.confirm(
          next
            ? `Activate "${department.name}"?`
            : `Deactivate "${department.name}"?\n\nThe department will remain in historical records.`
        );

      if (
        !confirmed
      ) {
        return;
      }

      try {
        setError(
          ""
        );

        await api.put(
          `/departments/${department._id}`,
          {
            isActive:
              next,
          }
        );

        setNotice(
          next
            ? `${department.name} activated.`
            : `${department.name} deactivated.`
        );

        await load();
      } catch (err) {
        setError(
          getError(
            err
          )
        );
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <>
      <PageHeader
        title="Departments"
        description="Create departments, assign department heads and manage your company structure."
        action={
          canManage && (
            <button
              className="button primary"
              onClick={
                openCreate
              }
            >
              + New Department
            </button>
          )
        }
      />

      {notice && (
        <Alert type="success">
          {notice}
        </Alert>
      )}

      {error &&
        !open && (
          <Alert type="error">
            {error}
          </Alert>
        )}

      <Card>
        <div className="toolbar">
          <div className="search-box">
            <span>
              ⌕
            </span>

            <input
              value={
                search
              }
              onChange={(
                event
              ) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search department, code or HOD"
            />
          </div>

          <select
            className="compact-select"
            value={
              filter
            }
            onChange={(
              event
            ) =>
              setFilter(
                event.target.value
              )
            }
          >
            <option value="active">
              Active
            </option>

            <option value="inactive">
              Inactive
            </option>

            <option value="all">
              All Departments
            </option>
          </select>
        </div>
      </Card>

      {filtered.length ? (
        <div className="department-grid">
          {filtered.map(
            (
              department
            ) => (
              <Card
                key={
                  department._id
                }
                className="department-card"
              >
                <div className="department-top">
                  <div className="department-code">
                    {
                      department.code
                    }
                  </div>

                  <Badge
                    value={
                      department.isActive
                        ? "active"
                        : "inactive"
                    }
                  />
                </div>

                <h2>
                  {
                    department.name
                  }
                </h2>

                <p>
                  {department.description ||
                    "No description added."}
                </p>

                <div className="department-meta">
                  <div>
                    <span>
                      Head of Department
                    </span>

                    <strong>
                      {fullName(
                        department.hodId
                      ) ||
                        "Not assigned"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Active Employees
                    </span>

                    <strong>
                      {department.activeEmployeeCount ||
                        0}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Total Records
                    </span>

                    <strong>
                      {department.employeeCount ||
                        0}
                    </strong>
                  </div>
                </div>

                <div className="button-row">
                  {canViewEmployees && (
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() =>
                        setViewing(
                          department
                        )
                      }
                    >
                      View Employees
                    </button>
                  )}

                  {canManage && (
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() =>
                        edit(
                          department
                        )
                      }
                    >
                      Edit
                    </button>
                  )}

                  {canManage && (
                    <button
                      type="button"
                      className={`text-button ${
                        department.isActive
                          ? "danger"
                          : ""
                      }`}
                      onClick={() =>
                        toggleDepartment(
                          department
                        )
                      }
                    >
                      {department.isActive
                        ? "Deactivate"
                        : "Activate"}
                    </button>
                  )}
                </div>
              </Card>
            )
          )}
        </div>
      ) : (
        <Card>
          <EmptyState
            title="No departments found"
            description={
              filter ===
              "active"
                ? "No active departments match your search."
                : "No departments match your search."
            }
          />
        </Card>
      )}

      {/* ============================================================= */}
      {/* CREATE / EDIT */}
      {/* ============================================================= */}

      <Modal
        open={
          open
        }
        onClose={() =>
          setOpen(
            false
          )
        }
        title={
          editing
            ? "Edit Department"
            : "Create Department"
        }
      >
        <form
          onSubmit={
            submit
          }
        >
          {error && (
            <Alert type="error">
              {error}
            </Alert>
          )}

          <div className="form-grid two">
            <label className="field">
              <span>
                Department Name *
              </span>

              <input
                required
                value={
                  form.name
                }
                onChange={(
                  event
                ) =>
                  setForm({
                    ...form,

                    name:
                      event.target.value,
                  })
                }
                placeholder="e.g. Human Resources"
              />
            </label>

            <label className="field">
              <span>
                Code *
              </span>

              <input
                required
                value={
                  form.code
                }
                onChange={(
                  event
                ) =>
                  setForm({
                    ...form,

                    code:
                      event.target.value.toUpperCase(),
                  })
                }
                placeholder="HR"
              />
            </label>

            <label className="field span-two">
              <span>
                Description
              </span>

              <textarea
                rows="3"
                value={
                  form.description
                }
                onChange={(
                  event
                ) =>
                  setForm({
                    ...form,

                    description:
                      event.target.value,
                  })
                }
              />
            </label>

            <label className="field span-two">
              <span>
                Head of Department
              </span>

              <select
                value={
                  form.hodId
                }
                onChange={(
                  event
                ) =>
                  setForm({
                    ...form,

                    hodId:
                      event.target.value,
                  })
                }
              >
                <option value="">
                  Not assigned
                </option>

                {activeEmployees.map(
                  (
                    employee
                  ) => (
                    <option
                      key={
                        employee._id
                      }
                      value={
                        employee._id
                      }
                    >
                      {fullName(
                        employee
                      )}
                      {" — "}
                      {employee.designation ||
                        employee
                          .designationId
                          ?.name ||
                        employee.employeeCode}
                    </option>
                  )
                )}
              </select>

              <small>
                The selected employee will be notified when HOD responsibility changes.
              </small>
            </label>

            {editing && (
              <label className="switch-row span-two">
                <input
                  type="checkbox"
                  checked={
                    form.isActive
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,

                      isActive:
                        event.target.checked,
                    })
                  }
                />

                <span>
                  <strong>
                    Department Active
                  </strong>

                  <small>
                    A department with active employees cannot be deactivated.
                  </small>
                </span>
              </label>
            )}
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                setOpen(
                  false
                )
              }
            >
              Cancel
            </button>

            <button
              className="button primary"
              disabled={
                saving
              }
            >
              {saving
                ? "Saving..."
                : editing
                  ? "Save Changes"
                  : "Create Department"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================= */}
      {/* DEPARTMENT EMPLOYEES */}
      {/* ============================================================= */}

      <Modal
        open={
          Boolean(
            viewing
          )
        }
        onClose={() =>
          setViewing(
            null
          )
        }
        title={
          viewing
            ? `${viewing.name} Employees`
            : "Department Employees"
        }
        wide
      >
        {departmentMembers.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    Employee
                  </th>

                  <th>
                    Designation
                  </th>

                  <th>
                    Manager
                  </th>

                  <th>
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {departmentMembers.map(
                  (
                    employee
                  ) => (
                    <tr
                      key={
                        employee._id
                      }
                    >
                      <td>
                        <strong>
                          {fullName(
                            employee
                          )}
                        </strong>

                        <small>
                          {
                            employee.employeeCode
                          }
                        </small>
                      </td>

                      <td>
                        {employee.designation ||
                          employee
                            .designationId
                            ?.name ||
                          "—"}
                      </td>

                      <td>
                        {fullName(
                          employee.managerId
                        ) ||
                          "—"}
                      </td>

                      <td>
                        <Badge
                          value={
                            employee.status
                          }
                        />
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No employees in this department"
          />
        )}
      </Modal>
    </>
  );
}