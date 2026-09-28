import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import api from "../services/api";

import {
  useAuth,
} from "../context/AuthContext";

import {
  Alert,
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
} from "../Components/UI";

import {
  formatDate,
  fullName,
  getError,
} from "../utils/format";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const hoursLabel = (
  minutes = 0
) => {
  const total =
    Number(
      minutes ||
        0
    );

  const hours =
    Math.floor(
      total /
        60
    );

  const remaining =
    total %
    60;

  return remaining
    ? `${hours}h ${remaining}m`
    : `${hours}h`;
};

const pretty = (
  value = ""
) =>
  String(
    value
  )
    .replaceAll(
      "_",
      " "
    )
    .replaceAll(
      "-",
      " "
    )
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character.toUpperCase()
    );

const graphColor = (
  status
) => {
  if (
    status ===
    "complete"
  ) {
    return "#22c55e";
  }

  if (
    status ===
    "short"
  ) {
    return "#ef4444";
  }

  if (
    status ===
    "leave"
  ) {
    return "#8b5cf6";
  }

  return "#cbd5e1";
};

/*
|--------------------------------------------------------------------------
| Attendance Graph
|--------------------------------------------------------------------------
*/

function AttendanceHoursChart({
  graph,
}) {
  const [
    range,
    setRange,
  ] =
    useState(
      "weekly"
    );

  const rows =
    graph?.[
      range
    ] ||
    [];

  const maxHours =
    useMemo(
      () => {
        const maximum =
          Math.max(
            1,

            ...rows.map(
              (
                item
              ) =>
                Math.max(
                  Number(
                    item.workedHours ||
                      0
                  ),

                  Number(
                    item.expectedHours ||
                      0
                  )
                )
            )
          );

        return Math.ceil(
          maximum
        );
      },

      [
        rows,
      ]
    );

  const complete =
    rows.filter(
      (
        item
      ) =>
        item.comparisonStatus ===
        "complete"
    ).length;

  const short =
    rows.filter(
      (
        item
      ) =>
        item.comparisonStatus ===
        "short"
    ).length;

  const totalMinutes =
    rows.reduce(
      (
        total,
        item
      ) =>
        total +
        Number(
          item.workedMinutes ||
            0
        ),

      0
    );

  const workingRows =
    rows.filter(
      (
        item
      ) =>
        Number(
          item.workedMinutes ||
            0
        ) >
        0
    );

  const average =
    workingRows.length
      ? Math.round(
          totalMinutes /
            workingRows.length
        )
      : 0;

  return (
    <Card>
      <div className="card-head">
        <div>
          <h2>
            Attendance Hours
          </h2>

          <p>
            Worked hours compared
            with your assigned
            shift.
          </p>
        </div>

        <div className="button-row">
          <button
            type="button"
            className={`button ${
              range ===
              "weekly"
                ? "primary"
                : "secondary"
            }`}
            onClick={() =>
              setRange(
                "weekly"
              )
            }
          >
            Weekly
          </button>

          <button
            type="button"
            className={`button ${
              range ===
              "monthly"
                ? "primary"
                : "secondary"
            }`}
            onClick={() =>
              setRange(
                "monthly"
              )
            }
          >
            Monthly
          </button>
        </div>
      </div>

      {rows.length ? (
        <>
          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(4, minmax(100px, 1fr))",

              gap:
                10,

              marginBottom:
                22,
            }}
          >
            <div>
              <small>
                Full Hours
              </small>

              <strong
                style={{
                  display:
                    "block",

                  fontSize:
                    20,
                }}
              >
                {complete}
              </strong>
            </div>

            <div>
              <small>
                Short Hours
              </small>

              <strong
                style={{
                  display:
                    "block",

                  fontSize:
                    20,
                }}
              >
                {short}
              </strong>
            </div>

            <div>
              <small>
                Total Hours
              </small>

              <strong
                style={{
                  display:
                    "block",

                  fontSize:
                    20,
                }}
              >
                {hoursLabel(
                  totalMinutes
                )}
              </strong>
            </div>

            <div>
              <small>
                Average
              </small>

              <strong
                style={{
                  display:
                    "block",

                  fontSize:
                    20,
                }}
              >
                {hoursLabel(
                  average
                )}
              </strong>
            </div>
          </div>

          <div
            style={{
              overflowX:
                "auto",

              paddingBottom:
                8,
            }}
          >
            <div
              style={{
                display:
                  "flex",

                alignItems:
                  "flex-end",

                gap:
                  range ===
                  "monthly"
                    ? 6
                    : 16,

                minWidth:
                  range ===
                  "monthly"
                    ? Math.max(
                        700,
                        rows.length *
                          42
                      )
                    : 520,

                height:
                  260,

                borderBottom:
                  "1px solid #e2e8f0",

                padding:
                  "20px 6px 0",
              }}
            >
              {rows.map(
                (
                  item
                ) => {
                  const barHeight =
                    Math.max(
                      4,

                      (
                        Number(
                          item.workedHours ||
                            0
                        ) /
                        maxHours
                      ) *
                        180
                    );

                  const targetHeight =
                    (
                      Number(
                        item.expectedHours ||
                          0
                      ) /
                      maxHours
                    ) *
                    180;

                  return (
                    <div
                      key={
                        item.date
                      }
                      title={`${item.dateLabel}
Worked: ${item.workedHours || 0}h
Required: ${item.expectedHours || 0}h
${item.shiftName || ""}
${item.calendarLabel || ""}`}
                      style={{
                        flex:
                          "1 0 32px",

                        maxWidth:
                          range ===
                          "weekly"
                            ? 80
                            : 38,

                        minWidth:
                          30,

                        height:
                          "220px",

                        display:
                          "flex",

                        flexDirection:
                          "column",

                        justifyContent:
                          "flex-end",

                        alignItems:
                          "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize:
                            10,

                          marginBottom:
                            5,

                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {item.workedHours >
                        0
                          ? `${item.workedHours}h`
                          : ""}
                      </span>

                      <div
                        style={{
                          height:
                            180,

                          width:
                            "100%",

                          position:
                            "relative",

                          display:
                            "flex",

                          alignItems:
                            "flex-end",

                          justifyContent:
                            "center",
                        }}
                      >
                        {item.expectedHours >
                          0 && (
                          <div
                            style={{
                              position:
                                "absolute",

                              bottom:
                                targetHeight,

                              width:
                                "100%",

                              borderTop:
                                "1px dashed #64748b",

                              zIndex:
                                2,
                            }}
                          />
                        )}

                        <div
                          style={{
                            width:
                              range ===
                              "weekly"
                                ? 32
                                : 20,

                            height:
                              barHeight,

                            borderRadius:
                              "6px 6px 2px 2px",

                            background:
                              graphColor(
                                item.comparisonStatus
                              ),

                            transition:
                              "height .2s ease",
                          }}
                        />
                      </div>

                      <strong
                        style={{
                          fontSize:
                            11,

                          marginTop:
                            7,
                        }}
                      >
                        {range ===
                        "weekly"
                          ? item.day
                          : item.dateLabel?.split(
                              " "
                            )[0]}
                      </strong>

                      {range ===
                        "weekly" && (
                        <small
                          style={{
                            fontSize:
                              9,
                          }}
                        >
                          {
                            item.dateLabel
                          }
                        </small>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          </div>

          <div
            style={{
              display:
                "flex",

              gap:
                16,

              flexWrap:
                "wrap",

              marginTop:
                16,

              fontSize:
                12,
            }}
          >
            <span>
              🟢 Full / Above Shift
            </span>

            <span>
              🔴 Short Hours
            </span>

            <span>
              🟣 Leave
            </span>

            <span>
              ⚪ Off / Holiday
            </span>

            <span>
              ┄ Required Shift Hours
            </span>
          </div>
        </>
      ) : (
        <EmptyState
          title="No attendance history yet"
          description="Your worked-hours graph will appear after attendance is processed."
        />
      )}
    </Card>
  );
}

/*
|--------------------------------------------------------------------------
| Dashboard
|--------------------------------------------------------------------------
*/

export default function Dashboard() {
  const {
    user,
    employee,
    hasPermission,
  } =
    useAuth();

  const navigate =
    useNavigate();

  const [
    data,
    setData,
  ] =
    useState(null);

  const [
    balances,
    setBalances,
  ] =
    useState([]);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
  dashboardEmployees,
  setDashboardEmployees,
] =
  useState([]);

const [
  selectedEmployeeId,
  setSelectedEmployeeId,
] =
  useState("");

  const role =
    user?.role ||
    "employee";

  const isOrganizationRole =
    [
      "admin",
      "hr",
    ].includes(
      role
    );

  const isTeamRole =
    [
      "manager",
      "hod",
    ].includes(
      role
    );

  const selectedDashboard =
  role ===
    "admin" &&
  Boolean(
    selectedEmployeeId
  );

const viewedEmployee =
  data?.viewedEmployee ||
  employee;

const showManagement =
  (
    isOrganizationRole ||
    isTeamRole
  ) &&
  !selectedDashboard;

const showPersonal =
  Boolean(
    viewedEmployee
  );

  /*
  |--------------------------------------------------------------------------
  | Load
  |--------------------------------------------------------------------------
  */

  const load =
    async () => {
      try {
        const dashboardUrl =
          selectedEmployeeId
            ? `/dashboard?employeeId=${selectedEmployeeId}`
            : "/dashboard";

        const dashboardResponse =
          await api.get(
            dashboardUrl
          );

        setData(
          dashboardResponse.data
        );

        if (
          selectedEmployeeId &&
          role ===
            "admin"
        ) {
          try {
            const balanceResponse =
              await api.get(
                `/leaves/balances/${selectedEmployeeId}`
              );

            setBalances(
              balanceResponse.data ||
                []
            );
          } catch {
            setBalances(
              []
            );
          }
        } else if (
          employee &&
          hasPermission(
            "leave.self"
          )
        ) {
          try {
            const balanceResponse =
              await api.get(
                "/leaves/balances/me"
              );

            setBalances(
              balanceResponse.data ||
                []
            );
          } catch {
            setBalances(
              []
            );
          }
        } else {
          setBalances(
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
            "Unable to load dashboard."
          )
        );
      }
    };

  useEffect(
    () => {
      load();
    },
    [
      selectedEmployeeId,
    ]
  );

  useEffect(
    () => {
      if (
        role !==
        "admin"
      ) {
        return;
      }

      const loadEmployees =
        async () => {
          try {
            const response =
              await api.get(
                "/employees"
              );

            setDashboardEmployees(
              response.data ||
                []
            );
          } catch {
            setDashboardEmployees(
              []
            );
          }
        };

      loadEmployees();
    },
    [
      role,
    ]
  );

  /*
  |--------------------------------------------------------------------------
  | Attendance Action
  |--------------------------------------------------------------------------
  */

  const attendanceAction =
    async (
      type
    ) => {
      try {
        setBusy(
          true
        );

        await api.post(
          `/attendance/${type}`
        );

        await load();
      } catch (err) {
        setError(
          getError(
            err
          )
        );
      } finally {
        setBusy(
          false
        );
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Data
  |--------------------------------------------------------------------------
  */

  const stats =
    data?.stats ||
    {};

  const breakdown =
    stats.attendanceBreakdown ||
    {};

  /*
  | Supports both:
  |
  | data.attendanceGraph
  |
  | and old:
  |
  | data.stats.attendanceGraph
  */

  const attendanceGraph =
    data?.attendanceGraph ||
    stats.attendanceGraph ||
    {
      weekly:
        [],

      monthly:
        [],
    };

  const todayWork =
    data
      ?.workCalendar
      ?.today;

  const nextSaturday =
    data
      ?.workCalendar
      ?.nextSaturday;

  const presentToday =
    Number(
      breakdown.present ||
        0
    ) +
    Number(
      breakdown.late ||
        0
    );

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <>
      <PageHeader
        title={
          selectedDashboard &&
          viewedEmployee
            ? `${fullName(viewedEmployee)}'s Dashboard`
            : `Good day, ${
                user?.firstName ||
                "there"
              }`
        }

        description={
          selectedDashboard
            ? "Employee attendance, shift, leave and workday overview."
            : isOrganizationRole
              ? "Your organization overview for today."
              : isTeamRole
                ? "Your workday and team overview."
                : "Everything you need for your workday."
        }

        action={
          role ===
          "admin" ? (
            <label
              className="field"
              style={{
                minWidth:
                  280,
              }}
            >
              <span>
                View Dashboard
              </span>

              <select
                value={
                  selectedEmployeeId
                }
                onChange={(
                  event
                ) =>
                  setSelectedEmployeeId(
                    event.target.value
                  )
                }
              >
                <option value="">
                  Organization Overview
                </option>

                {dashboardEmployees.map(
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
                      {fullName(
                        item
                      )}
                      {" — "}
                      {
                        item.employeeCode
                      }
                    </option>
                  )
                )}
              </select>
            </label>
          ) : null
        }
      />

      {error && (
        <Alert type="error">
          {error}
        </Alert>
      )}

      {selectedDashboard &&
        viewedEmployee && (
          <Card>
            <div className="card-head">
              <div>
                <span className="eyebrow">
                  Employee Dashboard
                </span>

                <h2>
                  {fullName(
                    viewedEmployee
                  )}
                </h2>

                <p>
                  {viewedEmployee.employeeCode}
                  {" · "}
                  {viewedEmployee
                    .departmentId
                    ?.name ||
                    "No Department"}
                </p>
              </div>

              <Badge
                value={
                  viewedEmployee.status ||
                  "active"
                }
              />
            </div>

            <div
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "repeat(auto-fit, minmax(160px, 1fr))",

                gap:
                  12,
              }}
            >
              <div>
                <small>
                  Designation
                </small>

                <strong
                  style={{
                    display:
                      "block",
                  }}
                >
                  {viewedEmployee.designation ||
                    viewedEmployee
                      .designationId
                      ?.name ||
                    "—"}
                </strong>
              </div>

              <div>
                <small>
                  Manager
                </small>

                <strong
                  style={{
                    display:
                      "block",
                  }}
                >
                  {fullName(
                    viewedEmployee.managerId
                  ) ||
                    "—"}
                </strong>
              </div>

              <div>
                <small>
                  Joining Date
                </small>

                <strong
                  style={{
                    display:
                      "block",
                  }}
                >
                  {formatDate(
                    viewedEmployee.joiningDate
                  )}
                </strong>
              </div>

              <div>
                <small>
                  Employment Type
                </small>

                <strong
                  style={{
                    display:
                      "block",
                  }}
                >
                  {viewedEmployee.employmentType ||
                    "—"}
                </strong>
              </div>
            </div>
          </Card>
        )}

      {/* ============================================================= */}
      {/* ADMIN / HR / MANAGER / HOD SUMMARY */}
      {/* ============================================================= */}

      {showManagement && (
        <div className="stats-grid">
          <StatCard
            label={
              isOrganizationRole
                ? "Active Employees"
                : "Team Members"
            }
            value={
              stats.activeEmployeeCount ??
              "—"
            }
            helper={`${stats.employeeCount ?? 0} total in scope`}
            icon="◎"
          />

          <StatCard
            label="Present Today"
            value={
              presentToday
            }
            helper={`${breakdown.late || 0} late`}
            icon="✓"
          />

          <StatCard
            label="On Leave Today"
            value={
              stats.employeesOnLeave ??
              "—"
            }
            helper="Approved leave"
            icon="□"
          />

          <StatCard
            label="Pending Leave"
            value={
              stats.pendingLeaves ??
              "—"
            }
            helper="Needs review"
            icon="◷"
          />

          {isOrganizationRole && (
            <StatCard
              label="Attendance Issues"
              value={
                stats.openAttendanceExceptions ??
                "—"
              }
              helper="Needs HR review"
              icon="!"
            />
          )}

          {isOrganizationRole && (
            <StatCard
              label="On Notice"
              value={
                stats.employeesOnNotice ??
                "—"
              }
              helper="Employee lifecycle"
              icon="→"
            />
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* PERSONAL DAY */}
      {/* ============================================================= */}

      {showPersonal && (
        <div className="dashboard-grid">
          <Card>
            <div className="card-head">
              <div>
                <span className="eyebrow">
                  {selectedDashboard
                    ? `${viewedEmployee?.firstName || "Employee"}'s Day`
                    : "My Day"}
                </span>

                <h2>
                  {data
                    ?.myShift
                    ?.snapshot
                    ?.name ||
                    "My Shift"}
                </h2>

                <p>
                  {data
                    ?.myShift
                    ?.snapshot
                    ?.startTime
                    ? `${data.myShift.snapshot.startTime} — ${data.myShift.snapshot.endTime}`
                    : "No shift assigned"}
                </p>
              </div>

              {data
                ?.myTodayAttendance
                ?.status && (
                <Badge
                  value={
                    data.myTodayAttendance.status
                  }
                />
              )}
            </div>

            <div className="time-pair">
              <div>
                <span>
                  Check In
                </span>

                <strong>
                  {data
                    ?.myTodayAttendance
                    ?.checkIn ||
                    "Not yet"}
                </strong>
              </div>

              <div>
                <span>
                  Check Out
                </span>

                <strong>
                  {data
                    ?.myTodayAttendance
                    ?.checkOut ||
                    "Not yet"}
                </strong>
              </div>
            </div>

            {hasPermission(
              "attendance.self"
            ) && (
              <div
                className="button-row"
                style={{
                  marginTop:
                    18,
                }}
              >
                {!selectedDashboard &&
                  !data
                    ?.myTodayAttendance
                    ?.checkIn && (
                  <button
                    className="button primary"
                    disabled={
                      busy
                    }
                    onClick={() =>
                      attendanceAction(
                        "check-in"
                      )
                    }
                  >
                    Check In
                  </button>
                )}

                {!selectedDashboard &&
                  data
                    ?.myTodayAttendance
                    ?.checkIn &&
                  !data
                    ?.myTodayAttendance
                    ?.checkOut && (
                    <button
                      className="button primary"
                      disabled={
                        busy
                      }
                      onClick={() =>
                        attendanceAction(
                          "check-out"
                        )
                      }
                    >
                      Check Out
                    </button>
                  )}

                <button
                  className="button secondary"
                  onClick={() =>
                    navigate(
                      "/attendance"
                    )
                  }
                >
                  My Attendance
                </button>
              </div>
            )}
          </Card>

          <Card>
            <div className="card-head">
              <div>
                <span className="eyebrow">
                  Today's Schedule
                </span>

                <h2>
                  {todayWork?.label ||
                    "Work Calendar"}
                </h2>

                <p>
                  {todayWork?.workMode
                    ? pretty(
                        todayWork.workMode
                      )
                    : pretty(
                        todayWork?.dayType ||
                          ""
                      )}
                </p>
              </div>

              {todayWork && (
                <Badge
                  value={
                    todayWork.workMode ||
                    todayWork.dayType ||
                    "off"
                  }
                />
              )}
            </div>

            {todayWork ? (
              <>
                <p>
                  {todayWork.policyName ||
                    "Company work schedule"}
                </p>

                <button
                  className="button secondary"
                  onClick={() =>
                    navigate(
                      "/holidays"
                    )
                  }
                >
                  View Work Calendar
                </button>
              </>
            ) : (
              <EmptyState
                title="Work schedule unavailable"
              />
            )}
          </Card>
        </div>
      )}

      {/* ============================================================= */}
      {/* PERSONAL ATTENDANCE GRAPH */}
      {/* ============================================================= */}

      {showPersonal && (
        <AttendanceHoursChart
          graph={
            attendanceGraph
          }
        />
      )}

      {/* ============================================================= */}
      {/* EMPLOYEE LEAVE BALANCE */}
      {/* ============================================================= */}

      {showPersonal &&
        balances.length >
          0 && (
          <Card>
            <div className="card-head">
              <div>
                <h2>
                  {selectedDashboard
                    ? `${viewedEmployee?.firstName || "Employee"}'s Leave Balance`
                    : "My Leave Balance"}
                </h2>

                <p>
                  Current available
                  leave.
                </p>
              </div>

              <button
                className="text-button"
                onClick={() =>
                  navigate(
                    "/leaves"
                  )
                }
              >
                {selectedDashboard
                  ? "Open Leave Management"
                  : "Request Leave"}
              </button>
            </div>

            <div
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "repeat(auto-fit, minmax(170px, 1fr))",

                gap:
                  12,
              }}
            >
              {balances.map(
                (
                  balance
                ) => (
                  <div
                    key={
                      balance
                        .leaveType
                        ?._id
                    }
                    style={{
                      border:
                        "1px solid #e2e8f0",

                      borderRadius:
                        12,

                      padding:
                        16,
                    }}
                  >
                    <small>
                      {balance
                        .leaveType
                        ?.name ||
                        "Leave"}
                    </small>

                    <strong
                      style={{
                        display:
                          "block",

                        fontSize:
                          24,

                        margin:
                          "5px 0",
                      }}
                    >
                      {balance.unlimited
                        ? "No Limit"
                        : balance.available}
                    </strong>

                    {!balance.unlimited && (
                      <small>
                        {
                          balance.approved
                        }{" "}
                        used ·{" "}
                        {
                          balance.pending
                        }{" "}
                        pending
                      </small>
                    )}
                  </div>
                )
              )}
            </div>
          </Card>
        )}

      {selectedDashboard && (
        <Card>
          <div className="card-head">
            <div>
              <h2>
                Recent Leave Requests
              </h2>

              <p>
                Latest leave activity for{" "}
                {fullName(
                  viewedEmployee
                )}.
              </p>
            </div>

            <button
              className="text-button"
              onClick={() =>
                navigate(
                  "/leaves"
                )
              }
            >
              Leave Management
            </button>
          </div>

          {data
            ?.viewedEmployeeRecentLeaves
            ?.length ? (
            <div className="simple-list">
              {data.viewedEmployeeRecentLeaves.map(
                (
                  leave
                ) => (
                  <div
                    className="list-row"
                    key={
                      leave._id
                    }
                  >
                    <div>
                      <strong>
                        {leave
                          .leaveTypeId
                          ?.name ||
                          "Leave"}
                      </strong>

                      <span>
                        {formatDate(
                          leave.startDate
                        )}
                        {" — "}
                        {formatDate(
                          leave.endDate
                        )}
                        {" · "}
                        {leave.days} day(s)
                      </span>
                    </div>

                    <Badge
                      value={
                        leave.status
                      }
                    />
                  </div>
                )
              )}
            </div>
          ) : (
            <EmptyState
              title="No leave history"
            />
          )}
        </Card>
      )}

      {/* ============================================================= */}
      {/* WORK CALENDAR + HOLIDAYS */}
      {/* ============================================================= */}

      <div className="dashboard-grid">
        <Card>
          <div className="card-head">
            <div>
              <h2>
                Upcoming Holidays
              </h2>

              <p>
                Next 30 days
              </p>
            </div>

            <button
              className="text-button"
              onClick={() =>
                navigate(
                  "/holidays"
                )
              }
            >
              Work Calendar
            </button>
          </div>

          {data
            ?.upcomingHolidays
            ?.length ? (
            <div className="simple-list">
              {data.upcomingHolidays.map(
                (
                  holiday
                ) => (
                  <div
                    className="list-row"
                    key={
                      holiday._id
                    }
                  >
                    <div className="calendar-chip">
                      <strong>
                        {new Date(
                          holiday.date
                        ).getUTCDate()}
                      </strong>

                      <span>
                        {new Date(
                          holiday.date
                        ).toLocaleString(
                          "en",
                          {
                            month:
                              "short",

                            timeZone:
                              "UTC",
                          }
                        )}
                      </span>
                    </div>

                    <div>
                      <strong>
                        {
                          holiday.name
                        }
                      </strong>

                      <span>
                        {formatDate(
                          holiday.date
                        )}

                        {holiday.endDate
                          ? ` — ${formatDate(
                              holiday.endDate
                            )}`
                          : ""}
                      </span>
                    </div>

                    <Badge
                      value={
                        holiday.type
                      }
                    />
                  </div>
                )
              )}
            </div>
          ) : (
            <EmptyState
              title="No upcoming holidays"
              description="No holidays are scheduled in the next 30 days."
            />
          )}
        </Card>

        <Card>
          <div className="card-head">
            <div>
              <h2>
                Next Saturday
              </h2>

              <p>
                Upcoming Saturday
                schedule
              </p>
            </div>
          </div>

          {nextSaturday ? (
            <>
              <strong
                style={{
                  display:
                    "block",

                  fontSize:
                    24,

                  marginBottom:
                    8,
                }}
              >
                {
                  nextSaturday.label
                }
              </strong>

              <p>
                {formatDate(
                  nextSaturday.date
                )}

                {nextSaturday.workMode
                  ? ` · ${pretty(
                      nextSaturday.workMode
                    )}`
                  : ""}
              </p>

              <button
                className="button secondary"
                onClick={() =>
                  navigate(
                    "/holidays"
                  )
                }
              >
                Open Work Calendar
              </button>
            </>
          ) : (
            <EmptyState
              title="Saturday schedule unavailable"
            />
          )}
        </Card>
      </div>

      {/* ============================================================= */}
      {/* MANAGEMENT ONLY */}
      {/* ============================================================= */}

      {showManagement && (
        <div className="dashboard-grid">
          <Card>
            <div className="card-head">
              <div>
                <h2>
                  Recent Leave Activity
                </h2>

                <p>
                  Latest requests in
                  your scope.
                </p>
              </div>

              <button
                className="text-button"
                onClick={() =>
                  navigate(
                    "/leaves"
                  )
                }
              >
                Open Leave Management
              </button>
            </div>

            {data
              ?.recentLeaves
              ?.length ? (
              <div className="simple-list">
                {data.recentLeaves.map(
                  (
                    leave
                  ) => (
                    <div
                      className="list-row"
                      key={
                        leave._id
                      }
                    >
                      <div>
                        <strong>
                          {fullName(
                            leave.employeeId
                          )}
                        </strong>

                        <span>
                          {leave
                            .leaveTypeId
                            ?.name ||
                            "Leave"}
                          {" · "}
                          {
                            leave.days
                          }{" "}
                          day(s)
                        </span>
                      </div>

                      <Badge
                        value={
                          leave.status
                        }
                      />
                    </div>
                  )
                )}
              </div>
            ) : (
              <EmptyState
                title="No recent leave activity"
              />
            )}
          </Card>

          <Card>
            <div className="card-head">
              <div>
                <h2>
                  Employee Movements
                </h2>

                <p>
                  Recent workforce
                  changes.
                </p>
              </div>

              {hasPermission(
                "employees.view"
              ) && (
                <button
                  className="text-button"
                  onClick={() =>
                    navigate(
                      "/employees"
                    )
                  }
                >
                  Employees
                </button>
              )}
            </div>

            {data
              ?.recentMovements
              ?.length ? (
              <div className="simple-list">
                {data.recentMovements.map(
                  (
                    item
                  ) => (
                    <div
                      className="list-row"
                      key={
                        item._id
                      }
                    >
                      <div>
                        <strong>
                          {fullName(
                            item.employeeId
                          )}
                        </strong>

                        <span>
                          {pretty(
                            item.action ||
                              ""
                          )}
                          {" · "}
                          {formatDate(
                            item.effectiveDate
                          )}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : (
              <EmptyState
                title="No recent employee movements"
              />
            )}
          </Card>
        </div>
      )}

      {/* ============================================================= */}
      {/* HR / ADMIN ATTENDANCE OVERVIEW */}
      {/* ============================================================= */}

      {isOrganizationRole && (
        <Card>
          <div className="card-head">
            <div>
              <h2>
                Today's Attendance
              </h2>

              <p>
                Organization attendance
                status.
              </p>
            </div>

            <button
              className="button secondary"
              onClick={() =>
                navigate(
                  "/attendance"
                )
              }
            >
              Open Attendance
            </button>
          </div>

          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(auto-fit, minmax(120px, 1fr))",

              gap:
                12,
            }}
          >
            {[
              [
                "Present",
                breakdown.present ||
                  0,
              ],

              [
                "Late",
                breakdown.late ||
                  0,
              ],

              [
                "Absent",
                breakdown.absent ||
                  0,
              ],

              [
                "Half Day",
                breakdown[
                  "half-day"
                ] ||
                  0,
              ],

              [
                "On Leave",
                breakdown[
                  "on-leave"
                ] ||
                  0,
              ],

              [
                "Exceptions",
                stats.openAttendanceExceptions ||
                  0,
              ],
            ].map(
              ([
                label,
                value,
              ]) => (
                <div
                  key={
                    label
                  }
                  style={{
                    border:
                      "1px solid #e2e8f0",

                    borderRadius:
                      12,

                    padding:
                      14,
                  }}
                >
                  <small>
                    {label}
                  </small>

                  <strong
                    style={{
                      display:
                        "block",

                      fontSize:
                        24,

                      marginTop:
                        4,
                    }}
                  >
                    {value}
                  </strong>
                </div>
              )
            )}
          </div>
        </Card>
      )}
    </>
  );
}