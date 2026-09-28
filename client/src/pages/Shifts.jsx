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
  formatDate,
  fullName,
  getError,
} from "../utils/format";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const timeToMinutes = (value) => {
  if (!value) return 0;

  const [hours, minutes] =
    String(value)
      .split(":")
      .map(Number);

  return (hours || 0) * 60 + (minutes || 0);
};

const getShiftDurationMinutes = (
  startTime,
  endTime
) => {
  if (!startTime || !endTime) return 0;

  const start =
    timeToMinutes(startTime);

  let end =
    timeToMinutes(endTime);

  // Overnight shift
  if (end <= start) {
    end += 24 * 60;
  }

  // IMPORTANT:
  // Break is included inside shift timing.
  return end - start;
};

const formatDuration = (minutes) => {
  const hours =
    Math.floor(minutes / 60);

  const mins =
    minutes % 60;

  if (!mins) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}m`;
};

const today = () =>
  new Date()
    .toISOString()
    .slice(
      0,
      10
    );

const prettyTime = (
  value
) => {
  if (!value) {
    return "—";
  }

  const [
    hours,
    minutes,
  ] = value
    .split(":")
    .map(Number);

  const date =
    new Date();

  date.setHours(
    hours,
    minutes,
    0,
    0
  );

  return date.toLocaleTimeString(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
    }
  );
};

const minutesBetween = (
  startTime,
  endTime,
  breakMinutes = 0
) => {
  if (
    !startTime ||
    !endTime
  ) {
    return 0;
  }

  const [
    startHour,
    startMinute,
  ] =
    startTime
      .split(":")
      .map(Number);

  const [
    endHour,
    endMinute,
  ] =
    endTime
      .split(":")
      .map(Number);

  let start =
    startHour *
      60 +
    startMinute;

  let end =
    endHour *
      60 +
    endMinute;

  if (
    end <= start
  ) {
    end +=
      24 * 60;
  }

  return Math.max(
    0,
    end -
      start -
      Number(
        breakMinutes ||
          0
      )
  );
};

const hoursLabel = (
  minutes
) => {
  const hours =
    Math.floor(
      minutes /
        60
    );

  const remaining =
    minutes %
    60;

  if (
    remaining ===
    0
  ) {
    return `${hours} hrs`;
  }

  return `${hours}h ${remaining}m`;
};

const buildCode = (
  name
) => {
  const value =
    String(
      name ||
        "SHIFT"
    )
      .trim()
      .toUpperCase()
      .replace(
        /[^A-Z0-9]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      );

  return (
    value ||
    "SHIFT"
  ).slice(
    0,
    30
  );
};

/*
|--------------------------------------------------------------------------
| Defaults
|--------------------------------------------------------------------------
*/

const blankShift = {
  name: "",
  code: "",
  startTime:
    "10:00",
  endTime:
    "18:30",
  breakMinutes:
    30,
  graceMinutes:
    15,
  isDefault:
    false,
  isActive:
    true,

  // Backend compatibility only.
  // Actual working/off days are managed by Work Calendar.
  workingDays: [
    1,
    2,
    3,
    4,
    5,
  ],
};

const blankAssign = {
  employeeId: "",
  shiftId: "",
  effectiveFrom:
    today(),
  reason: "",
};

const blankRequest = {
  requestedShiftId:
    "",
  requestedEffectiveFrom:
    today(),
  reason: "",
};

/*
|--------------------------------------------------------------------------
| Component
|--------------------------------------------------------------------------
*/

export default function Shifts() {
  const {
    employee,
    hasPermission,
  } = useAuth();

  const canManage =
    hasPermission(
      "shift.manage"
    );

  const canTeam =
    hasPermission(
      "shift.team"
    );

  const canSelf =
    hasPermission(
      "shift.self"
    );

  /*
  |--------------------------------------------------------------------------
  | Data
  |--------------------------------------------------------------------------
  */

  const [
    shifts,
    setShifts,
  ] = useState([]);

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    assignments,
    setAssignments,
  ] = useState([]);

  const [
    requests,
    setRequests,
  ] = useState([]);

  const [
    myShift,
    setMyShift,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

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

  /*
  |--------------------------------------------------------------------------
  | Modals
  |--------------------------------------------------------------------------
  */

  const [
    shiftOpen,
    setShiftOpen,
  ] = useState(false);

  const [
    assignOpen,
    setAssignOpen,
  ] = useState(false);

  const [
    requestOpen,
    setRequestOpen,
  ] = useState(false);

  const [
    reviewing,
    setReviewing,
  ] = useState(null);

  const [
    historyEmployee,
    setHistoryEmployee,
  ] = useState(null);

  /*
  |--------------------------------------------------------------------------
  | Forms
  |--------------------------------------------------------------------------
  */

  const [
    shiftForm,
    setShiftForm,
  ] = useState(
    blankShift
  );

  const [
    editingShift,
    setEditingShift,
  ] = useState(null);

  const [
    assignForm,
    setAssignForm,
  ] = useState(
    blankAssign
  );

  const [
    requestForm,
    setRequestForm,
  ] = useState(
    blankRequest
  );

  const [
    reviewForm,
    setReviewForm,
  ] = useState({
    status:
      "approved",

    effectiveFrom:
      "",

    reviewNote:
      "",
  });

  /*
  |--------------------------------------------------------------------------
  | Load
  |--------------------------------------------------------------------------
  */

  const load =
    async () => {
      try {
        setLoading(
          true
        );

        const calls = [
          api.get(
            "/shifts"
          ),

          api.get(
            "/shifts/requests/list"
          ),
        ];

        if (
          canSelf &&
          employee
        ) {
          calls.push(
            api.get(
              "/shifts/me/current"
            )
          );
        }

        if (
          canManage ||
          canTeam
        ) {
          calls.push(
            api.get(
              "/employees"
            )
          );

          calls.push(
            api.get(
              "/shifts/assignments/list"
            )
          );
        }

        const result =
          await Promise.all(
            calls
          );

        let index =
          0;

        setShifts(
          result[
            index++
          ].data ||
            []
        );

        setRequests(
          result[
            index++
          ].data ||
            []
        );

        if (
          canSelf &&
          employee
        ) {
          setMyShift(
            result[
              index++
            ].data ||
              null
          );
        }

        if (
          canManage ||
          canTeam
        ) {
          setEmployees(
            result[
              index++
            ].data ||
              []
          );

          setAssignments(
            result[
              index++
            ].data ||
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
            "Unable to load shifts."
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
      employee?._id,
    ]
  );

  /*
  |--------------------------------------------------------------------------
  | Derived Data
  |--------------------------------------------------------------------------
  */

  const activeShifts =
    useMemo(
      () =>
        shifts.filter(
          (
            shift
          ) =>
            shift.isActive
        ),
      [
        shifts,
      ]
    );

  const currentAssignments =
    useMemo(
      () => {
        const now =
          new Date();

        return employees.map(
          (
            item
          ) => {
            const matches =
              assignments
                .filter(
                  (
                    assignment
                  ) =>
                    assignment
                      .employeeId
                      ?._id ===
                      item._id &&
                    new Date(
                      assignment.effectiveFrom
                    ) <=
                      now &&
                    (
                      !assignment.effectiveTo ||
                      new Date(
                        assignment.effectiveTo
                      ) >=
                        now
                    )
                )
                .sort(
                  (
                    a,
                    b
                  ) =>
                    new Date(
                      b.effectiveFrom
                    ) -
                    new Date(
                      a.effectiveFrom
                    )
                );

            return {
              employee:
                item,

              assignment:
                matches[0] ||
                null,
            };
          }
        );
      },
      [
        employees,
        assignments,
      ]
    );

  const selectedHistory =
    useMemo(
      () => {
        if (
          !historyEmployee
        ) {
          return [];
        }

        return assignments
          .filter(
            (
              assignment
            ) =>
              assignment
                .employeeId
                ?._id ===
              historyEmployee._id
          )
          .sort(
            (
              a,
              b
            ) =>
              new Date(
                b.effectiveFrom
              ) -
              new Date(
                a.effectiveFrom
              )
          );
      },
      [
        assignments,
        historyEmployee,
      ]
    );

  /*
  |--------------------------------------------------------------------------
  | Shift Definition
  |--------------------------------------------------------------------------
  */

  const openShiftEditor =
    (
      shift =
        null
    ) => {
      setError(
        ""
      );

      setEditingShift(
        shift
      );

      if (
        shift
      ) {
        setShiftForm({
          ...blankShift,
          ...shift,

          workingDays:
            shift.workingDays ||
            [
              1,
              2,
              3,
              4,
              5,
            ],
        });
      } else {
        setShiftForm(
          blankShift
        );
      }

      setShiftOpen(
        true
      );
    };

  const saveShift =
    async (
      event
    ) => {
      event.preventDefault();

      try {
        setSaving(
          true
        );

        const payload = {
          ...shiftForm,

          code:
            editingShift
              ? shiftForm.code
              : buildCode(
                  shiftForm.name
                ),

          breakMinutes:
            Number(
              shiftForm.breakMinutes ||
                0
            ),

          graceMinutes:
            Number(
              shiftForm.graceMinutes ||
                0
            ),

          workingDays:
            shiftForm.workingDays?.length
              ? shiftForm.workingDays
              : [
                  1,
                  2,
                  3,
                  4,
                  5,
                ],
        };

        if (
          editingShift
        ) {
          await api.put(
            `/shifts/${editingShift._id}`,
            payload
          );

          setNotice(
            "Shift updated successfully."
          );
        } else {
          await api.post(
            "/shifts",
            payload
          );

          setNotice(
            "Shift created successfully."
          );
        }

        setShiftOpen(
          false
        );

        setEditingShift(
          null
        );

        setError(
          ""
        );

        await load();
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to save shift."
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
  | Change Employee Shift
  |--------------------------------------------------------------------------
  */

  const openAssign =
    (
      employeeItem =
        null
    ) => {
      setError(
        ""
      );

      const current =
        employeeItem
          ? currentAssignments.find(
              (
                item
              ) =>
                item.employee
                  ._id ===
                employeeItem._id
            )
              ?.assignment
          : null;

      const fallbackShift =
        activeShifts.find(
          (
            shift
          ) =>
            shift._id !==
            current?.shiftId
              ?._id
        ) ||
        activeShifts[0];

      setAssignForm({
        employeeId:
          employeeItem
            ?._id ||
          "",

        shiftId:
          fallbackShift
            ?._id ||
          "",

        effectiveFrom:
          today(),

        reason:
          "",
      });

      setAssignOpen(
        true
      );
    };

  const submitAssign =
    async (
      event
    ) => {
      event.preventDefault();

      try {
        setSaving(
          true
        );

        await api.post(
          "/shifts/assignments",
          assignForm
        );

        setAssignOpen(
          false
        );

        setNotice(
          "Employee shift changed successfully."
        );

        setError(
          ""
        );

        await load();
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to change employee shift."
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
  | Employee Request
  |--------------------------------------------------------------------------
  */

  const openRequest =
    () => {
      setError(
        ""
      );

      const currentShiftId =
        myShift?.current
          ?.shiftId?._id ||
        myShift?.current
          ?.shiftId ||
        "";

      const alternative =
        activeShifts.find(
          (
            shift
          ) =>
            String(
              shift._id
            ) !==
            String(
              currentShiftId
            )
        );

      setRequestForm({
        requestedShiftId:
          alternative?._id ||
          "",

        requestedEffectiveFrom:
          today(),

        reason:
          "",
      });

      setRequestOpen(
        true
      );
    };

  const submitRequest =
    async (
      event
    ) => {
      event.preventDefault();

      try {
        setSaving(
          true
        );

        await api.post(
          "/shifts/requests",
          requestForm
        );

        setRequestOpen(
          false
        );

        setNotice(
          "Your shift change request has been sent to HR."
        );

        setError(
          ""
        );

        await load();
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to submit shift request."
          )
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  const cancelRequest =
    async (
      request
    ) => {
      if (
        !window.confirm(
          "Cancel this shift request?"
        )
      ) {
        return;
      }

      try {
        await api.put(
          `/shifts/requests/${request._id}/cancel`
        );

        setNotice(
          "Shift request cancelled."
        );

        await load();
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to cancel request."
          )
        );
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Review Request
  |--------------------------------------------------------------------------
  */

  const openReview =
    (
      request
    ) => {
      setError(
        ""
      );

      setReviewing(
        request
      );

      setReviewForm({
        status:
          "approved",

        effectiveFrom:
          request
            .requestedEffectiveFrom
            ?.slice(
              0,
              10
            ) ||
          today(),

        reviewNote:
          "",
      });
    };

  const review =
    async (
      event
    ) => {
      event.preventDefault();

      try {
        setSaving(
          true
        );

        await api.put(
          `/shifts/requests/${reviewing._id}/review`,
          reviewForm
        );

        setReviewing(
          null
        );

        setNotice(
          reviewForm.status ===
          "approved"
            ? "Shift request approved."
            : "Shift request rejected."
        );

        setError(
          ""
        );

        await load();
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to review shift request."
          )
        );
      } finally {
        setSaving(
          false
        );
      }
    };

    const requiredDailyMinutes =
  useMemo(
    () =>
      getShiftDurationMinutes(
        shiftForm.startTime,
        shiftForm.endTime
      ),
    [
      shiftForm.startTime,
      shiftForm.endTime,
    ]
  );

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <>
      <PageHeader
        title="Shifts"
        description="Create work timings and assign the right shift to each employee."
        action={
          <div className="button-row">
            {canManage && (
              <button
                className="button secondary"
                onClick={() =>
                  openAssign()
                }
              >
                Change Employee Shift
              </button>
            )}

            {canManage && (
              <button
                className="button primary"
                onClick={() =>
                  openShiftEditor()
                }
              >
                + Add Shift
              </button>
            )}

            {canSelf &&
              employee && (
                <button
                  className="button primary"
                  onClick={
                    openRequest
                  }
                >
                  Request Shift Change
                </button>
              )}
          </div>
        }
      />

      {notice && (
        <Alert type="success">
          {notice}
        </Alert>
      )}

      {error &&
        !shiftOpen &&
        !assignOpen &&
        !requestOpen &&
        !reviewing && (
          <Alert type="error">
            {error}
          </Alert>
        )}

      {/* ============================================================= */}
      {/* Employee's Current Shift */}
      {/* ============================================================= */}

      {employee && (
        <Card className="shift-current-card">
          <div>
            <span className="eyebrow">
              My Shift
            </span>

            <h2>
              {myShift?.current
                ?.snapshot
                ?.name ||
                "No shift assigned"}
            </h2>

            {myShift?.current ? (
              <p>
                {prettyTime(
                  myShift
                    .current
                    .snapshot
                    .startTime
                )}
                {" — "}
                {prettyTime(
                  myShift
                    .current
                    .snapshot
                    .endTime
                )}
                {" · "}
                {
                  myShift
                    .current
                    .snapshot
                    .breakMinutes
                }{" "}
                min break
              </p>
            ) : (
              <p>
                HR has not assigned
                your shift yet.
              </p>
            )}
          </div>

          {myShift?.current && (
            <div className="shift-time-chip">
              <strong>
                {prettyTime(
                  myShift
                    .current
                    .snapshot
                    .startTime
                )}
              </strong>

              <span>
                to
              </span>

              <strong>
                {prettyTime(
                  myShift
                    .current
                    .snapshot
                    .endTime
                )}
              </strong>
            </div>
          )}
        </Card>
      )}

      {/* ============================================================= */}
      {/* Shift Setup */}
      {/* ============================================================= */}

      <Card>
        <div className="card-head">
          <div>
            <h2>
              Shift Timings
            </h2>

            <p>
              Define when each shift
              starts and ends. Working
              days are controlled from
              Work Calendar.
            </p>
          </div>

          {canManage && (
            <button
              className="button secondary"
              onClick={() =>
                openShiftEditor()
              }
            >
              + Add Shift
            </button>
          )}
        </div>

        {loading ? (
          <p>
            Loading shifts...
          </p>
        ) : shifts.length ? (
          <div className="shift-grid">
            {shifts.map(
              (
                shift
              ) => {
                const requiredMinutes =
                  minutesBetween(
                    shift.startTime,
                    shift.endTime,
                    shift.breakMinutes
                  );

                return (
                  <Card
                    key={
                      shift._id
                    }
                    className="shift-card"
                  >
                    <div className="shift-card-head">
                      <div>
                        <span className="eyebrow">
                          Shift
                        </span>

                        <h2>
                          {
                            shift.name
                          }
                        </h2>
                      </div>

                      <div className="button-row">
                        {shift.isDefault && (
                          <Badge value="default" />
                        )}

                        <Badge
                          value={
                            shift.isActive
                              ? "active"
                              : "inactive"
                          }
                        />
                      </div>
                    </div>

                    <div className="shift-hours">
                      <strong>
                        {prettyTime(
                          shift.startTime
                        )}
                      </strong>

                      <span>
                        →
                      </span>

                      <strong>
                        {prettyTime(
                          shift.endTime
                        )}
                      </strong>
                    </div>

                    <div className="shift-detail-row">
                      <span>
                        {
                          shift.breakMinutes
                        }{" "}
                        min break
                      </span>

                      <span>
                        {
                          shift.graceMinutes
                        }{" "}
                        min grace
                      </span>
                    </div>

                    <div
                      style={{
                        marginTop:
                          12,
                      }}
                    >
                      <span className="eyebrow">
                        Required Daily Hours
                      </span>

                      <strong
                        style={{
                          display:
                            "block",
                          marginTop:
                            4,
                        }}
                      >
                        {hoursLabel(
                          requiredMinutes
                        )}
                      </strong>
                    </div>

                    {canManage && (
                      <button
                        className="text-button"
                        onClick={() =>
                          openShiftEditor(
                            shift
                          )
                        }
                      >
                        Edit Shift
                      </button>
                    )}
                  </Card>
                );
              }
            )}
          </div>
        ) : (
          <EmptyState
            title="No shifts created"
            description="Add your first shift by entering its start time, end time and break."
          />
        )}
      </Card>

      {/* ============================================================= */}
      {/* Employee Shift Roster */}
      {/* ============================================================= */}

      {(canManage ||
        canTeam) && (
        <Card>
          <div className="card-head">
            <div>
              <h2>
                Employee Shifts
              </h2>

              <p>
                See each employee's
                current shift. Use
                Change Shift when
                someone's schedule
                changes.
              </p>
            </div>

            {canManage && (
              <button
                className="button primary"
                onClick={() =>
                  openAssign()
                }
              >
                Change Employee Shift
              </button>
            )}
          </div>

          {currentAssignments.length ? (
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
                      Current Shift
                    </th>

                    <th>
                      Timing
                    </th>

                    <th>
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {currentAssignments.map(
                    ({
                      employee:
                        employeeItem,

                      assignment,
                    }) => (
                      <tr
                        key={
                          employeeItem._id
                        }
                      >
                        <td>
                          <strong>
                            {fullName(
                              employeeItem
                            )}
                          </strong>

                          <small>
                            {
                              employeeItem.employeeCode
                            }
                          </small>
                        </td>

                        <td>
                          {employeeItem
                            .departmentId
                            ?.name ||
                            "—"}
                        </td>

                        <td>
                          {assignment
                            ?.snapshot
                            ?.name ||
                            "Not assigned"}
                        </td>

                        <td>
                          {assignment
                            ?.snapshot ? (
                            <>
                              {prettyTime(
                                assignment
                                  .snapshot
                                  .startTime
                              )}
                              {" — "}
                              {prettyTime(
                                assignment
                                  .snapshot
                                  .endTime
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td>
                          <div className="table-actions">
                            {canManage && (
                              <button
                                className="text-button"
                                onClick={() =>
                                  openAssign(
                                    employeeItem
                                  )
                                }
                              >
                                Change Shift
                              </button>
                            )}

                            <button
                              className="text-button"
                              onClick={() =>
                                setHistoryEmployee(
                                  employeeItem
                                )
                              }
                            >
                              View History
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No employees available"
              description="Employee shifts will appear here after employees are added."
            />
          )}
        </Card>
      )}

      {/* ============================================================= */}
      {/* Shift Requests */}
      {/* ============================================================= */}

      <Card>
        <div className="card-head">
          <div>
            <h2>
              Shift Change Requests
            </h2>

            <p>
              {canManage
                ? "Review employee requests to move to another shift."
                : "Track your requested shift changes."}
            </p>
          </div>
        </div>

        {requests.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    Employee
                  </th>

                  <th>
                    Requested Shift
                  </th>

                  <th>
                    Starts From
                  </th>

                  <th>
                    Reason
                  </th>

                  <th>
                    Status
                  </th>

                  <th />
                </tr>
              </thead>

              <tbody>
                {requests.map(
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
                          {fullName(
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
                        <strong>
                          {
                            request.requestedShiftId
                              ?.name
                          }
                        </strong>

                        <small>
                          {prettyTime(
                            request
                              .requestedShiftId
                              ?.startTime
                          )}
                          {" — "}
                          {prettyTime(
                            request
                              .requestedShiftId
                              ?.endTime
                          )}
                        </small>
                      </td>

                      <td>
                        {formatDate(
                          request.requestedEffectiveFrom
                        )}
                      </td>

                      <td>
                        {
                          request.reason
                        }

                        {request.reviewNote && (
                          <small>
                            HR:{" "}
                            {
                              request.reviewNote
                            }
                          </small>
                        )}
                      </td>

                      <td>
                        <Badge
                          value={
                            request.status
                          }
                        />
                      </td>

                      <td>
                        {canManage &&
                        request.status ===
                          "pending" ? (
                          <button
                            className="text-button"
                            onClick={() =>
                              openReview(
                                request
                              )
                            }
                          >
                            Review
                          </button>
                        ) : request.status ===
                            "pending" &&
                          request.employeeId
                            ?._id ===
                            employee?._id ? (
                          <button
                            className="text-button danger"
                            onClick={() =>
                              cancelRequest(
                                request
                              )
                            }
                          >
                            Cancel
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No shift requests"
            description="There are no shift change requests right now."
          />
        )}
      </Card>

      {/* ============================================================= */}
      {/* Create/Edit Shift */}
      {/* ============================================================= */}

      <Modal
        open={
          shiftOpen
        }
        onClose={() =>
          setShiftOpen(
            false
          )
        }
        title={
          editingShift
            ? "Edit Shift"
            : "Add Shift"
        }
      >
        <form
          onSubmit={
            saveShift
          }
        >
          {error && (
            <Alert type="error">
              {error}
            </Alert>
          )}

          <Alert type="info">
            A shift only defines
            daily working time.
            Office days, WFH days
            and off days are managed
            separately in Work
            Calendar.
          </Alert>

          <label className="field">
            <span>
              Shift Name *
            </span>

            <input
              required
              placeholder="e.g. Morning Shift"
              value={
                shiftForm.name
              }
              onChange={(
                event
              ) =>
                setShiftForm({
                  ...shiftForm,

                  name:
                    event
                      .target
                      .value,
                })
              }
            />
          </label>

          <div className="form-grid two">
            <label className="field">
              <span>
                Shift Starts *
              </span>

              <input
                type="time"
                required
                value={
                  shiftForm.startTime
                }
                onChange={(
                  event
                ) =>
                  setShiftForm({
                    ...shiftForm,

                    startTime:
                      event
                        .target
                        .value,
                  })
                }
              />
            </label>

            <label className="field">
              <span>
                Shift Ends *
              </span>

              <input
                type="time"
                required
                value={
                  shiftForm.endTime
                }
                onChange={(
                  event
                ) =>
                  setShiftForm({
                    ...shiftForm,

                    endTime:
                      event
                        .target
                        .value,
                  })
                }
              />
            </label>

            <label className="field">
              <span>
                Break
              </span>

              <select
                value={
                  shiftForm.breakMinutes
                }
                onChange={(
                  event
                ) =>
                  setShiftForm({
                    ...shiftForm,

                    breakMinutes:
                      Number(
                        event
                          .target
                          .value
                      ),
                  })
                }
              >
                <option value="0">
                  No break
                </option>

                <option value="15">
                  15 minutes
                </option>

                <option value="30">
                  30 minutes
                </option>

                <option value="45">
                  45 minutes
                </option>

                <option value="60">
                  1 hour
                </option>
              </select>
            </label>

            <label className="field">
              <span>
                Late Grace Period
              </span>

              <select
                value={
                  shiftForm.graceMinutes
                }
                onChange={(
                  event
                ) =>
                  setShiftForm({
                    ...shiftForm,

                    graceMinutes:
                      Number(
                        event
                          .target
                          .value
                      ),
                  })
                }
              >
                <option value="0">
                  No grace
                </option>

                <option value="5">
                  5 minutes
                </option>

                <option value="10">
                  10 minutes
                </option>

                <option value="15">
                  15 minutes
                </option>

                <option value="20">
                  20 minutes
                </option>

                <option value="30">
                  30 minutes
                </option>
              </select>
            </label>
          </div>

          <Card>
            <span className="eyebrow">
              Required Daily Hours
            </span>

            <h2>
              {hoursLabel(
                minutesBetween(
                  shiftForm.startTime,
                  shiftForm.endTime,
                  shiftForm.breakMinutes
                )
              )}
            </h2>

            <p>
              Automatically calculated
              after subtracting the
              break.
            </p>
          </Card>

          <label className="switch-row">
            <input
              type="checkbox"
              checked={
                shiftForm.isDefault
              }
              onChange={(
                event
              ) =>
                setShiftForm({
                  ...shiftForm,

                  isDefault:
                    event
                      .target
                      .checked,
                })
              }
            />

            <span>
              <strong>
                Default Shift
              </strong>

              <small>
                Automatically selected
                when adding a new
                employee.
              </small>
            </span>
          </label>

          {editingShift && (
            <label className="switch-row">
              <input
                type="checkbox"
                checked={
                  shiftForm.isActive
                }
                onChange={(
                  event
                ) =>
                  setShiftForm({
                    ...shiftForm,

                    isActive:
                      event
                        .target
                        .checked,
                  })
                }
              />

              <span>
                <strong>
                  Active Shift
                </strong>

                <small>
                  Turn this off when
                  the shift should no
                  longer be assigned.
                </small>
              </span>
            </label>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                setShiftOpen(
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
                : editingShift
                  ? "Save Changes"
                  : "Create Shift"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================= */}
      {/* Change Employee Shift */}
      {/* ============================================================= */}

      <Modal
        open={
          assignOpen
        }
        onClose={() =>
          setAssignOpen(
            false
          )
        }
        title="Change Employee Shift"
      >
        <form
          onSubmit={
            submitAssign
          }
        >
          {error && (
            <Alert type="error">
              {error}
            </Alert>
          )}

          <label className="field">
            <span>
              Employee *
            </span>

            <select
              required
              value={
                assignForm.employeeId
              }
              onChange={(
                event
              ) =>
                setAssignForm({
                  ...assignForm,

                  employeeId:
                    event
                      .target
                      .value,
                })
              }
            >
              <option value="">
                Select employee
              </option>

              {employees.map(
                (
                  employeeItem
                ) => (
                  <option
                    key={
                      employeeItem._id
                    }
                    value={
                      employeeItem._id
                    }
                  >
                    {fullName(
                      employeeItem
                    )}
                    {" — "}
                    {
                      employeeItem.employeeCode
                    }
                  </option>
                )
              )}
            </select>
          </label>

          <label className="field">
            <span>
              New Shift *
            </span>

            <select
              required
              value={
                assignForm.shiftId
              }
              onChange={(
                event
              ) =>
                setAssignForm({
                  ...assignForm,

                  shiftId:
                    event
                      .target
                      .value,
                })
              }
            >
              <option value="">
                Select new shift
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
                    {prettyTime(
                      shift.startTime
                    )}
                    {" to "}
                    {prettyTime(
                      shift.endTime
                    )}
                  </option>
                )
              )}
            </select>
          </label>

          <label className="field">
            <span>
              Starts From *
            </span>

            <input
              type="date"
              required
              value={
                assignForm.effectiveFrom
              }
              onChange={(
                event
              ) =>
                setAssignForm({
                  ...assignForm,

                  effectiveFrom:
                    event
                      .target
                      .value,
                })
              }
            />

            <small>
              Select the first day
              this employee should
              follow the new shift.
            </small>
          </label>

          <label className="field">
            <span>
              Reason
            </span>

            <input
              placeholder="e.g. Schedule change"
              value={
                assignForm.reason
              }
              onChange={(
                event
              ) =>
                setAssignForm({
                  ...assignForm,

                  reason:
                    event
                      .target
                      .value,
                })
              }
            />
          </label>

          <Alert type="info">
            You do not need to enter
            an end date. The previous
            shift will automatically
            close when the new shift
            starts.
          </Alert>

          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                setAssignOpen(
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
                : "Change Shift"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================= */}
      {/* Shift History */}
      {/* ============================================================= */}

      <Modal
        open={
          Boolean(
            historyEmployee
          )
        }
        onClose={() =>
          setHistoryEmployee(
            null
          )
        }
        title={
          historyEmployee
            ? `${fullName(
                historyEmployee
              )} · Shift History`
            : "Shift History"
        }
      >
        {selectedHistory.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    Shift
                  </th>

                  <th>
                    Timing
                  </th>

                  <th>
                    Started
                  </th>

                  <th>
                    Ended
                  </th>

                  <th>
                    Reason
                  </th>
                </tr>
              </thead>

              <tbody>
                {selectedHistory.map(
                  (
                    assignment
                  ) => (
                    <tr
                      key={
                        assignment._id
                      }
                    >
                      <td>
                        <strong>
                          {
                            assignment
                              .snapshot
                              ?.name
                          }
                        </strong>
                      </td>

                      <td>
                        {prettyTime(
                          assignment
                            .snapshot
                            ?.startTime
                        )}
                        {" — "}
                        {prettyTime(
                          assignment
                            .snapshot
                            ?.endTime
                        )}
                      </td>

                      <td>
                        {formatDate(
                          assignment.effectiveFrom
                        )}
                      </td>

                      <td>
                        {assignment.effectiveTo
                          ? formatDate(
                              assignment.effectiveTo
                            )
                          : "Current"}
                      </td>

                      <td>
                        {
                          assignment.reason ||
                          "—"
                        }
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No shift history"
            description="Previous shift changes will appear here."
          />
        )}
      </Modal>

      {/* ============================================================= */}
      {/* Request Shift Change */}
      {/* ============================================================= */}

      <Modal
        open={
          requestOpen
        }
        onClose={() =>
          setRequestOpen(
            false
          )
        }
        title="Request Shift Change"
      >
        <form
          onSubmit={
            submitRequest
          }
        >
          {error && (
            <Alert type="error">
              {error}
            </Alert>
          )}

          <label className="field">
            <span>
              Requested Shift *
            </span>

            <select
              required
              value={
                requestForm.requestedShiftId
              }
              onChange={(
                event
              ) =>
                setRequestForm({
                  ...requestForm,

                  requestedShiftId:
                    event
                      .target
                      .value,
                })
              }
            >
              <option value="">
                Select shift
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
                    {prettyTime(
                      shift.startTime
                    )}
                    {" to "}
                    {prettyTime(
                      shift.endTime
                    )}
                  </option>
                )
              )}
            </select>
          </label>

          <label className="field">
            <span>
              Requested Start Date *
            </span>

            <input
              type="date"
              min={
                today()
              }
              required
              value={
                requestForm.requestedEffectiveFrom
              }
              onChange={(
                event
              ) =>
                setRequestForm({
                  ...requestForm,

                  requestedEffectiveFrom:
                    event
                      .target
                      .value,
                })
              }
            />
          </label>

          <label className="field">
            <span>
              Reason *
            </span>

            <textarea
              rows="4"
              required
              placeholder="Why do you need this shift?"
              value={
                requestForm.reason
              }
              onChange={(
                event
              ) =>
                setRequestForm({
                  ...requestForm,

                  reason:
                    event
                      .target
                      .value,
                })
              }
            />
          </label>

          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                setRequestOpen(
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
                ? "Submitting..."
                : "Send Request"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================= */}
      {/* Review Shift Request */}
      {/* ============================================================= */}

      <Modal
        open={
          Boolean(
            reviewing
          )
        }
        onClose={() =>
          setReviewing(
            null
          )
        }
        title="Review Shift Request"
      >
        <form
          onSubmit={
            review
          }
        >
          {error && (
            <Alert type="error">
              {error}
            </Alert>
          )}

          {reviewing && (
            <Card>
              <span className="eyebrow">
                Employee
              </span>

              <h3>
                {fullName(
                  reviewing.employeeId
                )}
              </h3>

              <p>
                Requested:{" "}
                <strong>
                  {
                    reviewing
                      .requestedShiftId
                      ?.name
                  }
                </strong>
              </p>

              <small>
                {
                  reviewing.reason
                }
              </small>
            </Card>
          )}

          <label className="field">
            <span>
              Decision
            </span>

            <select
              value={
                reviewForm.status
              }
              onChange={(
                event
              ) =>
                setReviewForm({
                  ...reviewForm,

                  status:
                    event
                      .target
                      .value,
                })
              }
            >
              <option value="approved">
                Approve
              </option>

              <option value="rejected">
                Reject
              </option>
            </select>
          </label>

          {reviewForm.status ===
            "approved" && (
            <label className="field">
              <span>
                New Shift Starts From *
              </span>

              <input
                type="date"
                required
                value={
                  reviewForm.effectiveFrom
                }
                onChange={(
                  event
                ) =>
                  setReviewForm({
                    ...reviewForm,

                    effectiveFrom:
                      event
                        .target
                        .value,
                  })
                }
              />
            </label>
          )}

          <label className="field">
            <span>
              HR Note
            </span>

            <textarea
              rows="3"
              value={
                reviewForm.reviewNote
              }
              onChange={(
                event
              ) =>
                setReviewForm({
                  ...reviewForm,

                  reviewNote:
                    event
                      .target
                      .value,
                })
              }
            />
          </label>

          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                setReviewing(
                  null
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
                : "Save Decision"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}