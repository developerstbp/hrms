import {
  useEffect,
  useMemo,
  useState
} from "react";

import api from "../services/api";

import {
  Alert,
  Badge,
  EmptyState,
  Modal
} from "./UI";

import {
  formatDate,
  fullName,
  getError
} from "../utils/format";

const today = () =>
  new Date()
    .toISOString()
    .slice(0, 10);

const blankForm = {
  action:
    "confirmation",

  effectiveDate:
    today(),

  reason:
    "",

  notes:
    "",

  departmentId:
    "",

  designationId:
    "",

  gradeId:
    "",

  managerId:
    "",

  locationId:
    "",

  plannedLastWorkingDate:
    "",

  lastWorkingDate:
    "",

  separationType:
    "resignation"
};

const ACTIONS = [
  {
    value:
      "confirmation",

    label:
      "Confirm Employment"
  },

  {
    value:
      "promotion",

    label:
      "Promotion"
  },

  {
    value:
      "transfer",

    label:
      "Department Transfer"
  },

  {
    value:
      "designation-change",

    label:
      "Change Designation"
  },

  {
    value:
      "manager-change",

    label:
      "Change Reporting Manager"
  },

  {
    value:
      "notice-started",

    label:
      "Start Notice Period"
  },

  {
    value:
      "resignation",

    label:
      "Record Resignation"
  },

  {
    value:
      "termination",

    label:
      "Terminate Employment"
  },

  {
    value:
      "separation-completed",

    label:
      "Complete Separation"
  }
];

const ACTION_LABELS =
  Object.fromEntries(
    ACTIONS.map(
      (item) => [
        item.value,
        item.label
      ]
    )
  );

export default function EmployeeLifecycle({
  employee,
  employees = [],
  departments = [],
  masterData = [],
  onClose,
  onUpdated
}) {
  const [
    events,
    setEvents
  ] = useState([]);

  const [
    form,
    setForm
  ] = useState(
    blankForm
  );

  const [
    error,
    setError
  ] = useState("");

  const [
    notice,
    setNotice
  ] = useState("");

  const [
    loading,
    setLoading
  ] = useState(false);

  const designations =
    masterData.filter(
      (item) =>
        item.type ===
          "designation" &&
        item.isActive
    );

  const grades =
    masterData.filter(
      (item) =>
        item.type ===
          "grade" &&
        item.isActive
    );

  const locations =
    masterData.filter(
      (item) =>
        item.type ===
          "location" &&
        item.isActive
    );

  const transferDesignations =
    useMemo(
      () =>
        designations.filter(
          (item) =>
            !form.departmentId ||
            !item.departmentId ||
            item.departmentId
              ?._id ===
              form.departmentId
        ),
      [
        designations,
        form.departmentId
      ]
    );

  const currentDepartmentDesignations =
    designations.filter(
      (item) =>
        !item.departmentId ||
        item.departmentId
          ?._id ===
          employee?.departmentId
            ?._id
    );

  const load =
    async () => {
      if (
        !employee?._id
      ) {
        return;
      }

      try {
        const {
          data
        } =
          await api.get(
            `/employees/${employee._id}/lifecycle`
          );

        setEvents(
          data.events ||
          []
        );

        setError("");
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to load employee lifecycle."
          )
        );
      }
    };

  useEffect(() => {
    if (employee) {
      setForm({
        ...blankForm,

        effectiveDate:
          today(),

        departmentId:
          employee.departmentId
            ?._id ||
          "",

        designationId:
          employee.designationId
            ?._id ||
          "",

        gradeId:
          employee.gradeId
            ?._id ||
          "",

        managerId:
          employee.managerId
            ?._id ||
          "",

        locationId:
          employee.locationId
            ?._id ||
          ""
      });

      setNotice("");

      load();
    }
  }, [
    employee?._id
  ]);

  const changeAction = (
    action
  ) => {
    setForm({
      ...blankForm,

      action,

      effectiveDate:
        today(),

      departmentId:
        employee?.departmentId
          ?._id ||
        "",

      designationId:
        employee?.designationId
          ?._id ||
        "",

      gradeId:
        employee?.gradeId
          ?._id ||
        "",

      managerId:
        employee?.managerId
          ?._id ||
        "",

      locationId:
        employee?.locationId
          ?._id ||
        ""
    });

    setError("");
  };

  const submit =
    async (
      event
    ) => {
      event.preventDefault();

      setLoading(true);
      setError("");

      try {
        await api.post(
          `/employees/${employee._id}/lifecycle/actions`,
          form
        );

        setNotice(
          `${ACTION_LABELS[form.action]} saved successfully.`
        );

        await load();

        if (
          onUpdated
        ) {
          await onUpdated();
        }
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to complete HR action."
          )
        );
      } finally {
        setLoading(false);
      }
    };

  const changeSummary = (
    event
  ) => {
    const before =
      event.before ||
      {};

    const after =
      event.after ||
      {};

    const fields = [
      [
        "Department",
        before.department,
        after.department
      ],

      [
        "Designation",
        before.designation,
        after.designation
      ],

      [
        "Manager",
        before.manager,
        after.manager
      ],

      [
        "Grade",
        before.grade,
        after.grade
      ],

      [
        "Location",
        before.location,
        after.location
      ],

      [
        "Status",
        before.status,
        after.status
      ]
    ];

    return fields
      .filter(
        ([
          ,
          oldValue,
          newValue
        ]) =>
          String(
            oldValue ||
            ""
          ) !==
          String(
            newValue ||
            ""
          )
      )
      .map(
        ([
          label,
          oldValue,
          newValue
        ]) =>
          `${label}: ${
            oldValue ||
            "—"
          } → ${
            newValue ||
            "—"
          }`
      );
  };

  if (!employee) {
    return null;
  }

  return (
    <Modal
      open={Boolean(
        employee
      )}
      onClose={
        onClose
      }
      title={`HR Actions · ${fullName(
        employee
      )}`}
      wide
    >
      {notice && (
        <Alert type="success">
          {notice}
        </Alert>
      )}

      {error && (
        <Alert type="error">
          {error}
        </Alert>
      )}

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "minmax(280px, 0.9fr) minmax(420px, 1.4fr)",

          gap:
            20,

          alignItems:
            "start"
        }}
      >
        <form
          onSubmit={
            submit
          }
        >
          <div className="section-label">
            New HR Action
          </div>

          <label className="field">
            <span>
              Action *
            </span>

            <select
              value={
                form.action
              }
              onChange={(
                event
              ) =>
                changeAction(
                  event
                    .target
                    .value
                )
              }
            >
              {ACTIONS.map(
                (item) => (
                  <option
                    key={
                      item.value
                    }
                    value={
                      item.value
                    }
                  >
                    {
                      item.label
                    }
                  </option>
                )
              )}
            </select>
          </label>

          <label className="field">
            <span>
              Effective Date *
            </span>

            <input
              type="date"
              required
              max={
                today()
              }
              value={
                form.effectiveDate
              }
              onChange={(
                event
              ) =>
                setForm({
                  ...form,

                  effectiveDate:
                    event
                      .target
                      .value
                })
              }
            />
          </label>

          {form.action ===
            "promotion" && (
            <>
              <label className="field">
                <span>
                  Department
                </span>

                <select
                  value={
                    form.departmentId
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,

                      departmentId:
                        event
                          .target
                          .value,

                      designationId:
                        ""
                    })
                  }
                >
                  {departments
                    .filter(
                      (item) =>
                        item.isActive
                    )
                    .map(
                      (item) => (
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
                  New Designation *
                </span>

                <select
                  required
                  value={
                    form.designationId
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,

                      designationId:
                        event
                          .target
                          .value
                    })
                  }
                >
                  <option value="">
                    Select designation
                  </option>

                  {transferDesignations.map(
                    (item) => (
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
                  New Grade
                </span>

                <select
                  value={
                    form.gradeId
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,

                      gradeId:
                        event
                          .target
                          .value
                    })
                  }
                >
                  <option value="">
                    No grade change
                  </option>

                  {grades.map(
                    (item) => (
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
            </>
          )}

          {form.action ===
            "transfer" && (
            <>
              <label className="field">
                <span>
                  Destination Department *
                </span>

                <select
                  required
                  value={
                    form.departmentId
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,

                      departmentId:
                        event
                          .target
                          .value,

                      designationId:
                        ""
                    })
                  }
                >
                  <option value="">
                    Select department
                  </option>

                  {departments
                    .filter(
                      (item) =>
                        item.isActive
                    )
                    .map(
                      (item) => (
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
                  Designation *
                </span>

                <select
                  required
                  value={
                    form.designationId
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,

                      designationId:
                        event
                          .target
                          .value
                    })
                  }
                >
                  <option value="">
                    Select designation
                  </option>

                  {transferDesignations.map(
                    (item) => (
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
                  Reporting Manager
                </span>

                <select
                  value={
                    form.managerId
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,

                      managerId:
                        event
                          .target
                          .value
                    })
                  }
                >
                  <option value="">
                    No direct manager
                  </option>

                  {employees
                    .filter(
                      (item) =>
                        item._id !==
                          employee._id &&
                        item.status !==
                          "inactive"
                    )
                    .map(
                      (item) => (
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
                          )}{" "}
                          —{" "}
                          {
                            item.employeeCode
                          }
                        </option>
                      )
                    )}
                </select>
              </label>

              <label className="field">
                <span>
                  Location
                </span>

                <select
                  value={
                    form.locationId
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,

                      locationId:
                        event
                          .target
                          .value
                    })
                  }
                >
                  <option value="">
                    No location
                  </option>

                  {locations.map(
                    (item) => (
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
            </>
          )}

          {form.action ===
            "designation-change" && (
            <label className="field">
              <span>
                New Designation *
              </span>

              <select
                required
                value={
                  form.designationId
                }
                onChange={(
                  event
                ) =>
                  setForm({
                    ...form,

                    designationId:
                      event
                        .target
                        .value
                  })
                }
              >
                <option value="">
                  Select designation
                </option>

                {currentDepartmentDesignations.map(
                  (item) => (
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
          )}

          {form.action ===
            "manager-change" && (
            <label className="field">
              <span>
                New Reporting Manager
              </span>

              <select
                value={
                  form.managerId
                }
                onChange={(
                  event
                ) =>
                  setForm({
                    ...form,

                    managerId:
                      event
                        .target
                        .value
                  })
                }
              >
                <option value="">
                  No direct manager
                </option>

                {employees
                  .filter(
                    (item) =>
                      item._id !==
                        employee._id &&
                      item.status !==
                        "inactive"
                  )
                  .map(
                    (item) => (
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
                        )}{" "}
                        —{" "}
                        {
                          item.employeeCode
                        }
                      </option>
                    )
                  )}
              </select>
            </label>
          )}

          {[
            "notice-started",
            "resignation"
          ].includes(
            form.action
          ) && (
            <label className="field">
              <span>
                Planned Last Working Date
              </span>

              <input
                type="date"
                value={
                  form.plannedLastWorkingDate
                }
                onChange={(
                  event
                ) =>
                  setForm({
                    ...form,

                    plannedLastWorkingDate:
                      event
                        .target
                        .value
                  })
                }
              />
            </label>
          )}

          {form.action ===
            "separation-completed" && (
            <>
              <label className="field">
                <span>
                  Last Working Date *
                </span>

                <input
                  type="date"
                  required
                  max={
                    today()
                  }
                  value={
                    form.lastWorkingDate
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,

                      lastWorkingDate:
                        event
                          .target
                          .value
                    })
                  }
                />
              </label>

              <label className="field">
                <span>
                  Separation Type *
                </span>

                <select
                  value={
                    form.separationType
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,

                      separationType:
                        event
                          .target
                          .value
                    })
                  }
                >
                  <option value="resignation">
                    Resignation
                  </option>

                  <option value="termination">
                    Termination
                  </option>

                  <option value="retirement">
                    Retirement
                  </option>

                  <option value="contract-end">
                    Contract End
                  </option>

                  <option value="other">
                    Other
                  </option>
                </select>
              </label>
            </>
          )}

          <label className="field">
            <span>
              Reason *
            </span>

            <textarea
              required
              rows="3"
              value={
                form.reason
              }
              onChange={(
                event
              ) =>
                setForm({
                  ...form,

                  reason:
                    event
                      .target
                      .value
                })
              }
              placeholder="Reason for this HR action"
            />
          </label>

          <label className="field">
            <span>
              Internal Notes
            </span>

            <textarea
              rows="2"
              value={
                form.notes
              }
              onChange={(
                event
              ) =>
                setForm({
                  ...form,

                  notes:
                    event
                      .target
                      .value
                })
              }
            />
          </label>

          <button
            className="button primary"
            disabled={
              loading
            }
          >
            {loading
              ? "Saving..."
              : "Save HR Action"}
          </button>
        </form>

        <div>
          <div className="section-label">
            Employee Lifecycle Timeline
          </div>

          {events.length ? (
            <div
              style={{
                display:
                  "grid",

                gap:
                  12
              }}
            >
              {events.map(
                (event) => {
                  const changes =
                    changeSummary(
                      event
                    );

                  return (
                    <div
                      key={
                        event._id
                      }
                      style={{
                        border:
                          "1px solid #e5e7eb",

                        borderRadius:
                          12,

                        padding:
                          14
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",

                          justifyContent:
                            "space-between",

                          gap:
                            12
                        }}
                      >
                        <strong>
                          {ACTION_LABELS[
                            event.action
                          ] ||
                            event.action}
                        </strong>

                        <Badge
                          value={
                            event.action
                          }
                        />
                      </div>

                      <p
                        style={{
                          margin:
                            "8px 0 4px"
                        }}
                      >
                        <strong>
                          Effective:
                        </strong>{" "}
                        {formatDate(
                          event.effectiveDate
                        )}
                      </p>

                      <p>
                        {
                          event.reason
                        }
                      </p>

                      {changes.length >
                        0 && (
                        <div
                          style={{
                            display:
                              "grid",

                            gap:
                              4,

                            marginTop:
                              8
                          }}
                        >
                          {changes.map(
                            (
                              item
                            ) => (
                              <small
                                key={
                                  item
                                }
                              >
                                {
                                  item
                                }
                              </small>
                            )
                          )}
                        </div>
                      )}

                      <small
                        style={{
                          display:
                            "block",

                          marginTop:
                            10
                        }}
                      >
                        By{" "}
                        {event.performedByUserId
                          ? fullName(
                              event.performedByUserId
                            ) ||
                            event.performedByUserId
                              .email
                          : "System"}
                      </small>
                    </div>
                  );
                }
              )}
            </div>
          ) : (
            <EmptyState
              title="No lifecycle actions yet"
              description="Confirmations, promotions, transfers, notice periods and separations will appear here."
            />
          )}
        </div>
      </div>

      <div className="modal-actions">
        <button
          className="button secondary"
          onClick={
            onClose
          }
        >
          Close
        </button>
      </div>
    </Modal>
  );
}