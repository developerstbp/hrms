import {
  useEffect,
  useMemo,
  useState,
} from "react";

import * as XLSX from "xlsx";

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

const today = () =>
  new Date()
    .toISOString()
    .slice(
      0,
      10
    );

const blankManual = {
  employeeId:
    "",

  date:
    today(),

  checkIn:
    "",

  checkOut:
    "",

  status:
    "present",

  notes:
    "",
};

const blankProcess = {
  from:
    today(),

  to:
    today(),
};

const normalizeHeader = (
  value = ""
) =>
  String(value)
    .toLowerCase()
    .replace(
      /[^a-z0-9]/g,
      ""
    );

const HEADER_MAP = {
  employeecode:
    "employeeCode",

  date:
    "date",

  checkin:
    "checkIn",

  checkout:
    "checkOut",

  punchtime:
    "punchTime",

  punchtype:
    "punchType",
};

const pad = (
  value
) =>
  String(value).padStart(
    2,
    "0"
  );

const excelDate = (
  value
) => {
  if (
    !value &&
    value !==
      0
  ) {
    return "";
  }

  if (
    value instanceof Date &&
    !Number.isNaN(
      value.getTime()
    )
  ) {
    return `${value.getFullYear()}-${pad(
      value.getMonth() +
        1
    )}-${pad(
      value.getDate()
    )}`;
  }

  if (
    typeof value ===
    "number"
  ) {
    const parsed =
      XLSX.SSF.parse_date_code(
        value
      );

    if (
      parsed
    ) {
      return `${parsed.y}-${pad(
        parsed.m
      )}-${pad(
        parsed.d
      )}`;
    }
  }

  const raw =
    String(
      value
    ).trim();

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      raw
    )
  ) {
    return raw;
  }

  const parsed =
    new Date(
      raw
    );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return raw;
  }

  return `${parsed.getFullYear()}-${pad(
    parsed.getMonth() +
      1
  )}-${pad(
    parsed.getDate()
  )}`;
};

const excelTime = (
  value
) => {
  if (
    value ===
      undefined ||
    value ===
      null ||
    value ===
      ""
  ) {
    return "";
  }

  if (
    value instanceof Date &&
    !Number.isNaN(
      value.getTime()
    )
  ) {
    return `${pad(
      value.getHours()
    )}:${pad(
      value.getMinutes()
    )}`;
  }

  if (
    typeof value ===
    "number"
  ) {
    const totalMinutes =
      Math.round(
        (
          value %
          1
        ) *
          24 *
          60
      );

    return `${pad(
      Math.floor(
        totalMinutes /
          60
      ) %
        24
    )}:${pad(
      totalMinutes %
        60
    )}`;
  }

  return String(
    value
  ).trim();
};

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

  const mins =
    total %
    60;

  return mins
    ? `${hours}h ${mins}m`
    : `${hours}h`;
};

/*
|--------------------------------------------------------------------------
| Component
|--------------------------------------------------------------------------
*/

export default function Attendance() {
  const {
    employee,
    hasPermission,
  } = useAuth();

  const canManage =
    hasPermission(
      "attendance.manage"
    );

  const canView =
    hasPermission(
      "attendance.view"
    ) ||
    canManage;

  const canSelf =
    hasPermission(
      "attendance.self"
    ) &&
    employee;

  /*
  |--------------------------------------------------------------------------
  | Data
  |--------------------------------------------------------------------------
  */

  const [
    records,
    setRecords,
  ] = useState([]);

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    todayRecord,
    setTodayRecord,
  ] = useState(null);

  const [
    exceptions,
    setExceptions,
  ] = useState([]);

  const [
    imports,
    setImports,
  ] = useState([]);

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(
    today()
  );

  const [
    tab,
    setTab,
  ] = useState(
    "daily"
  );

  const [
    error,
    setError,
  ] = useState("");

  const [
    notice,
    setNotice,
  ] = useState("");

  const [
    busy,
    setBusy,
  ] = useState(false);

  /*
  |--------------------------------------------------------------------------
  | Manual Entry
  |--------------------------------------------------------------------------
  */

  const [
    manualOpen,
    setManualOpen,
  ] = useState(false);

  const [
    manualForm,
    setManualForm,
  ] = useState(
    blankManual
  );

  /*
  |--------------------------------------------------------------------------
  | Excel Import
  |--------------------------------------------------------------------------
  */

  const [
    importOpen,
    setImportOpen,
  ] = useState(false);

  const [
    importRows,
    setImportRows,
  ] = useState([]);

  const [
    importFileName,
    setImportFileName,
  ] = useState("");

  const [
    importPreview,
    setImportPreview,
  ] = useState(null);

  const [
    importBusy,
    setImportBusy,
  ] = useState(false);

  /*
  |--------------------------------------------------------------------------
  | Processing
  |--------------------------------------------------------------------------
  */

  const [
    processOpen,
    setProcessOpen,
  ] = useState(false);

  const [
    processForm,
    setProcessForm,
  ] = useState(
    blankProcess
  );

  /*
  |--------------------------------------------------------------------------
  | Exception Resolution
  |--------------------------------------------------------------------------
  */

  const [
    resolveRecord,
    setResolveRecord,
  ] = useState(null);

  const [
    resolveForm,
    setResolveForm,
  ] = useState({
    checkIn:
      "",

    checkOut:
      "",

    status:
      "present",

    resolutionNote:
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
        const calls = [
          api.get(
            `/attendance?from=${selectedDate}&to=${selectedDate}`
          ),
        ];

        if (
          canSelf
        ) {
          calls.push(
            api.get(
              "/attendance/today"
            )
          );
        }

        if (
          canManage
        ) {
          calls.push(
            api.get(
              "/employees"
            )
          );
        }

        if (
          canView
        ) {
          calls.push(
            api.get(
              "/attendance/exceptions"
            )
          );
        }

        if (
          canManage
        ) {
          calls.push(
            api.get(
              "/attendance/imports"
            )
          );
        }

        const result =
          await Promise.all(
            calls
          );

        let index =
          0;

        setRecords(
          result[
            index++
          ].data ||
            []
        );

        if (
          canSelf
        ) {
          setTodayRecord(
            result[
              index++
            ].data ||
              null
          );
        }

        if (
          canManage
        ) {
          setEmployees(
            result[
              index++
            ].data ||
              []
          );
        }

        if (
          canView
        ) {
          setExceptions(
            result[
              index++
            ].data ||
              []
          );
        }

        if (
          canManage
        ) {
          setImports(
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
            "Unable to load attendance."
          )
        );
      }
    };

  useEffect(
    () => {
      load();
    },
    [
      selectedDate,
    ]
  );

  /*
  |--------------------------------------------------------------------------
  | Self Attendance
  |--------------------------------------------------------------------------
  */

  const selfAction =
    async (
      type
    ) => {
      try {
        setBusy(
          true
        );

        setError(
          ""
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
  | Summary
  |--------------------------------------------------------------------------
  */

  const summary =
    useMemo(
      () => ({
        present:
          records.filter(
            (
              record
            ) =>
              record.status ===
              "present"
          ).length,

        late:
          records.filter(
            (
              record
            ) =>
              record.status ===
              "late"
          ).length,

        absent:
          records.filter(
            (
              record
            ) =>
              record.status ===
              "absent"
          ).length,

        exceptions:
          records.filter(
            (
              record
            ) =>
              record.isException &&
              !record.exceptionResolved
          ).length,
      }),
      [
        records,
      ]
    );

  /*
  |--------------------------------------------------------------------------
  | Manual Entry
  |--------------------------------------------------------------------------
  */

  const saveManual =
    async (
      event
    ) => {
      event.preventDefault();

      try {
        setBusy(
          true
        );

        await api.post(
          "/attendance/manual",
          manualForm
        );

        setManualOpen(
          false
        );

        setManualForm({
          ...blankManual,

          date:
            selectedDate,
        });

        setNotice(
          "Attendance saved successfully."
        );

        await load();
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to save attendance."
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
  | Download Excel Template
  |--------------------------------------------------------------------------
  */

  const downloadTemplate =
    () => {
      const workbook =
        XLSX.utils.book_new();

      const attendanceSheet =
        XLSX.utils.aoa_to_sheet([
          [
            "Employee Code",
            "Date",
            "Check In",
            "Check Out",
          ],

          [
            "EMP001",
            today(),
            "10:00",
            "18:30",
          ],
        ]);

      attendanceSheet[
        "!cols"
      ] = [
        {
          wch:
            20,
        },

        {
          wch:
            16,
        },

        {
          wch:
            16,
        },

        {
          wch:
            16,
        },
      ];

      const instructions =
        XLSX.utils.aoa_to_sheet([
          [
            "Attendance Import Instructions",
          ],

          [
            "1",
            "Use one row per employee per date.",
          ],

          [
            "2",
            "Employee Code must already exist in HRMS.",
          ],

          [
            "3",
            "Use YYYY-MM-DD for Date.",
          ],

          [
            "4",
            "Use HH:MM for Check In and Check Out.",
          ],

          [
            "5",
            "Punch Time / Punch Type can later be used for biometric-style raw punches.",
          ],
        ]);

      XLSX.utils.book_append_sheet(
        workbook,
        attendanceSheet,
        "Attendance"
      );

      XLSX.utils.book_append_sheet(
        workbook,
        instructions,
        "Instructions"
      );

      XLSX.writeFile(
        workbook,
        "HRMS_Attendance_Import_Template.xlsx"
      );
    };

  /*
  |--------------------------------------------------------------------------
  | Read Excel
  |--------------------------------------------------------------------------
  */

  const parseImportFile =
    async (
      file
    ) => {
      setImportRows(
        []
      );

      setImportPreview(
        null
      );

      setImportFileName(
        ""
      );

      setError(
        ""
      );

      if (
        !file
      ) {
        return;
      }

      try {
        const buffer =
          await file.arrayBuffer();

        const workbook =
          XLSX.read(
            buffer,
            {
              type:
                "array",

              cellDates:
                true,
            }
          );

        const sheet =
          workbook.Sheets[
            workbook
              .SheetNames[
              0
            ]
          ];

        const rawRows =
          XLSX.utils.sheet_to_json(
            sheet,
            {
              defval:
                "",

              raw:
                true,
            }
          );

        const rows =
          rawRows
            .map(
              (
                raw,
                index
              ) => {
                const row = {
                  rowNumber:
                    index +
                    2,
                };

                Object.entries(
                  raw
                ).forEach(
                  ([
                    header,
                    value,
                  ]) => {
                    const key =
                      HEADER_MAP[
                        normalizeHeader(
                          header
                        )
                      ];

                    if (
                      !key
                    ) {
                      return;
                    }

                    if (
                      key ===
                      "date"
                    ) {
                      row[
                        key
                      ] =
                        excelDate(
                          value
                        );
                    } else if (
                      [
                        "checkIn",
                        "checkOut",
                        "punchTime",
                      ].includes(
                        key
                      )
                    ) {
                      row[
                        key
                      ] =
                        excelTime(
                          value
                        );
                    } else {
                      row[
                        key
                      ] =
                        String(
                          value ??
                            ""
                        ).trim();
                    }
                  }
                );

                return row;
              }
            )
            .filter(
              (
                row
              ) =>
                row.employeeCode ||
                row.date ||
                row.checkIn ||
                row.checkOut ||
                row.punchTime
            );

        setImportRows(
          rows
        );

        setImportFileName(
          file.name
        );

        if (
          !rows.length
        ) {
          setError(
            "No attendance rows were found in the first worksheet."
          );
        }
      } catch (err) {
        setError(
          "Unable to read this Excel file. Please use the attendance import template."
        );
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Validate Excel
  |--------------------------------------------------------------------------
  */

  const previewImport =
    async () => {
      if (
        !importRows.length
      ) {
        return;
      }

      try {
        setImportBusy(
          true
        );

        setError(
          ""
        );

        const {
          data,
        } =
          await api.post(
            "/attendance/import/preview",
            {
              rows:
                importRows,
            }
          );

        setImportPreview(
          data
        );
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to validate attendance file."
          )
        );
      } finally {
        setImportBusy(
          false
        );
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Import Excel
  |--------------------------------------------------------------------------
  */

  const commitImport =
    async () => {
      if (
        !importRows.length ||
        !importPreview
      ) {
        return;
      }

      try {
        setImportBusy(
          true
        );

        const {
          data,
        } =
          await api.post(
            "/attendance/import",
            {
              fileName:
                importFileName,

              rows:
                importRows,
            }
          );

        setNotice(
          `Import complete: ${data.punchesCreated} punches added${
            data.duplicatesSkipped
              ? `, ${data.duplicatesSkipped} duplicates skipped`
              : ""
          }. Now process attendance.`
        );

        setProcessForm({
          from:
            data.periodStart ||
            selectedDate,

          to:
            data.periodEnd ||
            selectedDate,
        });

        setImportOpen(
          false
        );

        setProcessOpen(
          true
        );

        setImportRows(
          []
        );

        setImportPreview(
          null
        );

        setImportFileName(
          ""
        );

        await load();
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to import attendance."
          )
        );
      } finally {
        setImportBusy(
          false
        );
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Process Attendance
  |--------------------------------------------------------------------------
  */

  const processAttendance =
    async (
      event
    ) => {
      event.preventDefault();

      try {
        setBusy(
          true
        );

        setError(
          ""
        );

        const {
          data,
        } =
          await api.post(
            "/attendance/process",
            processForm
          );

        setProcessOpen(
          false
        );

        setSelectedDate(
          processForm.to
        );

        setNotice(
          `Attendance processed: ${data.attendanceUpdated} records updated, ${data.exceptionsCreated} exception(s) found.`
        );

        await load();
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to process attendance."
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
  | Resolve Exception
  |--------------------------------------------------------------------------
  */

  const openResolve =
    (
      record
    ) => {
      setResolveRecord(
        record
      );

      setResolveForm({
        checkIn:
          record.checkIn ||
          "",

        checkOut:
          record.checkOut ||
          "",

        status:
          record.status ===
          "incomplete"
            ? "present"
            : record.status,

        resolutionNote:
          "",
      });

      setError(
        ""
      );
    };

  const resolveException =
    async (
      event
    ) => {
      event.preventDefault();

      try {
        setBusy(
          true
        );

        await api.put(
          `/attendance/exceptions/${resolveRecord._id}/resolve`,
          resolveForm
        );

        setResolveRecord(
          null
        );

        setNotice(
          "Attendance exception resolved."
        );

        await load();
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to resolve attendance exception."
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
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Daily attendance first. Import, process and review exceptions only when needed."
        action={
          canManage ? (
            <div className="button-row">
              <button
                className="button secondary"
                onClick={() => {
                  setManualForm({
                    ...blankManual,

                    date:
                      selectedDate,
                  });

                  setManualOpen(
                    true
                  );
                }}
              >
                Manual Entry
              </button>

              <button
                className="button secondary"
                onClick={() => {
                  setImportRows(
                    []
                  );

                  setImportPreview(
                    null
                  );

                  setImportFileName(
                    ""
                  );

                  setImportOpen(
                    true
                  );
                }}
              >
                Import Attendance
              </button>

              <button
                className="button primary"
                onClick={() => {
                  setProcessForm({
                    from:
                      selectedDate,

                    to:
                      selectedDate,
                  });

                  setProcessOpen(
                    true
                  );
                }}
              >
                Process Attendance
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
        !manualOpen &&
        !importOpen &&
        !processOpen &&
        !resolveRecord && (
          <Alert type="error">
            {error}
          </Alert>
        )}

      {/* ============================================================= */}
      {/* Employee Self Attendance */}
      {/* ============================================================= */}

      {canSelf && (
        <Card className="attendance-banner">
          <div>
            <span className="eyebrow">
              My Day
            </span>

            <h2>
              {todayRecord
                ?.checkIn
                ? "You're checked in"
                : "Ready to start your day?"}
            </h2>

            <p>
              {todayRecord
                ?.checkIn
                ? `Check in ${todayRecord.checkIn}${
                    todayRecord.checkOut
                      ? ` · Check out ${todayRecord.checkOut}`
                      : ""
                  }${
                    todayRecord.shiftName
                      ? ` · ${todayRecord.shiftName}`
                      : ""
                  }`
                : "Your assigned shift and Work Calendar automatically determine today's attendance rules."}
            </p>
          </div>

          <div className="button-row">
            {!todayRecord
              ?.checkIn && (
              <button
                className="button primary"
                disabled={
                  busy
                }
                onClick={() =>
                  selfAction(
                    "check-in"
                  )
                }
              >
                Check In
              </button>
            )}

            {todayRecord
              ?.checkIn &&
              !todayRecord
                ?.checkOut && (
                <button
                  className="button primary"
                  disabled={
                    busy
                  }
                  onClick={() =>
                    selfAction(
                      "check-out"
                    )
                  }
                >
                  Check Out
                </button>
              )}

            {todayRecord
              ?.status && (
              <Badge
                value={
                  todayRecord.status
                }
              />
            )}
          </div>
        </Card>
      )}

      {/* ============================================================= */}
      {/* Summary */}
      {/* ============================================================= */}

      <div className="stats-grid compact">
        <StatCard
          label="Present"
          value={
            summary.present
          }
          icon="✓"
        />

        <StatCard
          label="Late"
          value={
            summary.late
          }
          icon="!"
        />

        <StatCard
          label="Absent"
          value={
            summary.absent
          }
          icon="○"
        />

        <StatCard
          label="Exceptions"
          value={
            summary.exceptions
          }
          icon="⚠"
        />
      </div>

      {/* ============================================================= */}
      {/* Main Attendance */}
      {/* ============================================================= */}

      <Card>
        <div className="card-head">
          <div>
            <h2>
              Daily Attendance
            </h2>

            <p>
              Select a date and review
              the final processed
              attendance.
            </p>
          </div>

          <label
            className="field"
            style={{
              margin:
                0,

              minWidth:
                170,
            }}
          >
            <span>
              Date
            </span>

            <input
              type="date"
              value={
                selectedDate
              }
              onChange={(
                event
              ) =>
                setSelectedDate(
                  event
                    .target
                    .value
                )
              }
            />
          </label>
        </div>

        {canView && (
          <div
            className="button-row"
            style={{
              marginBottom:
                16,
            }}
          >
            <button
              className={`button ${
                tab ===
                "daily"
                  ? "primary"
                  : "secondary"
              }`}
              onClick={() =>
                setTab(
                  "daily"
                )
              }
            >
              Daily Attendance
            </button>

            <button
              className={`button ${
                tab ===
                "exceptions"
                  ? "primary"
                  : "secondary"
              }`}
              onClick={() =>
                setTab(
                  "exceptions"
                )
              }
            >
              Exceptions (
              {
                exceptions.length
              }
              )
            </button>
          </div>
        )}

        {tab ===
        "daily" ? (
          records.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      Employee
                    </th>

                    <th>
                      Shift
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
                      Status
                    </th>

                    <th>
                      Mode
                    </th>

                    <th>
                      Source
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {records.map(
                    (
                      record
                    ) => (
                      <tr
                        key={
                          record._id
                        }
                      >
                        <td>
                          <strong>
                            {fullName(
                              record.employeeId
                            )}
                          </strong>

                          <small>
                            {
                              record
                                .employeeId
                                ?.employeeCode
                            }
                          </small>
                        </td>

                        <td>
                          <strong>
                            {record.shiftName ||
                              "—"}
                          </strong>

                          <small>
                            {record.scheduledStart &&
                            record.scheduledEnd
                              ? `${record.scheduledStart} — ${record.scheduledEnd}`
                              : ""}
                          </small>
                        </td>

                        <td>
                          {record.checkIn ||
                            "—"}
                        </td>

                        <td>
                          {record.checkOut ||
                            "—"}
                        </td>

                        <td>
                          {hoursLabel(
                            record.workedMinutes
                          )}
                        </td>

                        <td>
                          <Badge
                            value={
                              record.status
                            }
                          />

                          {record.isException &&
                          !record.exceptionResolved ? (
                            <small>
                              Needs review
                            </small>
                          ) : null}
                        </td>

                        <td>
                          {record.workMode
                            ? record.workMode.toUpperCase()
                            : "—"}
                        </td>

                        <td className="capitalize">
                          {record.source ||
                            "—"}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No attendance for this date"
              description="Import and process attendance, or add a manual entry."
            />
          )
        ) : exceptions.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    Employee
                  </th>

                  <th>
                    Date
                  </th>

                  <th>
                    Issue
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
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {exceptions.map(
                  (
                    record
                  ) => (
                    <tr
                      key={
                        record._id
                      }
                    >
                      <td>
                        <strong>
                          {fullName(
                            record.employeeId
                          )}
                        </strong>

                        <small>
                          {
                            record
                              .employeeId
                              ?.employeeCode
                          }
                        </small>
                      </td>

                      <td>
                        {formatDate(
                          record.date
                        )}
                      </td>

                      <td>
                        <strong
                          style={{
                            textTransform:
                              "capitalize",
                          }}
                        >
                          {String(
                            record.exceptionType ||
                              "Exception"
                          ).replaceAll(
                            "-",
                            " "
                          )}
                        </strong>

                        <small>
                          {
                            record.exceptionReason
                          }
                        </small>
                      </td>

                      <td>
                        {record.checkIn ||
                          "—"}
                      </td>

                      <td>
                        {record.checkOut ||
                          "—"}
                      </td>

                      <td>
                        {hoursLabel(
                          record.workedMinutes
                        )}
                      </td>

                      <td>
                        {canManage ? (
                          <button
                            className="text-button"
                            onClick={() =>
                              openResolve(
                                record
                              )
                            }
                          >
                            Resolve
                          </button>
                        ) : (
                          "Review pending"
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
            title="No attendance exceptions"
            description="Everything currently looks resolved."
          />
        )}
      </Card>

      {/* ============================================================= */}
      {/* Import History */}
      {/* ============================================================= */}

      {canManage &&
        imports.length >
          0 && (
          <Card>
            <details>
              <summary
                style={{
                  cursor:
                    "pointer",

                  fontWeight:
                    700,
                }}
              >
                Import History
              </summary>

              <div
                className="table-wrap"
                style={{
                  marginTop:
                    16,
                }}
              >
                <table>
                  <thead>
                    <tr>
                      <th>
                        File
                      </th>

                      <th>
                        Imported
                      </th>

                      <th>
                        Rows
                      </th>

                      <th>
                        Valid
                      </th>

                      <th>
                        Errors
                      </th>

                      <th>
                        Punches
                      </th>

                      <th>
                        Duplicates
                      </th>

                      <th>
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {imports.map(
                      (
                        batch
                      ) => (
                        <tr
                          key={
                            batch._id
                          }
                        >
                          <td>
                            <strong>
                              {
                                batch.fileName
                              }
                            </strong>
                          </td>

                          <td>
                            {formatDate(
                              batch.createdAt
                            )}
                          </td>

                          <td>
                            {
                              batch.totalRows
                            }
                          </td>

                          <td>
                            {
                              batch.validRows
                            }
                          </td>

                          <td>
                            {
                              batch.invalidRows
                            }
                          </td>

                          <td>
                            {
                              batch.punchesCreated
                            }
                          </td>

                          <td>
                            {
                              batch.duplicatesSkipped
                            }
                          </td>

                          <td>
                            <Badge
                              value={
                                batch.status
                              }
                            />
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </details>
          </Card>
        )}

      {/* ============================================================= */}
      {/* Manual Entry */}
      {/* ============================================================= */}

      <Modal
        open={
          manualOpen
        }
        onClose={() =>
          setManualOpen(
            false
          )
        }
        title="Manual Attendance Entry"
      >
        <form
          onSubmit={
            saveManual
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
                manualForm.employeeId
              }
              onChange={(
                event
              ) =>
                setManualForm({
                  ...manualForm,

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

          <div className="form-grid two">
            <label className="field">
              <span>
                Date *
              </span>

              <input
                type="date"
                required
                value={
                  manualForm.date
                }
                onChange={(
                  event
                ) =>
                  setManualForm({
                    ...manualForm,

                    date:
                      event
                        .target
                        .value,
                  })
                }
              />
            </label>

            <label className="field">
              <span>
                Status
              </span>

              <select
                value={
                  manualForm.status
                }
                onChange={(
                  event
                ) =>
                  setManualForm({
                    ...manualForm,

                    status:
                      event
                        .target
                        .value,
                  })
                }
              >
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
              </select>
            </label>

            <label className="field">
              <span>
                Check In
              </span>

              <input
                type="time"
                value={
                  manualForm.checkIn
                }
                onChange={(
                  event
                ) =>
                  setManualForm({
                    ...manualForm,

                    checkIn:
                      event
                        .target
                        .value,
                  })
                }
              />
            </label>

            <label className="field">
              <span>
                Check Out
              </span>

              <input
                type="time"
                value={
                  manualForm.checkOut
                }
                onChange={(
                  event
                ) =>
                  setManualForm({
                    ...manualForm,

                    checkOut:
                      event
                        .target
                        .value,
                  })
                }
              />
            </label>
          </div>

          <label className="field">
            <span>
              Notes
            </span>

            <textarea
              rows="3"
              value={
                manualForm.notes
              }
              onChange={(
                event
              ) =>
                setManualForm({
                  ...manualForm,

                  notes:
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
                setManualOpen(
                  false
                )
              }
            >
              Cancel
            </button>

            <button
              className="button primary"
              disabled={
                busy
              }
            >
              {busy
                ? "Saving..."
                : "Save Attendance"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================= */}
      {/* Excel Import */}
      {/* ============================================================= */}

      <Modal
        open={
          importOpen
        }
        onClose={() =>
          setImportOpen(
            false
          )
        }
        title="Import Attendance from Excel"
      >
        {error && (
          <Alert type="error">
            {error}
          </Alert>
        )}

        <Alert type="info">
          Use one row per employee per
          date. Upload the file,
          validate it, then import.
          Attendance is processed
          separately so errors can be
          reviewed first.
        </Alert>

        <div
          className="button-row"
          style={{
            marginBottom:
              16,
          }}
        >
          <button
            type="button"
            className="button secondary"
            onClick={
              downloadTemplate
            }
          >
            Download Excel Template
          </button>
        </div>

        <label className="field">
          <span>
            Excel File *
          </span>

          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(
              event
            ) =>
              parseImportFile(
                event
                  .target
                  .files?.[0]
              )
            }
          />
        </label>

        {importFileName && (
          <p>
            <strong>
              {
                importFileName
              }
            </strong>
            {" · "}
            {
              importRows.length
            }{" "}
            row(s)
          </p>
        )}

        {importPreview && (
          <Card>
            <div className="stats-grid compact">
              <StatCard
                label="Rows"
                value={
                  importPreview.totalRows
                }
                icon="≡"
              />

              <StatCard
                label="Valid"
                value={
                  importPreview.validRows
                }
                icon="✓"
              />

              <StatCard
                label="Errors"
                value={
                  importPreview.invalidRows
                }
                icon="!"
              />
            </div>

            {importPreview
              .validationErrors
              ?.length >
              0 && (
              <div
                className="table-wrap"
                style={{
                  marginTop:
                    12,
                }}
              >
                <table>
                  <thead>
                    <tr>
                      <th>
                        Row
                      </th>

                      <th>
                        Employee
                      </th>

                      <th>
                        Field
                      </th>

                      <th>
                        Issue
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {importPreview.validationErrors
                      .slice(
                        0,
                        20
                      )
                      .map(
                        (
                          item,
                          index
                        ) => (
                          <tr
                            key={`${item.rowNumber}-${index}`}
                          >
                            <td>
                              {
                                item.rowNumber
                              }
                            </td>

                            <td>
                              {item.employeeCode ||
                                "—"}
                            </td>

                            <td>
                              {
                                item.field
                              }
                            </td>

                            <td>
                              {
                                item.message
                              }
                            </td>
                          </tr>
                        )
                      )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() =>
              setImportOpen(
                false
              )
            }
          >
            Cancel
          </button>

          {!importPreview ? (
            <button
              type="button"
              className="button primary"
              disabled={
                importBusy ||
                !importRows.length
              }
              onClick={
                previewImport
              }
            >
              {importBusy
                ? "Validating..."
                : "Validate File"}
            </button>
          ) : (
            <button
              type="button"
              className="button primary"
              disabled={
                importBusy ||
                importPreview.validRows ===
                  0
              }
              onClick={
                commitImport
              }
            >
              {importBusy
                ? "Importing..."
                : "Import Valid Rows"}
            </button>
          )}
        </div>
      </Modal>

      {/* ============================================================= */}
      {/* Process Attendance */}
      {/* ============================================================= */}

      <Modal
        open={
          processOpen
        }
        onClose={() =>
          setProcessOpen(
            false
          )
        }
        title="Process Attendance"
      >
        <form
          onSubmit={
            processAttendance
          }
        >
          {error && (
            <Alert type="error">
              {error}
            </Alert>
          )}

          <Alert type="info">
            The system combines raw
            punches, employee shifts,
            Work Calendar and approved
            leave to create final
            attendance. Missing or
            short hours automatically
            appear in Exceptions.
          </Alert>

          <div className="form-grid two">
            <label className="field">
              <span>
                From *
              </span>

              <input
                type="date"
                required
                value={
                  processForm.from
                }
                onChange={(
                  event
                ) =>
                  setProcessForm({
                    ...processForm,

                    from:
                      event
                        .target
                        .value,
                  })
                }
              />
            </label>

            <label className="field">
              <span>
                To *
              </span>

              <input
                type="date"
                required
                min={
                  processForm.from
                }
                value={
                  processForm.to
                }
                onChange={(
                  event
                ) =>
                  setProcessForm({
                    ...processForm,

                    to:
                      event
                        .target
                        .value,
                  })
                }
              />
            </label>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                setProcessOpen(
                  false
                )
              }
            >
              Cancel
            </button>

            <button
              className="button primary"
              disabled={
                busy
              }
            >
              {busy
                ? "Processing..."
                : "Process Attendance"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================= */}
      {/* Resolve Exception */}
      {/* ============================================================= */}

      <Modal
        open={
          Boolean(
            resolveRecord
          )
        }
        onClose={() =>
          setResolveRecord(
            null
          )
        }
        title="Resolve Attendance Exception"
      >
        <form
          onSubmit={
            resolveException
          }
        >
          {error && (
            <Alert type="error">
              {error}
            </Alert>
          )}

          {resolveRecord && (
            <Card>
              <strong>
                {fullName(
                  resolveRecord.employeeId
                )}
              </strong>

              <p>
                {formatDate(
                  resolveRecord.date
                )}
                {" · "}
                {
                  resolveRecord.exceptionReason
                }
              </p>
            </Card>
          )}

          <div className="form-grid two">
            <label className="field">
              <span>
                Check In
              </span>

              <input
                type="time"
                value={
                  resolveForm.checkIn
                }
                onChange={(
                  event
                ) =>
                  setResolveForm({
                    ...resolveForm,

                    checkIn:
                      event
                        .target
                        .value,
                  })
                }
              />
            </label>

            <label className="field">
              <span>
                Check Out
              </span>

              <input
                type="time"
                value={
                  resolveForm.checkOut
                }
                onChange={(
                  event
                ) =>
                  setResolveForm({
                    ...resolveForm,

                    checkOut:
                      event
                        .target
                        .value,
                  })
                }
              />
            </label>

            <label className="field span-two">
              <span>
                Final Status
              </span>

              <select
                value={
                  resolveForm.status
                }
                onChange={(
                  event
                ) =>
                  setResolveForm({
                    ...resolveForm,

                    status:
                      event
                        .target
                        .value,
                  })
                }
              >
                <option value="present">
                  Present
                </option>

                <option value="late">
                  Late
                </option>

                <option value="half-day">
                  Half Day
                </option>

                <option value="absent">
                  Absent
                </option>

                <option value="on-leave">
                  On Leave
                </option>
              </select>
            </label>
          </div>

          <label className="field">
            <span>
              Resolution Note *
            </span>

            <textarea
              rows="3"
              required
              value={
                resolveForm.resolutionNote
              }
              onChange={(
                event
              ) =>
                setResolveForm({
                  ...resolveForm,

                  resolutionNote:
                    event
                      .target
                      .value,
                })
              }
              placeholder="What was corrected or approved?"
            />
          </label>

          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                setResolveRecord(
                  null
                )
              }
            >
              Cancel
            </button>

            <button
              className="button primary"
              disabled={
                busy
              }
            >
              {busy
                ? "Saving..."
                : "Resolve Exception"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}