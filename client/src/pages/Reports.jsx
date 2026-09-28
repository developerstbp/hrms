import {
  useEffect,
  useMemo,
  useState,
} from "react";

import * as XLSX from "xlsx";

import api from "../services/api";

import {
  Alert,
  Badge,
  Card,
  EmptyState,
  PageHeader,
} from "../Components/UI";

import {
  formatDate,
  fullName,
  getError,
} from "../utils/format";

import {
  useAuth,
} from "../context/AuthContext";

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

const monthStart = () => {
  const date =
    new Date();

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  )
    .toISOString()
    .slice(
      0,
      10
    );
};

const currentYear = () =>
  new Date().getFullYear();

const normalizeData = (
  data,
  keys = []
) => {
  if (
    Array.isArray(
      data
    )
  ) {
    return data;
  }

  for (
    const key of
    keys
  ) {
    if (
      Array.isArray(
        data?.[key]
      )
    ) {
      return data[key];
    }
  }

  return [];
};

const safeName = (
  value
) => {
  if (
    !value
  ) {
    return "—";
  }

  if (
    typeof value ===
    "string"
  ) {
    return value;
  }

  return (
    value.name ||
    value.title ||
    value.label ||
    "—"
  );
};

const employeeName = (
  employee
) => {
  if (
    !employee
  ) {
    return "—";
  }

  try {
    return fullName(
      employee
    );
  } catch {
    return [
      employee.firstName,
      employee.lastName,
    ]
      .filter(
        Boolean
      )
      .join(" ") ||
      employee.employeeCode ||
      "—";
  }
};

/*
|--------------------------------------------------------------------------
| Component
|--------------------------------------------------------------------------
*/

export default function Reports() {
  const {
    hasPermission,
  } =
    useAuth();

  const canEmployees =
    hasPermission(
      "employees.view"
    ) ||
    hasPermission(
      "employees.manage"
    );

  const canAttendance =
    hasPermission(
      "attendance.view"
    ) ||
    hasPermission(
      "attendance.manage"
    );

  const canLeave =
    hasPermission(
      "leave.team"
    ) ||
    hasPermission(
      "leave.approve"
    ) ||
    hasPermission(
      "leave.policies"
    );

  /*
  |--------------------------------------------------------------------------
  | Available Tabs
  |--------------------------------------------------------------------------
  */

  const tabs =
    useMemo(
      () => {
        const result =
          [];

        if (
          canEmployees
        ) {
          result.push(
            {
              key:
                "headcount",

              label:
                "Headcount",
            }
          );
        }

        if (
          canAttendance
        ) {
          result.push(
            {
              key:
                "attendance",

              label:
                "Attendance",
            }
          );
        }

        if (
          canLeave
        ) {
          result.push(
            {
              key:
                "leave",

              label:
                "Leave",
            }
          );
        }

        if (
          canEmployees
        ) {
          result.push(
            {
              key:
                "movements",

              label:
                "Employee Movements",
            }
          );
        }

        return result;
      },
      [
        canEmployees,
        canAttendance,
        canLeave,
      ]
    );

  const [
    activeTab,
    setActiveTab,
  ] = useState(
    tabs[0]?.key ||
    ""
  );

  const [
    rows,
    setRows,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  /*
  |--------------------------------------------------------------------------
  | Filters
  |--------------------------------------------------------------------------
  */

  const [
    attendanceFilters,
    setAttendanceFilters,
  ] = useState({
    from:
      monthStart(),

    to:
      today(),

    status:
      "",
  });

  const [
    leaveFilters,
    setLeaveFilters,
  ] = useState({
    year:
      currentYear(),

    status:
      "",
  });

  const [
    movementFilters,
    setMovementFilters,
  ] = useState({
    from:
      monthStart(),

    to:
      today(),
  });

  /*
  |--------------------------------------------------------------------------
  | Load Report
  |--------------------------------------------------------------------------
  */

  const load =
    async () => {
      if (
        !activeTab
      ) {
        return;
      }

      try {
        setLoading(
          true
        );

        setError("");

        let response;

        if (
          activeTab ===
          "headcount"
        ) {
          response =
            await api.get(
              "/reports/headcount"
            );

          setRows(
            normalizeData(
              response.data,
              [
                "employees",
                "rows",
                "data",
              ]
            )
          );
        }

        if (
          activeTab ===
          "attendance"
        ) {
          response =
            await api.get(
              "/reports/attendance",
              {
                params: {
                  from:
                    attendanceFilters.from,

                  to:
                    attendanceFilters.to,

                  status:
                    attendanceFilters.status ||
                    undefined,
                },
              }
            );

          setRows(
            normalizeData(
              response.data,
              [
                "attendance",
                "records",
                "rows",
                "data",
              ]
            )
          );
        }

        if (
          activeTab ===
          "leave"
        ) {
          response =
            await api.get(
              "/reports/leave",
              {
                params: {
                  year:
                    leaveFilters.year,

                  status:
                    leaveFilters.status ||
                    undefined,
                },
              }
            );

          setRows(
            normalizeData(
              response.data,
              [
                "leaves",
                "requests",
                "rows",
                "data",
              ]
            )
          );
        }

        if (
          activeTab ===
          "movements"
        ) {
          response =
            await api.get(
              "/reports/movements",
              {
                params: {
                  from:
                    movementFilters.from,

                  to:
                    movementFilters.to,
                },
              }
            );

          setRows(
            normalizeData(
              response.data,
              [
                "movements",
                "events",
                "rows",
                "data",
              ]
            )
          );
        }
      } catch (err) {
        setRows(
          []
        );

        setError(
          getError(
            err,
            "Unable to load report."
          )
        );
      } finally {
        setLoading(
          false
        );
      }
    };

  useEffect(
    () => {
      load();
    },
    [
      activeTab,
    ]
  );

  /*
  |--------------------------------------------------------------------------
  | Excel Export
  |--------------------------------------------------------------------------
  */

  const exportRows =
    () => {
      if (
        !rows.length
      ) {
        return;
      }

      let exportData =
        [];

      if (
        activeTab ===
        "headcount"
      ) {
        exportData =
          rows.map(
            (
              employee
            ) => ({
              "Employee Code":
                employee.employeeCode ||
                "",

              "Employee Name":
                employeeName(
                  employee
                ),

              Department:
                safeName(
                  employee.departmentId
                ),

              Designation:
                safeName(
                  employee.designationId
                ) ||
                employee.designation ||
                "",

              Location:
                safeName(
                  employee.locationId
                ),

              Grade:
                safeName(
                  employee.gradeId
                ),

              Manager:
                employeeName(
                  employee.managerId
                ),

              Status:
                employee.status ||
                "",

              "Joining Date":
                employee.joiningDate
                  ? formatDate(
                      employee.joiningDate
                    )
                  : "",
            })
          );
      }

      if (
        activeTab ===
        "attendance"
      ) {
        exportData =
          rows.map(
            (
              record
            ) => ({
              Date:
                record.date ||
                record.dateKey ||
                "",

              "Employee Code":
                record.employeeId
                  ?.employeeCode ||
                "",

              "Employee Name":
                employeeName(
                  record.employeeId
                ),

              Department:
                safeName(
                  record.employeeId
                    ?.departmentId
                ),

              Status:
                record.status ||
                "",

              "Check In":
                record.checkIn
                  ? new Date(
                      record.checkIn
                    ).toLocaleString()
                  : "",

              "Check Out":
                record.checkOut
                  ? new Date(
                      record.checkOut
                    ).toLocaleString()
                  : "",

              "Worked Minutes":
                record.workedMinutes ??
                "",

              "Late Minutes":
                record.lateMinutes ??
                "",

              "Early Exit Minutes":
                record.earlyExitMinutes ??
                "",

              "Overtime Minutes":
                record.overtimeMinutes ??
                "",

              "Work Mode":
                record.workMode ||
                "",

              Exception:
                record.isException
                  ? "Yes"
                  : "No",
            })
          );
      }

      if (
        activeTab ===
        "leave"
      ) {
        exportData =
          rows.map(
            (
              request
            ) => ({
              "Employee Code":
                request.employeeId
                  ?.employeeCode ||
                "",

              "Employee Name":
                employeeName(
                  request.employeeId
                ),

              Department:
                safeName(
                  request.employeeId
                    ?.departmentId
                ),

              "Leave Type":
                request.leaveTypeId
                  ?.name ||
                "",

              "Start Date":
                request.startDate
                  ? formatDate(
                      request.startDate
                    )
                  : "",

              "End Date":
                request.endDate
                  ? formatDate(
                      request.endDate
                    )
                  : "",

              Days:
                request.days ??
                "",

              Status:
                request.status ||
                "",

              Reason:
                request.reason ||
                "",

              "Requested By":
                request.requestedByUserId
                  ? [
                      request
                        .requestedByUserId
                        .firstName,

                      request
                        .requestedByUserId
                        .lastName,
                    ]
                      .filter(
                        Boolean
                      )
                      .join(" ")
                  : "",
            })
          );
      }

      if (
        activeTab ===
        "movements"
      ) {
        exportData =
          rows.map(
            (
              event
            ) => ({
              "Employee Code":
                event.employeeId
                  ?.employeeCode ||
                "",

              "Employee Name":
                employeeName(
                  event.employeeId
                ),

              Action:
                event.action ||
                event.type ||
                "",

              "Effective Date":
                event.effectiveDate
                  ? formatDate(
                      event.effectiveDate
                    )
                  : "",

              Reason:
                event.reason ||
                "",

              "Performed By":
                event.performedByUserId
                  ? [
                      event
                        .performedByUserId
                        .firstName,

                      event
                        .performedByUserId
                        .lastName,
                    ]
                      .filter(
                        Boolean
                      )
                      .join(" ")
                  : "",

              Notes:
                event.notes ||
                "",
            })
          );
      }

      const worksheet =
        XLSX.utils.json_to_sheet(
          exportData
        );

      const workbook =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Report"
      );

      XLSX.writeFile(
        workbook,
        `HRMS-${activeTab}-report.xlsx`
      );
    };

  /*
  |--------------------------------------------------------------------------
  | Filters UI
  |--------------------------------------------------------------------------
  */

  const filtersUI =
    () => {
      if (
        activeTab ===
        "attendance"
      ) {
        return (
          <div className="form-grid three">
            <label className="field">
              <span>
                From
              </span>

              <input
                type="date"
                value={
                  attendanceFilters.from
                }
                onChange={(
                  event
                ) =>
                  setAttendanceFilters(
                    {
                      ...attendanceFilters,

                      from:
                        event
                          .target
                          .value,
                    }
                  )
                }
              />
            </label>

            <label className="field">
              <span>
                To
              </span>

              <input
                type="date"
                value={
                  attendanceFilters.to
                }
                onChange={(
                  event
                ) =>
                  setAttendanceFilters(
                    {
                      ...attendanceFilters,

                      to:
                        event
                          .target
                          .value,
                    }
                  )
                }
              />
            </label>

            <label className="field">
              <span>
                Status
              </span>

              <select
                value={
                  attendanceFilters.status
                }
                onChange={(
                  event
                ) =>
                  setAttendanceFilters(
                    {
                      ...attendanceFilters,

                      status:
                        event
                          .target
                          .value,
                    }
                  )
                }
              >
                <option value="">
                  All statuses
                </option>

                <option value="present">
                  Present
                </option>

                <option value="late">
                  Late
                </option>

                <option value="absent">
                  Absent
                </option>

                <option value="half-day">
                  Half Day
                </option>

                <option value="on-leave">
                  On Leave
                </option>

                <option value="off">
                  Off
                </option>

                <option value="holiday">
                  Holiday
                </option>

                <option value="incomplete">
                  Incomplete
                </option>
              </select>
            </label>
          </div>
        );
      }

      if (
        activeTab ===
        "leave"
      ) {
        return (
          <div className="form-grid two">
            <label className="field">
              <span>
                Year
              </span>

              <input
                type="number"
                min="2020"
                max="2100"
                value={
                  leaveFilters.year
                }
                onChange={(
                  event
                ) =>
                  setLeaveFilters(
                    {
                      ...leaveFilters,

                      year:
                        event
                          .target
                          .value,
                    }
                  )
                }
              />
            </label>

            <label className="field">
              <span>
                Status
              </span>

              <select
                value={
                  leaveFilters.status
                }
                onChange={(
                  event
                ) =>
                  setLeaveFilters(
                    {
                      ...leaveFilters,

                      status:
                        event
                          .target
                          .value,
                    }
                  )
                }
              >
                <option value="">
                  All statuses
                </option>

                <option value="pending_hr">
                  Pending HR
                </option>

                <option value="under_review">
                  Under Review
                </option>

                <option value="more_info_required">
                  More Info Required
                </option>

                <option value="on_hold">
                  On Hold
                </option>

                <option value="approved">
                  Approved
                </option>

                <option value="rejected">
                  Rejected
                </option>

                <option value="cancelled">
                  Cancelled
                </option>
              </select>
            </label>
          </div>
        );
      }

      if (
        activeTab ===
        "movements"
      ) {
        return (
          <div className="form-grid two">
            <label className="field">
              <span>
                From
              </span>

              <input
                type="date"
                value={
                  movementFilters.from
                }
                onChange={(
                  event
                ) =>
                  setMovementFilters(
                    {
                      ...movementFilters,

                      from:
                        event
                          .target
                          .value,
                    }
                  )
                }
              />
            </label>

            <label className="field">
              <span>
                To
              </span>

              <input
                type="date"
                value={
                  movementFilters.to
                }
                onChange={(
                  event
                ) =>
                  setMovementFilters(
                    {
                      ...movementFilters,

                      to:
                        event
                          .target
                          .value,
                    }
                  )
                }
              />
            </label>
          </div>
        );
      }

      return (
        <p>
          Current employee
          headcount and job
          information.
        </p>
      );
    };

  /*
  |--------------------------------------------------------------------------
  | Table
  |--------------------------------------------------------------------------
  */

  const renderTable =
    () => {
      if (
        loading
      ) {
        return (
          <p>
            Loading report...
          </p>
        );
      }

      if (
        !rows.length
      ) {
        return (
          <EmptyState
            title="No report data"
            description="No records were found for the selected report and filters."
          />
        );
      }

      if (
        activeTab ===
        "headcount"
      ) {
        return (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    Employee
                  </th>

                  <th>
                    Department
                  </th>

                  <th>
                    Designation
                  </th>

                  <th>
                    Location
                  </th>

                  <th>
                    Grade
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
                {rows.map(
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
                          {employeeName(
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
                        {safeName(
                          employee.departmentId
                        )}
                      </td>

                      <td>
                        {safeName(
                          employee.designationId
                        )}
                      </td>

                      <td>
                        {safeName(
                          employee.locationId
                        )}
                      </td>

                      <td>
                        {safeName(
                          employee.gradeId
                        )}
                      </td>

                      <td>
                        {employeeName(
                          employee.managerId
                        )}
                      </td>

                      <td>
                        <Badge
                          value={
                            employee.status ||
                            "active"
                          }
                        />
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        );
      }

      if (
        activeTab ===
        "attendance"
      ) {
        return (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    Date
                  </th>

                  <th>
                    Employee
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Check In
                  </th>

                  <th>
                    Check Out
                  </th>

                  <th>
                    Worked
                  </th>

                  <th>
                    Late
                  </th>

                  <th>
                    Exception
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map(
                  (
                    record
                  ) => (
                    <tr
                      key={
                        record._id
                      }
                    >
                      <td>
                        {record.dateKey ||
                          (
                            record.date
                              ? formatDate(
                                  record.date
                                )
                              : "—"
                          )}
                      </td>

                      <td>
                        <strong>
                          {employeeName(
                            record.employeeId
                          )}
                        </strong>

                        <small>
                          {
                            record.employeeId
                              ?.employeeCode
                          }
                        </small>
                      </td>

                      <td>
                        <Badge
                          value={
                            record.status ||
                            "—"
                          }
                        />
                      </td>

                      <td>
                        {record.checkIn
                          ? new Date(
                              record.checkIn
                            ).toLocaleTimeString(
                              [],
                              {
                                hour:
                                  "2-digit",

                                minute:
                                  "2-digit",
                              }
                            )
                          : "—"}
                      </td>

                      <td>
                        {record.checkOut
                          ? new Date(
                              record.checkOut
                            ).toLocaleTimeString(
                              [],
                              {
                                hour:
                                  "2-digit",

                                minute:
                                  "2-digit",
                              }
                            )
                          : "—"}
                      </td>

                      <td>
                        {record.workedMinutes ??
                          0}{" "}
                        min
                      </td>

                      <td>
                        {record.lateMinutes ??
                          0}{" "}
                        min
                      </td>

                      <td>
                        <Badge
                          value={
                            record.isException
                              ? "exception"
                              : "clear"
                          }
                        />
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        );
      }

      if (
        activeTab ===
        "leave"
      ) {
        return (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    Employee
                  </th>

                  <th>
                    Leave Type
                  </th>

                  <th>
                    Period
                  </th>

                  <th>
                    Days
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Reason
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map(
                  (
                    request
                  ) => (
                    <tr
                      key={
                        request._id
                      }
                    >
                      <td>
                        <strong>
                          {employeeName(
                            request.employeeId
                          )}
                        </strong>

                        <small>
                          {
                            request.employeeId
                              ?.employeeCode
                          }
                        </small>
                      </td>

                      <td>
                        {request.leaveTypeId
                          ?.name ||
                          "—"}
                      </td>

                      <td>
                        {formatDate(
                          request.startDate
                        )}{" "}
                        —{" "}
                        {formatDate(
                          request.endDate
                        )}
                      </td>

                      <td>
                        {
                          request.days
                        }
                      </td>

                      <td>
                        <Badge
                          value={
                            request.status
                          }
                        />
                      </td>

                      <td>
                        {request.reason ||
                          "—"}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        );
      }

      return (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  Employee
                </th>

                <th>
                  Action
                </th>

                <th>
                  Effective Date
                </th>

                <th>
                  Reason
                </th>

                <th>
                  Performed By
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map(
                (
                  event
                ) => (
                  <tr
                    key={
                      event._id
                    }
                  >
                    <td>
                      <strong>
                        {employeeName(
                          event.employeeId
                        )}
                      </strong>

                      <small>
                        {
                          event.employeeId
                            ?.employeeCode
                        }
                      </small>
                    </td>

                    <td>
                      <Badge
                        value={
                          event.action ||
                          event.type ||
                          "movement"
                        }
                      />
                    </td>

                    <td>
                      {event.effectiveDate
                        ? formatDate(
                            event.effectiveDate
                          )
                        : "—"}
                    </td>

                    <td>
                      {event.reason ||
                        "—"}
                    </td>

                    <td>
                      {event.performedByUserId
                        ? [
                            event
                              .performedByUserId
                              .firstName,

                            event
                              .performedByUserId
                              .lastName,
                          ]
                            .filter(
                              Boolean
                            )
                            .join(" ")
                        : "—"}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      );
    };

  /*
  |--------------------------------------------------------------------------
  | No Access
  |--------------------------------------------------------------------------
  */

  if (
    !tabs.length
  ) {
    return (
      <>
        <PageHeader
          title="Reports"
          description="HRMS reporting and exports."
        />

        <Card>
          <EmptyState
            title="No report access"
            description="Your account does not currently have access to HRMS reports."
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="Review and export employee, attendance, leave and HR movement data."
        action={
          rows.length ? (
            <button
              className="button secondary"
              onClick={
                exportRows
              }
            >
              Export Excel
            </button>
          ) : null
        }
      />

      {error && (
        <Alert type="error">
          {error}
        </Alert>
      )}

      <Card>
        <div className="tab-row">
          {tabs.map(
            (
              tab
            ) => (
              <button
                key={
                  tab.key
                }
                className={
                  activeTab ===
                  tab.key
                    ? "button primary"
                    : "button secondary"
                }
                onClick={() => {
                  setActiveTab(
                    tab.key
                  );

                  setRows(
                    []
                  );
                }}
              >
                {
                  tab.label
                }
              </button>
            )
          )}
        </div>
      </Card>

      <Card>
        <div className="card-head">
          <div>
            <h2>
              {
                tabs.find(
                  (
                    tab
                  ) =>
                    tab.key ===
                    activeTab
                )?.label
              }{" "}
              Report
            </h2>

            <p>
              Apply filters and
              refresh the report
              before exporting.
            </p>
          </div>

          <button
            className="button primary"
            disabled={
              loading
            }
            onClick={
              load
            }
          >
            {loading
              ? "Loading..."
              : "Generate Report"}
          </button>
        </div>

        {
          filtersUI()
        }
      </Card>

      <Card>
        <div className="card-head">
          <div>
            <h2>
              Results
            </h2>

            <p>
              {
                rows.length
              }{" "}
              record(s) found.
            </p>
          </div>
        </div>

        {
          renderTable()
        }
      </Card>
    </>
  );
}