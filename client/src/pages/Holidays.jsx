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
  getError,
} from "../utils/format";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const currentMonth = () =>
  new Date()
    .toISOString()
    .slice(
      0,
      7
    );

const today = () =>
  new Date()
    .toISOString()
    .slice(
      0,
      10
    );

const blankOverride = {
  name: "",
  date: today(),
  endDate: "",
  type: "public",
  workMode: "",
  description: "",
};

const blankPolicy = {
  name: "Work Schedule",
  effectiveFrom: today(),

  weekdayModes: {
    monday: "office",
    tuesday: "office",
    wednesday: "office",
    thursday: "office",
    friday: "office",
    saturday: "off",
    sunday: "off",
  },

  saturdayPolicy: {
    pattern: "alternate",
    firstSaturdayWorking: true,
    workingMode: "wfh",
  },

  notes: "",
};

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const dayKey = (
  day
) =>
  day.toLowerCase();

const prettyType = (
  value
) =>
  String(
    value || ""
  )
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );

const monthLabel = (
  month
) => {
  const [
    year,
    monthNumber,
  ] = month
    .split("-")
    .map(Number);

  return new Date(
    year,
    monthNumber - 1,
    1
  ).toLocaleString(
    "en",
    {
      month: "long",
      year: "numeric",
    }
  );
};

const getDateKey = (
  value
) => {
  if (!value) {
    return "";
  }

  return new Date(
    value
  )
    .toISOString()
    .slice(
      0,
      10
    );
};

/*
|--------------------------------------------------------------------------
| Component
|--------------------------------------------------------------------------
*/

export default function Holidays() {
  const {
    hasPermission,
  } = useAuth();

  const canManage =
    hasPermission(
      "holidays.manage"
    );

  const [
    month,
    setMonth,
  ] = useState(
    currentMonth()
  );

  const [
    calendarDays,
    setCalendarDays,
  ] = useState([]);

  const [
    overrides,
    setOverrides,
  ] = useState([]);

  const [
    policies,
    setPolicies,
  ] = useState([]);

  const [
  activePolicy,
  setActivePolicy,
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
    overrideOpen,
    setOverrideOpen,
  ] = useState(false);

  const [
    policyOpen,
    setPolicyOpen,
  ] = useState(false);

  const [
    editingOverride,
    setEditingOverride,
  ] = useState(null);

  const [
    overrideForm,
    setOverrideForm,
  ] = useState(
    blankOverride
  );

  const [
    policyForm,
    setPolicyForm,
  ] = useState(
    blankPolicy
  );

  const [
    saving,
    setSaving,
  ] = useState(false);

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

        const [
          calendarRes,
          policyRes,
        ] =
          await Promise.all([
            api.get(
              "/holidays/calendar",
              {
                params: {
                  month,
                },
              }
            ),

            api.get(
              "/holidays/policies"
            ),
          ]);

        setCalendarDays(
          calendarRes.data
            ?.days ||
            []
        );

        setOverrides(
          calendarRes.data
            ?.overrides ||
            []
        );

        const policyData =
          policyRes.data ||
          {};

        setPolicies(
          Array.isArray(
            policyData
          )
            ? policyData
            : policyData.policies ||
              []
        );

        setActivePolicy(
          Array.isArray(
            policyData
          )
            ? policyData[0] ||
              null
            : policyData.activePolicy ||
              null
        );

        setError("");
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to load Work Calendar."
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
      month,
    ]
  );

  /*
  |--------------------------------------------------------------------------
  | Calendar Stats
  |--------------------------------------------------------------------------
  */

  const stats =
    useMemo(
      () => {
        const result = {
          office: 0,
          wfh: 0,
          off: 0,
          holiday: 0,
        };

        calendarDays.forEach(
          (
            day
          ) => {
            if (
              day.dayType ===
                "holiday" ||
              day.dayType ===
                "optional_holiday"
            ) {
              result.holiday +=
                1;

              return;
            }

            if (
              !day.isWorkingDay
            ) {
              result.off +=
                1;

              return;
            }

            if (
              day.workMode ===
              "wfh"
            ) {
              result.wfh +=
                1;
            } else {
              result.office +=
                1;
            }
          }
        );

        return result;
      },
      [
        calendarDays,
      ]
    );

  /*
  |--------------------------------------------------------------------------
  | Override Modal
  |--------------------------------------------------------------------------
  */

  const openOverride =
    () => {
      setEditingOverride(
        null
      );

      setOverrideForm({
        ...blankOverride,
        date: today(),
      });

      setError("");

      setOverrideOpen(
        true
      );
    };

  const openEditOverride =
    (
      item
    ) => {
      setEditingOverride(
        item
      );

      setOverrideForm({
        name:
          item.name ||
          "",

        date:
          getDateKey(
            item.date
          ),

        endDate:
          item.endDate
            ? getDateKey(
                item.endDate
              )
            : "",

        type:
          item.type ||
          "public",

        workMode:
          item.workMode ||
          "",

        description:
          item.description ||
          "",
      });

      setError("");

      setOverrideOpen(
        true
      );
    };

  const submitOverride =
    async (
      event
    ) => {
      event.preventDefault();

      try {
        setSaving(
          true
        );

        const payload = {
          ...overrideForm,

          endDate:
            overrideForm.endDate ||
            null,
        };

        if (
          editingOverride
        ) {
          await api.put(
            `/holidays/${editingOverride._id}`,
            payload
          );

          setNotice(
            "Work Calendar override updated."
          );
        } else {
          await api.post(
            "/holidays",
            payload
          );

          setNotice(
            "Work Calendar override added."
          );
        }

        setOverrideOpen(
          false
        );

        setEditingOverride(
          null
        );

        await load();
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to save Work Calendar override."
          )
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  const removeOverride =
    async (
      item
    ) => {
      if (
        !window.confirm(
          `Remove "${item.name}" from the Work Calendar?`
        )
      ) {
        return;
      }

      try {
        await api.delete(
          `/holidays/${item._id}`
        );

        setNotice(
          "Work Calendar override removed."
        );

        await load();
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to remove Work Calendar override."
          )
        );
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Work Policy
  |--------------------------------------------------------------------------
  */

  const openPolicy =
  () => {
    setPolicyForm({
      name:
        activePolicy
          ?.name ||
        "Work Schedule",

      effectiveFrom:
        today(),

      weekdayModes: {
        ...blankPolicy.weekdayModes,

        ...(
          activePolicy
            ?.weekdayModes ||
          {}
        ),
      },

      saturdayPolicy: {
        ...blankPolicy.saturdayPolicy,

        ...(
          activePolicy
            ?.saturdayPolicy ||
          {}
        ),
      },

      notes:
        "",
    });

    setError(
      ""
    );

    setPolicyOpen(
      true
    );
  };

  const updateWeekday =
    (
      day,
      value
    ) => {
      setPolicyForm(
        (
          current
        ) => ({
          ...current,

          weekdayModes: {
            ...current.weekdayModes,

            [day]:
              value,
          },
        })
      );
    };

  const submitPolicy =
    async (
      event
    ) => {
      event.preventDefault();

      try {
        setSaving(
          true
        );

        await api.post(
          "/holidays/policies",
          policyForm
        );

        setPolicyOpen(
          false
        );

        setNotice(
          "New Work Calendar policy created successfully."
        );

        await load();
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to create Work Calendar policy."
          )
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  const removePolicy =
    async (
      policy
    ) => {
      if (
        !window.confirm(
          `Remove the future Work Calendar policy "${policy.name}" scheduled for ${formatDate(policy.effectiveFrom)}?`
        )
      ) {
        return;
      }

      try {
        await api.delete(
          `/holidays/policies/${policy._id}`
        );

        setNotice(
          "Work Calendar policy removed."
        );

        await load();
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to remove Work Calendar policy."
          )
        );
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Current Policy
  |--------------------------------------------------------------------------
  */

  const currentPolicy =
    activePolicy ||
    null;

  const isFuturePolicy =
  (
    policy
  ) =>
    getDateKey(
      policy.effectiveFrom
    ) >
    today();

  /*
  |--------------------------------------------------------------------------
  | UI
  |--------------------------------------------------------------------------
  */

  return (
    <>
      <PageHeader
        title="Work Calendar"
        description="Manage office days, WFH days, off days, holidays and special working dates."
        action={
          canManage ? (
            <div className="table-actions">
              <button
                className="button secondary"
                onClick={
                  openPolicy
                }
              >
                + Work Policy
              </button>

              <button
                className="button primary"
                onClick={
                  openOverride
                }
              >
                + Date Override
              </button>
            </div>
          ) : null
        }
      />

      {notice && (
        <Alert type="success">
          {notice}
        </Alert>
      )}

      {error &&
        !overrideOpen &&
        !policyOpen && (
          <Alert type="error">
            {error}
          </Alert>
        )}

      {/* -------------------------------------------------------------- */}
      {/* Month */}
      {/* -------------------------------------------------------------- */}

      <Card>
        <div className="card-head">
          <div>
            <h2>
              {monthLabel(
                month
              )}
            </h2>

            <p>
              Resolved organization
              Work Calendar.
            </p>
          </div>

          <label className="field">
            <span>
              Month
            </span>

            <input
              type="month"
              value={
                month
              }
              onChange={(
                event
              ) =>
                setMonth(
                  event
                    .target
                    .value
                )
              }
            />
          </label>
        </div>
      </Card>

      {/* -------------------------------------------------------------- */}
      {/* Stats */}
      {/* -------------------------------------------------------------- */}

      <div className="stats-grid">
        <Card>
          <span className="eyebrow">
            Office
          </span>

          <h2>
            {
              stats.office
            }
          </h2>

          <p>
            Working from office
          </p>
        </Card>

        <Card>
          <span className="eyebrow">
            WFH
          </span>

          <h2>
            {
              stats.wfh
            }
          </h2>

          <p>
            Work from home
          </p>
        </Card>

        <Card>
          <span className="eyebrow">
            Off
          </span>

          <h2>
            {
              stats.off
            }
          </h2>

          <p>
            Non-working days
          </p>
        </Card>

        <Card>
          <span className="eyebrow">
            Holidays
          </span>

          <h2>
            {
              stats.holiday
            }
          </h2>

          <p>
            Public / company holidays
          </p>
        </Card>
      </div>

      {/* -------------------------------------------------------------- */}
      {/* Calendar */}
      {/* -------------------------------------------------------------- */}

      <Card>
        <div className="card-head">
          <div>
            <h2>
              Monthly Calendar
            </h2>

            <p>
              Final resolved day
              status after recurring
              policy and date
              overrides.
            </p>
          </div>
        </div>

        {loading ? (
          <p>
            Loading Work
            Calendar...
          </p>
        ) : calendarDays.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    Date
                  </th>

                  <th>
                    Day
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Work Mode
                  </th>

                  <th>
                    Label
                  </th>

                  <th>
                    Source
                  </th>
                </tr>
              </thead>

              <tbody>
                {calendarDays.map(
                  (
                    day
                  ) => (
                    <tr
                      key={
                        getDateKey(
                          day.date
                        )
                      }
                    >
                      <td>
                        <strong>
                          {formatDate(
                            day.date
                          )}
                        </strong>
                      </td>

                      <td>
                        {prettyType(
                          day.weekday
                        )}
                      </td>

                      <td>
                        <Badge
                          value={
                            day.dayType ||
                            "off"
                          }
                        />
                      </td>

                      <td>
                        {day.workMode
                          ? (
                              <Badge
                                value={
                                  day.workMode
                                }
                              />
                            )
                          : "—"}
                      </td>

                      <td>
                        {
                          day.label
                        }
                      </td>

                      <td>
                        <Badge
                          value={
                            day.source
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
            title="No calendar data"
            description="No Work Calendar days were generated for the selected month."
          />
        )}
      </Card>

      {/* -------------------------------------------------------------- */}
      {/* Active Policy */}
      {/* -------------------------------------------------------------- */}

      <Card>
        <div className="card-head">
          <div>
            <h2>
              Work Schedule Policy
            </h2>

            <p>
              Effective-dated recurring
              weekly schedule.
            </p>
          </div>

          {canManage && (
            <button
              className="button secondary"
              onClick={
                openPolicy
              }
            >
              New Policy
            </button>
          )}
        </div>

        {currentPolicy ? (
          <>
            <div className="form-grid three">
              <div>
                <span className="eyebrow">
                  Policy
                </span>

                <strong>
                  {
                    currentPolicy.name
                  }
                </strong>
              </div>

              <div>
                <span className="eyebrow">
                  Effective From
                </span>

                <strong>
                  {formatDate(
                    currentPolicy.effectiveFrom
                  )}
                </strong>
              </div>

              <div>
                <span className="eyebrow">
                  Saturday Pattern
                </span>

                <strong>
                  {prettyType(
                    currentPolicy
                      .saturdayPolicy
                      ?.pattern
                  )}
                </strong>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {DAYS.map(
                      (
                        day
                      ) => (
                        <th
                          key={
                            day
                          }
                        >
                          {
                            day
                          }
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  <tr>
                    {DAYS.map(
                      (
                        day
                      ) => (
                        <td
                          key={
                            day
                          }
                        >
                          <Badge
                            value={
                              currentPolicy
                                .weekdayModes
                                ?.[
                                  dayKey(
                                    day
                                  )
                                ] ||
                              "off"
                            }
                          />
                        </td>
                      )
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState
            title="No Work Calendar policy"
            description="The system currently uses the default Monday-Friday office schedule."
          />
        )}
      </Card>

      {/* -------------------------------------------------------------- */}
      {/* Policy History */}
      {/* -------------------------------------------------------------- */}

      <Card>
        <div className="card-head">
          <div>
            <h2>
              Policy History
            </h2>

            <p>
              Previous schedules remain
              available for historical
              attendance calculations.
            </p>
          </div>
        </div>

        {policies.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    Policy
                  </th>

                  <th>
                    Effective From
                  </th>

                  <th>
                    Saturday
                  </th>

                  <th>
                    Notes
                  </th>

                  <th />
                </tr>
              </thead>

              <tbody>
                {policies.map(
                  (
                    policy
                  ) => (
                    <tr
                      key={
                        policy._id
                      }
                    >
                      <td>
                        <strong>
                          {
                            policy.name
                          }
                        </strong>
                      </td>

                      <td>
                        {formatDate(
                          policy.effectiveFrom
                        )}
                      </td>

                      <td>
                        {prettyType(
                          policy
                            .saturdayPolicy
                            ?.pattern
                        )}
                      </td>

                      <td>
                        {
                          policy.notes ||
                          "—"
                        }
                      </td>

                      <td>
                        {canManage &&
                          isFuturePolicy(
                            policy
                          ) ? (
                            <button
                              className="text-button danger"
                              onClick={() =>
                                removePolicy(
                                  policy
                                )
                              }
                            >
                              Remove
                            </button>
                          ) : (
                            <small>
                              {String(
                                policy._id
                              ) ===
                              String(
                                currentPolicy?._id
                              )
                                ? "Current"
                                : "History protected"}
                            </small>
                          )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No policy history"
            description="Create a Work Calendar policy to define recurring office, WFH and off days."
          />
        )}
      </Card>

      {/* -------------------------------------------------------------- */}
      {/* Overrides */}
      {/* -------------------------------------------------------------- */}

      <Card>
        <div className="card-head">
          <div>
            <h2>
              Date Overrides
            </h2>

            <p>
              Holidays, special off
              days, WFH days and
              working-day exceptions.
            </p>
          </div>

          {canManage && (
            <button
              className="button secondary"
              onClick={
                openOverride
              }
            >
              + Add Override
            </button>
          )}
        </div>

        {overrides.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    Name
                  </th>

                  <th>
                    Date
                  </th>

                  <th>
                    End Date
                  </th>

                  <th>
                    Type
                  </th>

                  <th>
                    Description
                  </th>

                  <th />
                </tr>
              </thead>

              <tbody>
                {overrides.map(
                  (
                    item
                  ) => (
                    <tr
                      key={
                        item._id
                      }
                    >
                      <td>
                        <strong>
                          {
                            item.name
                          }
                        </strong>
                      </td>

                      <td>
                        {formatDate(
                          item.date
                        )}
                      </td>

                      <td>
                        {item.endDate
                          ? formatDate(
                              item.endDate
                            )
                          : "—"}
                      </td>

                      <td>
                        <Badge
                          value={
                            item.type
                          }
                        />
                      </td>

                      <td>
                        {
                          item.description ||
                          "—"
                        }
                      </td>

                      <td>
                        {canManage && (
                          <div className="table-actions">
                            <button
                              className="text-button"
                              onClick={() =>
                                openEditOverride(
                                  item
                                )
                              }
                            >
                              Edit
                            </button>

                            <button
                              className="text-button danger"
                              onClick={() =>
                                removeOverride(
                                  item
                                )
                              }
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No date overrides"
            description="Add holidays or special schedule changes when required."
          />
        )}
      </Card>

      {/* ============================================================= */}
      {/* Override Modal */}
      {/* ============================================================= */}

      <Modal
        open={
          overrideOpen
        }
        onClose={() =>
          setOverrideOpen(
            false
          )
        }
        title={
          editingOverride
            ? "Edit Work Calendar Override"
            : "Add Work Calendar Override"
        }
      >
        <form
          onSubmit={
            submitOverride
          }
        >
          {error && (
            <Alert type="error">
              {error}
            </Alert>
          )}

          <label className="field">
            <span>
              Name *
            </span>

            <input
              required
              value={
                overrideForm.name
              }
              onChange={(
                event
              ) =>
                setOverrideForm(
                  {
                    ...overrideForm,

                    name:
                      event
                        .target
                        .value,
                  }
                )
              }
            />
          </label>

          <div className="form-grid two">
            <label className="field">
              <span>
                Start Date *
              </span>

              <input
                type="date"
                required
                value={
                  overrideForm.date
                }
                onChange={(
                  event
                ) =>
                  setOverrideForm(
                    {
                      ...overrideForm,

                      date:
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
                End Date
              </span>

              <input
                type="date"
                value={
                  overrideForm.endDate
                }
                onChange={(
                  event
                ) =>
                  setOverrideForm(
                    {
                      ...overrideForm,

                      endDate:
                        event
                          .target
                          .value,
                    }
                  )
                }
              />
            </label>
          </div>

          <label className="field">
            <span>
              Override Type *
            </span>

            <select
              value={
                overrideForm.type
              }
              onChange={(
                event
              ) =>
                setOverrideForm(
                  {
                    ...overrideForm,

                    type:
                      event
                        .target
                        .value,
                  }
                )
              }
            >
              <option value="public">
                Public Holiday
              </option>

              <option value="company">
                Company Holiday
              </option>

              <option value="optional">
                Optional Holiday
              </option>

              <option value="off">
                Special Off Day
              </option>

              <option value="wfh">
                WFH Day
              </option>

              <option value="working">
                Special Working Day
              </option>
            </select>
          </label>

          {overrideForm.type ===
            "working" && (
            <label className="field">
              <span>
                Work Mode
              </span>

              <select
                value={
                  overrideForm.workMode ||
                  "office"
                }
                onChange={(
                  event
                ) =>
                  setOverrideForm(
                    {
                      ...overrideForm,

                      workMode:
                        event
                          .target
                          .value,
                    }
                  )
                }
              >
                <option value="office">
                  Office
                </option>

                <option value="wfh">
                  WFH
                </option>
              </select>
            </label>
          )}

          <label className="field">
            <span>
              Description
            </span>

            <textarea
              rows="4"
              value={
                overrideForm.description
              }
              onChange={(
                event
              ) =>
                setOverrideForm(
                  {
                    ...overrideForm,

                    description:
                      event
                        .target
                        .value,
                  }
                )
              }
            />
          </label>

          <div className="save-bar">
            <button
              className="button primary"
              disabled={
                saving
              }
            >
              {saving
                ? "Saving..."
                : editingOverride
                  ? "Update Override"
                  : "Add Override"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================= */}
      {/* Policy Modal */}
      {/* ============================================================= */}

      <Modal
        open={
          policyOpen
        }
        onClose={() =>
          setPolicyOpen(
            false
          )
        }
        title="Create Work Calendar Policy"
      >
        <form
          onSubmit={
            submitPolicy
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
                Policy Name *
              </span>

              <input
                required
                value={
                  policyForm.name
                }
                onChange={(
                  event
                ) =>
                  setPolicyForm(
                    {
                      ...policyForm,

                      name:
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
                Effective From *
              </span>

              <input
                type="date"
                required
                value={
                  policyForm.effectiveFrom
                }
                onChange={(
                  event
                ) =>
                  setPolicyForm(
                    {
                      ...policyForm,

                      effectiveFrom:
                        event
                          .target
                          .value,
                    }
                  )
                }
              />
            </label>
          </div>

          <Card>
            <div className="card-head">
              <div>
                <h2>
                  Weekly Schedule
                </h2>

                <p>
                  Select the normal
                  work mode for each
                  weekday.
                </p>
              </div>
            </div>

            {DAYS.map(
              (
                day
              ) => (
                <label
                  className="field"
                  key={
                    day
                  }
                >
                  <span>
                    {
                      day
                    }
                  </span>

                  <select
                    value={
                      policyForm
                        .weekdayModes[
                        dayKey(
                          day
                        )
                      ]
                    }
                    onChange={(
                      event
                    ) =>
                      updateWeekday(
                        dayKey(
                          day
                        ),
                        event
                          .target
                          .value
                      )
                    }
                  >
                    <option value="office">
                      Office
                    </option>

                    <option value="wfh">
                      WFH
                    </option>

                    <option value="off">
                      Off
                    </option>
                  </select>
                </label>
              )
            )}
          </Card>

          <Card>
            <div className="card-head">
              <div>
                <h2>
                  Saturday Policy
                </h2>

                <p>
                  Configure recurring
                  Saturday schedule.
                </p>
              </div>
            </div>

            <label className="field">
              <span>
                Pattern
              </span>

              <select
                value={
                  policyForm
                    .saturdayPolicy
                    .pattern
                }
                onChange={(
                  event
                ) =>
                  setPolicyForm(
                    {
                      ...policyForm,

                      saturdayPolicy: {
                        ...policyForm.saturdayPolicy,

                        pattern:
                          event
                            .target
                            .value,
                      },
                    }
                  )
                }
              >
                <option value="standard">
                  Use Saturday Weekday Setting
                </option>

                <option value="alternate">
                  Alternate Saturdays
                </option>

                <option value="all_working">
                  All Saturdays Working
                </option>

                <option value="all_off">
                  All Saturdays Off
                </option>
              </select>
            </label>

            {[
              "alternate",
              "all_working",
            ].includes(
              policyForm
                .saturdayPolicy
                .pattern
            ) && (
              <label className="field">
                <span>
                  Working Saturday Mode
                </span>

                <select
                  value={
                    policyForm
                      .saturdayPolicy
                      .workingMode
                  }
                  onChange={(
                    event
                  ) =>
                    setPolicyForm(
                      {
                        ...policyForm,

                        saturdayPolicy: {
                          ...policyForm.saturdayPolicy,

                          workingMode:
                            event
                              .target
                              .value,
                        },
                      }
                    )
                  }
                >
                  <option value="wfh">
                    WFH
                  </option>

                  <option value="office">
                    Office
                  </option>
                </select>
              </label>
            )}

            {policyForm
              .saturdayPolicy
              .pattern ===
              "alternate" && (
              <label className="field checkbox-field">
                <input
                  type="checkbox"
                  checked={
                    policyForm
                      .saturdayPolicy
                      .firstSaturdayWorking
                  }
                  onChange={(
                    event
                  ) =>
                    setPolicyForm(
                      {
                        ...policyForm,

                        saturdayPolicy: {
                          ...policyForm.saturdayPolicy,

                          firstSaturdayWorking:
                            event
                              .target
                              .checked,
                        },
                      }
                    )
                  }
                />

                <span>
                  1st Saturday is
                  working
                </span>
              </label>
            )}
          </Card>

          <label className="field">
            <span>
              Notes
            </span>

            <textarea
              rows="3"
              value={
                policyForm.notes
              }
              onChange={(
                event
              ) =>
                setPolicyForm(
                  {
                    ...policyForm,

                    notes:
                      event
                        .target
                        .value,
                  }
                )
              }
            />
          </label>

          <div className="save-bar">
            <button
              className="button primary"
              disabled={
                saving
              }
            >
              {saving
                ? "Saving..."
                : "Create Work Policy"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}