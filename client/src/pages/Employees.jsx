import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import api from "../services/api";

import {
  useAuth,
} from "../context/AuthContext";

import {
  Alert,
  Card,
  Badge,
  EmptyState,
  Modal,
  PageHeader,
} from "../Components/UI";

import EmployeeLifecycle
  from "../Components/EmployeeLifecycle";

import {
  fullName,
  getError,
} from "../utils/format";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const today = () =>
  new Date()
    .toISOString()
    .slice(
      0,
      10
    );

const normalizeLabel = (
  value = ""
) =>
  String(value)
    .toLowerCase()
    .replace(
      /[-_]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();

const generatePassword =
  () => {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

    let result =
      "";

    if (
      window.crypto
        ?.getRandomValues
    ) {
      const array =
        new Uint32Array(
          6
        );

      window.crypto
        .getRandomValues(
          array
        );

      array.forEach(
        (
          value
        ) => {
          result +=
            chars[
              value %
                chars.length
            ];
        }
      );
    } else {
      for (
        let i = 0;
        i < 6;
        i += 1
      ) {
        result +=
          chars[
            Math.floor(
              Math.random() *
                chars.length
            )
          ];
      }
    }

    return `Temp@${result}`;
  };

const blankForm = {
  employeeCode:
    "",

  biometricUserId:
    "",

  firstName:
    "",

  lastName:
    "",

  email:
    "",

  phone:
    "",

  departmentId:
    "",

  managerId:
    "",

  designationId:
    "",

  locationId:
    "",

  employmentTypeId:
    "",

  gradeId:
    "",

  joiningDate:
    today(),

  initialPassword:
    "",

  gender:
    "",

  dateOfBirth:
    "",

  address:
    "",

  shiftId:
    "",
};

/*
|--------------------------------------------------------------------------
| Component
|--------------------------------------------------------------------------
*/

export default function Employees() {
  const {
    hasPermission,
  } = useAuth();

  const canManage =
    hasPermission(
      "employees.manage"
    );

  /*
  |--------------------------------------------------------------------------
  | Data
  |--------------------------------------------------------------------------
  */

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    departments,
    setDepartments,
  ] = useState([]);

  const [
    shifts,
    setShifts,
  ] = useState([]);

  const [
    masterData,
    setMasterData,
  ] = useState([]);

  const [
    search,
    setSearch,
  ] = useState("");

  /*
  |--------------------------------------------------------------------------
  | Form
  |--------------------------------------------------------------------------
  */

  const [
    form,
    setForm,
  ] = useState(
    blankForm
  );

  const [
    editing,
    setEditing,
  ] = useState(null);

  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    notice,
    setNotice,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    lifecycleEmployee,
    setLifecycleEmployee,
  ] = useState(null);

  /*
  |--------------------------------------------------------------------------
  | Load
  |--------------------------------------------------------------------------
  */

  const load =
    async () => {
      try {
        const employeesRes =
          await api.get(
            "/employees"
          );

        setEmployees(
          employeesRes.data ||
            []
        );

        if (
          canManage
        ) {
          const [
            departmentsRes,
            shiftsRes,
            masterRes,
          ] =
            await Promise.all([
              api.get(
                "/departments"
              ),

              api.get(
                "/shifts"
              ),

              api.get(
                "/master-data"
              ),
            ]);

          setDepartments(
            departmentsRes.data ||
              []
          );

          setShifts(
            shiftsRes.data ||
              []
          );

          setMasterData(
            masterRes.data ||
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
            "Unable to load employees."
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
  | Workforce Setup
  |--------------------------------------------------------------------------
  */

  const designations =
    masterData.filter(
      (
        item
      ) =>
        item.type ===
        "designation"
    );

  const locations =
    masterData.filter(
      (
        item
      ) =>
        item.type ===
        "location"
    );

  const employmentTypes =
    masterData.filter(
      (
        item
      ) =>
        item.type ===
        "employment-type"
    );

  const grades =
    masterData.filter(
      (
        item
      ) =>
        item.type ===
        "grade"
    );

  const activeDepartments =
    departments.filter(
      (
        item
      ) =>
        item.isActive
    );

  const activeShifts =
    shifts.filter(
      (
        item
      ) =>
        item.isActive
    );

  const activeLocations =
    locations.filter(
      (
        item
      ) =>
        item.isActive
    );

  const activeDesignations =
    designations.filter(
      (
        item
      ) =>
        item.isActive &&
        (
          !item.departmentId ||
          item.departmentId
            ?._id ===
            form.departmentId
        )
    );

  const setupReady =
    activeDepartments.length >
      0 &&
    designations.some(
      (
        item
      ) =>
        item.isActive
    ) &&
    employmentTypes.some(
      (
        item
      ) =>
        item.isActive
    ) &&
    activeShifts.length >
      0;

  /*
  |--------------------------------------------------------------------------
  | Manager Options
  |--------------------------------------------------------------------------
  */

  const managerOptions =
    useMemo(
      () => {
        return employees
          .filter(
            (
              item
            ) =>
              item._id !==
                editing?._id &&
              item.status !==
                "inactive"
          )
          .sort(
            (
              a,
              b
            ) => {
              const aSame =
                a.departmentId
                  ?._id ===
                form.departmentId;

              const bSame =
                b.departmentId
                  ?._id ===
                form.departmentId;

              if (
                aSame &&
                !bSame
              ) {
                return -1;
              }

              if (
                !aSame &&
                bSame
              ) {
                return 1;
              }

              return fullName(
                a
              ).localeCompare(
                fullName(
                  b
                )
              );
            }
          );
      },
      [
        employees,
        editing,
        form.departmentId,
      ]
    );

  /*
  |--------------------------------------------------------------------------
  | Search
  |--------------------------------------------------------------------------
  */

  const filtered =
    useMemo(
      () =>
        employees.filter(
          (
            employee
          ) =>
            `${fullName(
              employee
            )} ${
              employee.employeeCode
            } ${
              employee.designation
            } ${
              employee.departmentId
                ?.name ||
              ""
            } ${
              employee.locationId
                ?.name ||
              ""
            }`
              .toLowerCase()
              .includes(
                search.toLowerCase()
              )
        ),
      [
        employees,
        search,
      ]
    );

  /*
  |--------------------------------------------------------------------------
  | Helpers
  |--------------------------------------------------------------------------
  */

  const findLegacyMasterId =
    (
      type,
      label
    ) =>
      masterData.find(
        (
          item
        ) =>
          item.type ===
            type &&
          normalizeLabel(
            item.name
          ) ===
            normalizeLabel(
              label
            )
      )?._id ||
      "";

  const nextEmployeeCode =
    () => {
      const numbers =
        employees
          .map(
            (
              employee
            ) => {
              const match =
                String(
                  employee.employeeCode ||
                    ""
                ).match(
                  /(\d+)/
                );

              return match
                ? Number(
                    match[1]
                  )
                : 0;
            }
          );

      const next =
        Math.max(
          0,
          ...numbers
        ) + 1;

      return `EMP-${String(
        next
      ).padStart(
        3,
        "0"
      )}`;
    };

  /*
  |--------------------------------------------------------------------------
  | Form Change
  |--------------------------------------------------------------------------
  */

  const change =
    (
      event
    ) => {
      const {
        name,
        value,
      } =
        event.target;

      if (
        name ===
        "departmentId"
      ) {
        const stillValid =
          designations.find(
            (
              item
            ) =>
              item._id ===
                form.designationId &&
              (
                !item.departmentId ||
                item.departmentId
                  ?._id ===
                  value
              )
          );

        setForm({
          ...form,

          departmentId:
            value,

          designationId:
            stillValid
              ? form.designationId
              : "",
        });

        return;
      }

      setForm({
        ...form,

        [name]:
          value,
      });
    };

  /*
  |--------------------------------------------------------------------------
  | Add Employee
  |--------------------------------------------------------------------------
  */

  const openCreate =
    () => {
      if (
        !setupReady
      ) {
        return;
      }

      const defaultShift =
        shifts.find(
          (
            shift
          ) =>
            shift.isDefault &&
            shift.isActive
        ) ||
        activeShifts[0];

      const defaultEmploymentType =
        employmentTypes.find(
          (
            item
          ) =>
            item.isActive &&
            normalizeLabel(
              item.name
            ) ===
              "full time"
        ) ||
        employmentTypes.find(
          (
            item
          ) =>
            item.isActive
        );

      const defaultLocation =
        activeLocations.length ===
        1
          ? activeLocations[0]
          : null;

      setEditing(
        null
      );

      setForm({
        ...blankForm,

        employeeCode:
          nextEmployeeCode(),

        joiningDate:
          today(),

        shiftId:
          defaultShift?._id ||
          "",

        employmentTypeId:
          defaultEmploymentType
            ?._id ||
          "",

        locationId:
          defaultLocation?._id ||
          "",

        initialPassword:
          generatePassword(),
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
  | Edit Employee
  |--------------------------------------------------------------------------
  */

  const openEdit =
    (
      employee
    ) => {
      setEditing(
        employee
      );

      setForm({
        ...blankForm,

        employeeCode:
          employee.employeeCode ||
          "",

        biometricUserId:
          employee.biometricUserId ||
          "",

        firstName:
          employee.firstName ||
          "",

        lastName:
          employee.lastName ||
          "",

        email:
          employee.workEmail ||
          "",

        phone:
          employee.phone ||
          "",

        departmentId:
          employee.departmentId
            ?._id ||
          "",

        managerId:
          employee.managerId
            ?._id ||
          "",

        designationId:
          employee.designationId
            ?._id ||
          findLegacyMasterId(
            "designation",
            employee.designation
          ),

        locationId:
          employee.locationId
            ?._id ||
          "",

        employmentTypeId:
          employee.employmentTypeId
            ?._id ||
          findLegacyMasterId(
            "employment-type",
            employee.employmentType
          ),

        gradeId:
          employee.gradeId
            ?._id ||
          "",

        joiningDate:
          employee.joiningDate
            ?.slice(
              0,
              10
            ) ||
          "",

        lastWorkingDate:
          employee.lastWorkingDate
            ?.slice(
              0,
              10
            ) ||
          "",

        status:
          employee.status ||
          "active",

        gender:
          employee.gender ||
          "",

        dateOfBirth:
          employee.dateOfBirth
            ?.slice(
              0,
              10
            ) ||
          "",

        address:
          employee.address ||
          "",
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
  | Copy Temporary Password
  |--------------------------------------------------------------------------
  */

  const copyPassword =
    async () => {
      try {
        await navigator.clipboard.writeText(
          form.initialPassword
        );

        setNotice(
          "Temporary password copied."
        );
      } catch {
        setNotice(
          "Temporary password is ready to copy manually."
        );
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Save
  |--------------------------------------------------------------------------
  */

  const submit =
    async (
      event
    ) => {
      event.preventDefault();

      setSaving(
        true
      );

      setError(
        ""
      );

      try {
        if (
          editing
        ) {
          const payload = {
            ...form,
          };

          delete payload.email;
          delete payload.initialPassword;
          delete payload.shiftId;

          await api.put(
            `/employees/${editing._id}`,
            payload
          );

          setNotice(
            "Employee updated successfully."
          );
        } else {
          await api.post(
            "/employees",
            form
          );

          setNotice(
            "Employee created successfully. Share the work email and temporary password with the employee."
          );
        }

        setOpen(
          false
        );

        await load();
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to save employee."
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
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <>
      <PageHeader
        title="Employees"
        description={
          canManage
            ? "Add employees quickly using your existing departments, designations and shifts."
            : "Employees available within your reporting scope."
        }
        action={
          canManage ? (
            <button
              className="button primary"
              disabled={
                !setupReady
              }
              onClick={
                openCreate
              }
            >
              + Add Employee
            </button>
          ) : null
        }
      />

      {/* ============================================================= */}
      {/* Setup Warning */}
      {/* ============================================================= */}

      {canManage &&
        !setupReady && (
          <Alert type="info">
            Before adding employees,
            complete the basic setup.
            You need at least one
            department,
            designation,
            employment type and
            shift.
            {" "}

            <Link to="/workforce-setup">
              <strong>
                Workforce Setup
              </strong>
            </Link>

            {" · "}

            <Link to="/shifts">
              <strong>
                Shifts
              </strong>
            </Link>
          </Alert>
        )}

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

      {/* ============================================================= */}
      {/* Employee List */}
      {/* ============================================================= */}

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
                  event
                    .target
                    .value
                )
              }
              placeholder="Search employee, code, department or designation"
            />
          </div>

          <span className="record-count">
            {
              filtered.length
            }{" "}
            employee
            {filtered.length ===
            1
              ? ""
              : "s"}
          </span>
        </div>

        {filtered.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    Employee
                  </th>

                  <th>Biometric ID</th>

                  <th>
                    Department
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

                  {canManage && (
                    <th />
                  )}
                </tr>
              </thead>

              <tbody>
                {filtered.map(
                  (
                    employee
                  ) => (
                    <tr
                      key={
                        employee._id
                      }
                    >
                      <td>
                        <div className="person-cell">
                          <span className="avatar tiny">
                            {
                              employee
                                .firstName?.[0]
                            }
                            {
                              employee
                                .lastName?.[0]
                            }
                          </span>

                          <div>
                            <strong>
                              {fullName(
                                employee
                              )}
                            </strong>

                            <small>
                              {
                                employee.employeeCode
                              }
                              {" · "}
                              {
                                employee.workEmail
                              }
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>
                        {employee.biometricUserId ||
                          "—"}
                      </td>

                      <td>
                        {employee
                          .departmentId
                          ?.name ||
                          "—"}
                      </td>

                      <td>
                        {employee.designation ||
                          "—"}
                      </td>

                      <td>
                        {employee.managerId
                          ? fullName(
                              employee.managerId
                            )
                          : "—"}
                      </td>

                      <td>
                        <Badge
                          value={
                            employee.status
                          }
                        />
                      </td>

                      {canManage && (
                        <td>
                          <div className="row-actions">
                            <button
                              className="text-button"
                              onClick={() =>
                                openEdit(
                                  employee
                                )
                              }
                            >
                              Edit
                            </button>

                            <button
                              className="text-button"
                              onClick={() =>
                                setLifecycleEmployee(
                                  employee
                                )
                              }
                            >
                              HR Actions
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No employees found"
            description="Add your first employee after completing the basic organization setup."
          />
        )}
      </Card>

      {/* ============================================================= */}
      {/* Add / Edit Employee */}
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
            ? "Edit Employee"
            : "Add Employee"
        }
        wide
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

          {!editing && (
            <Alert type="info">
              Most fields are already
              pre-selected for you.
              You only need to enter
              the employee's basic
              information.
            </Alert>
          )}

          {/* ========================================================= */}
          {/* Basic Information */}
          {/* ========================================================= */}

          <div className="section-label">
            Basic Information
          </div>

          <div className="form-grid three">
            <label className="field">
              <span>
                First Name *
              </span>

              <input
                name="firstName"
                required
                value={
                  form.firstName
                }
                onChange={
                  change
                }
                placeholder="e.g. Ahmed"
              />
            </label>

            <label className="field">
              <span>
                Last Name
              </span>

              <input
                name="lastName"
                value={
                  form.lastName
                }
                onChange={
                  change
                }
                placeholder="e.g. Khan"
              />
            </label>

            <label className="field">
              <span>
                Employee Code *
              </span>

              <input
                name="employeeCode"
                required
                value={
                  form.employeeCode
                }
                onChange={
                  change
                }
              />

              {!editing && (
                <small>
                  Suggested
                  automatically. You
                  can change it.
                </small>
              )}
            </label>

            <label className="field">
              <span>
                Biometric User ID
              </span>

              <input
                name="biometricUserId"
                value={
                  form.biometricUserId
                }
                onChange={
                  change
                }
                placeholder="e.g. 49"
              />

              <small>
                User ID stored in the
                ZKTeco biometric machine.
              </small>
            </label>

            <label className="field">
              <span>
                Work Email *
              </span>

              <input
                name="email"
                type="email"
                required={
                  !editing
                }
                disabled={
                  Boolean(
                    editing
                  )
                }
                value={
                  form.email
                }
                onChange={
                  change
                }
                placeholder="name@company.com"
              />
            </label>

            <label className="field">
              <span>
                Joining Date
              </span>

              <input
                type="date"
                name="joiningDate"
                value={
                  form.joiningDate
                }
                onChange={
                  change
                }
              />
            </label>

            <label className="field">
              <span>
                Status
              </span>

              <select
                name="status"
                value={
                  form.status
                }
                onChange={
                  change
                }
              >
                <option value="active">
                  Active
                </option>

                <option value="on-notice">
                  On Notice
                </option>

                <option value="inactive">
                  Inactive
                </option>
              </select>
            </label>
          </div>

          {/* ========================================================= */}
          {/* Job Setup */}
          {/* ========================================================= */}

          <div className="section-label">
            Job Setup
          </div>

          <div className="form-grid three">
            <label className="field">
              <span>
                Department *
              </span>

              <select
                name="departmentId"
                required
                value={
                  form.departmentId
                }
                onChange={
                  change
                }
              >
                <option value="">
                  Select Department
                </option>

                {activeDepartments.map(
                  (
                    department
                  ) => (
                    <option
                      key={
                        department._id
                      }
                      value={
                        department._id
                      }
                    >
                      {
                        department.name
                      }
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="field">
              <span>
                Designation *
              </span>

              <select
                name="designationId"
                required
                disabled={
                  !form.departmentId
                }
                value={
                  form.designationId
                }
                onChange={
                  change
                }
              >
                <option value="">
                  {form.departmentId
                    ? "Select Designation"
                    : "Select Department First"}
                </option>

                {activeDesignations.map(
                  (
                    designation
                  ) => (
                    <option
                      key={
                        designation._id
                      }
                      value={
                        designation._id
                      }
                    >
                      {
                        designation.name
                      }
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="field">
              <span>
                Reporting Manager
              </span>

              <select
                name="managerId"
                value={
                  form.managerId
                }
                onChange={
                  change
                }
              >
                <option value="">
                  No Direct Manager
                </option>

                {managerOptions.map(
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
                      {
                        employee.designation
                      }
                    </option>
                  )
                )}
              </select>

              <small>
                Employees from the
                same department are
                shown first.
              </small>
            </label>

            <label className="field">
              <span>
                Employment Type *
              </span>

              <select
                name="employmentTypeId"
                required
                value={
                  form.employmentTypeId
                }
                onChange={
                  change
                }
              >
                <option value="">
                  Select Type
                </option>

                {employmentTypes
                  .filter(
                    (
                      item
                    ) =>
                      item.isActive
                  )
                  .map(
                    (
                      item
                    ) => (
                      <option
                        key={
                          item._id
                        }
                        value={
                          item._id
                        }
                      >
                        {
                          item.name
                        }
                      </option>
                    )
                  )}
              </select>
            </label>

            {!editing && (
              <label className="field">
                <span>
                  Initial Shift *
                </span>

                <select
                  name="shiftId"
                  required
                  value={
                    form.shiftId
                  }
                  onChange={
                    change
                  }
                >
                  <option value="">
                    Select Shift
                  </option>

                  {activeShifts.map(
                    (
                      shift
                    ) => (
                      <option
                        key={
                          shift._id
                        }
                        value={
                          shift._id
                        }
                      >
                        {
                          shift.name
                        }
                        {" — "}
                        {
                          shift.startTime
                        }
                        {" to "}
                        {
                          shift.endTime
                        }
                      </option>
                    )
                  )}
                </select>

                <small>
                  Future shift changes
                  are handled from
                  Shifts.
                </small>
              </label>
            )}

            {editing && (
              <label className="field">
                <span>
                  Last Working Date
                </span>

                <input
                  type="date"
                  name="lastWorkingDate"
                  value={
                    form.lastWorkingDate
                  }
                  onChange={
                    change
                  }
                />

                <small>
                  Leave blank while
                  employment is
                  ongoing.
                </small>
              </label>
            )}
          </div>

          {/* ========================================================= */}
          {/* Login */}
          {/* ========================================================= */}

          {!editing && (
            <>
              <div className="section-label">
                Employee Login
              </div>

              <Card>
                <div className="form-grid two">
                  <label className="field">
                    <span>
                      Temporary Password
                    </span>

                    <input
                      type="text"
                      name="initialPassword"
                      required
                      minLength="8"
                      value={
                        form.initialPassword
                      }
                      onChange={
                        change
                      }
                    />
                  </label>

                  <div
                    style={{
                      display:
                        "flex",

                      alignItems:
                        "flex-end",
                    }}
                  >
                    <button
                      type="button"
                      className="button secondary"
                      onClick={
                        copyPassword
                      }
                    >
                      Copy Password
                    </button>
                  </div>
                </div>

                <small>
                  For a new login, this is the
                  temporary password. If this
                  email already belongs to an
                  Admin, HR, HOD or Manager
                  account, HRMS will link that
                  existing login to this employee
                  profile and keep its current
                  role and permissions.
                </small>
              </Card>
            </>
          )}

          {/* ========================================================= */}
          {/* Additional Details */}
          {/* ========================================================= */}

          <details
            style={{
              marginTop:
                20,

              border:
                "1px solid #e2e8f0",

              borderRadius:
                12,

              padding:
                16,
            }}
          >
            <summary
              style={{
                cursor:
                  "pointer",

                fontWeight:
                  700,
              }}
            >
              Additional Details
              (Optional)
            </summary>

            <div
              className="form-grid three"
              style={{
                marginTop:
                  20,
              }}
            >
              <label className="field">
                <span>
                  Phone
                </span>

                <input
                  name="phone"
                  value={
                    form.phone
                  }
                  onChange={
                    change
                  }
                />
              </label>

              <label className="field">
                <span>
                  Location / Branch
                </span>

                <select
                  name="locationId"
                  value={
                    form.locationId
                  }
                  onChange={
                    change
                  }
                >
                  <option value="">
                    Not Assigned
                  </option>

                  {activeLocations.map(
                    (
                      item
                    ) => (
                      <option
                        key={
                          item._id
                        }
                        value={
                          item._id
                        }
                      >
                        {
                          item.name
                        }
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="field">
                <span>
                  Grade / Level
                </span>

                <select
                  name="gradeId"
                  value={
                    form.gradeId
                  }
                  onChange={
                    change
                  }
                >
                  <option value="">
                    Not Assigned
                  </option>

                  {grades
                    .filter(
                      (
                        item
                      ) =>
                        item.isActive
                    )
                    .map(
                      (
                        item
                      ) => (
                        <option
                          key={
                            item._id
                          }
                          value={
                            item._id
                          }
                        >
                          {
                            item.name
                          }
                        </option>
                      )
                    )}
                </select>
              </label>

              <label className="field">
                <span>
                  Gender
                </span>

                <select
                  name="gender"
                  value={
                    form.gender
                  }
                  onChange={
                    change
                  }
                >
                  <option value="">
                    Not Specified
                  </option>

                  <option value="male">
                    Male
                  </option>

                  <option value="female">
                    Female
                  </option>

                  <option value="other">
                    Other
                  </option>

                  <option value="prefer-not-to-say">
                    Prefer Not To Say
                  </option>
                </select>
              </label>

              <label className="field">
                <span>
                  Date of Birth
                </span>

                <input
                  type="date"
                  name="dateOfBirth"
                  value={
                    form.dateOfBirth
                  }
                  onChange={
                    change
                  }
                />
              </label>

              <label className="field">
                <span>
                  Address
                </span>

                <input
                  name="address"
                  value={
                    form.address
                  }
                  onChange={
                    change
                  }
                />
              </label>
            </div>
          </details>

          {editing && (
            <Alert type="info">
              Need to change this
              employee's shift? Open
              the Shifts page and use
              <strong>
                {" "}Change Shift
              </strong>
              . The system will keep
              the previous shift
              history automatically.
            </Alert>
          )}

          {/* ========================================================= */}
          {/* Actions */}
          {/* ========================================================= */}

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
                  : "Add Employee"}
            </button>
          </div>
        </form>
      </Modal>
      {lifecycleEmployee && (
        <EmployeeLifecycle
          employee={
            lifecycleEmployee
          }

          employees={
            employees
          }

          departments={
            departments
          }

          masterData={
            masterData
          }

          onClose={() =>
            setLifecycleEmployee(
              null
            )
          }

          onUpdated={async () => {
            setLifecycleEmployee(
              null
            );

            setNotice(
              "Employee HR action saved successfully."
            );

            await load();
          }}
        />
      )}
    </>
  );
}