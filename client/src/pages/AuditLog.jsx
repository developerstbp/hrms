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

const pretty = (
  value
) =>
  String(
    value || ""
  )
    .replaceAll(
      "_",
      " "
    )
    .replaceAll(
      ".",
      " · "
    )
    .replaceAll(
      "-",
      " "
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );

const actorName = (
  log
) => {
  const actor =
    log.actorUserId ||
    log.actor ||
    log.userId;

  if (!actor) {
    return "System";
  }

  if (
    typeof actor ===
    "string"
  ) {
    return actor;
  }

  const name = [
    actor.firstName,
    actor.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    name ||
    actor.email ||
    actor.role ||
    "System"
  );
};

const formatDateTime = (
  value
) => {
  if (!value) {
    return "—";
  }

  return new Date(
    value
  ).toLocaleString(
    "en-PK",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
};

/*
|--------------------------------------------------------------------------
| Component
|--------------------------------------------------------------------------
*/

export default function AuditLog() {
  const [
    logs,
    setLogs,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    actionFilter,
    setActionFilter,
  ] = useState("");

  const [
    entityFilter,
    setEntityFilter,
  ] = useState("");

  const [
    from,
    setFrom,
  ] = useState(
    monthStart()
  );

  const [
    to,
    setTo,
  ] = useState(
    today()
  );

  /*
  |--------------------------------------------------------------------------
  | Load Audit Logs
  |--------------------------------------------------------------------------
  */

  const load =
    async () => {
      try {
        setLoading(
          true
        );

        const {
          data,
        } =
          await api.get(
            "/audit"
          );

        setLogs(
          Array.isArray(
            data
          )
            ? data
            : data.logs ||
              data.auditLogs ||
              data.data ||
              []
        );

        setError("");
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to load audit log."
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
    []
  );

  /*
  |--------------------------------------------------------------------------
  | Available Filters
  |--------------------------------------------------------------------------
  */

  const actions =
    useMemo(
      () =>
        [
          ...new Set(
            logs
              .map(
                (
                  item
                ) =>
                  item.action
              )
              .filter(
                Boolean
              )
          ),
        ].sort(),
      [
        logs,
      ]
    );

  const entities =
    useMemo(
      () =>
        [
          ...new Set(
            logs
              .map(
                (
                  item
                ) =>
                  item.entity
              )
              .filter(
                Boolean
              )
          ),
        ].sort(),
      [
        logs,
      ]
    );

  /*
  |--------------------------------------------------------------------------
  | Filter
  |--------------------------------------------------------------------------
  */

  const filtered =
    useMemo(
      () => {
        const searchValue =
          search
            .trim()
            .toLowerCase();

        const fromDate =
          from
            ? new Date(
                `${from}T00:00:00`
              )
            : null;

        const toDate =
          to
            ? new Date(
                `${to}T23:59:59`
              )
            : null;

        return logs.filter(
          (
            log
          ) => {
            const created =
              log.createdAt
                ? new Date(
                    log.createdAt
                  )
                : null;

            if (
              actionFilter &&
              log.action !==
                actionFilter
            ) {
              return false;
            }

            if (
              entityFilter &&
              log.entity !==
                entityFilter
            ) {
              return false;
            }

            if (
              fromDate &&
              created &&
              created <
                fromDate
            ) {
              return false;
            }

            if (
              toDate &&
              created &&
              created >
                toDate
            ) {
              return false;
            }

            if (
              !searchValue
            ) {
              return true;
            }

            const haystack = [
              log.action,
              log.entity,
              log.entityId,
              log.description,
              actorName(
                log
              ),
              log.actorUserId
                ?.email,
              log.actorUserId
                ?.role,
            ]
              .filter(
                Boolean
              )
              .join(" ")
              .toLowerCase();

            return haystack.includes(
              searchValue
            );
          }
        );
      },
      [
        logs,
        search,
        actionFilter,
        entityFilter,
        from,
        to,
      ]
    );

  /*
  |--------------------------------------------------------------------------
  | Reset Filters
  |--------------------------------------------------------------------------
  */

  const resetFilters =
    () => {
      setSearch(
        ""
      );

      setActionFilter(
        ""
      );

      setEntityFilter(
        ""
      );

      setFrom(
        ""
      );

      setTo(
        ""
      );
    };

  /*
  |--------------------------------------------------------------------------
  | Export Excel
  |--------------------------------------------------------------------------
  */

  const exportExcel =
    () => {
      if (
        !filtered.length
      ) {
        return;
      }

      const rows =
        filtered.map(
          (
            log
          ) => ({
            Date:
              formatDateTime(
                log.createdAt
              ),

            User:
              actorName(
                log
              ),

            Role:
              log.actorUserId
                ?.role ||
              log.actor
                ?.role ||
              "",

            Action:
              log.action ||
              "",

            Entity:
              log.entity ||
              "",

            "Entity ID":
              log.entityId ||
              "",

            Description:
              log.description ||
              "",

            "IP Address":
              log.ipAddress ||
              "",

            "User Agent":
              log.userAgent ||
              "",
          })
        );

      const worksheet =
        XLSX.utils.json_to_sheet(
          rows
        );

      const workbook =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Audit Log"
      );

      XLSX.writeFile(
        workbook,
        "HRMS-Audit-Log.xlsx"
      );
    };

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Track important HRMS actions, configuration changes and administrative activity."
        action={
          filtered.length ? (
            <button
              className="button secondary"
              onClick={
                exportExcel
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

      {/* ============================================================= */}
      {/* Summary */}
      {/* ============================================================= */}

      <div className="stats-grid">
        <Card>
          <span className="eyebrow">
            Total Records
          </span>

          <h2>
            {
              logs.length
            }
          </h2>

          <p>
            Audit events recorded
          </p>
        </Card>

        <Card>
          <span className="eyebrow">
            Filtered
          </span>

          <h2>
            {
              filtered.length
            }
          </h2>

          <p>
            Currently visible
          </p>
        </Card>

        <Card>
          <span className="eyebrow">
            Action Types
          </span>

          <h2>
            {
              actions.length
            }
          </h2>

          <p>
            Unique activities
          </p>
        </Card>

        <Card>
          <span className="eyebrow">
            Entity Types
          </span>

          <h2>
            {
              entities.length
            }
          </h2>

          <p>
            Modules affected
          </p>
        </Card>
      </div>

      {/* ============================================================= */}
      {/* Filters */}
      {/* ============================================================= */}

      <Card>
        <div className="card-head">
          <div>
            <h2>
              Filters
            </h2>

            <p>
              Search audit activity
              by date, user, action
              or module.
            </p>
          </div>

          <button
            className="button secondary"
            onClick={
              resetFilters
            }
          >
            Reset
          </button>
        </div>

        <div className="form-grid three">
          <label className="field">
            <span>
              Search
            </span>

            <input
              placeholder="User, action, description..."
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
            />
          </label>

          <label className="field">
            <span>
              Action
            </span>

            <select
              value={
                actionFilter
              }
              onChange={(
                event
              ) =>
                setActionFilter(
                  event
                    .target
                    .value
                )
              }
            >
              <option value="">
                All actions
              </option>

              {actions.map(
                (
                  action
                ) => (
                  <option
                    key={
                      action
                    }
                    value={
                      action
                    }
                  >
                    {pretty(
                      action
                    )}
                  </option>
                )
              )}
            </select>
          </label>

          <label className="field">
            <span>
              Module / Entity
            </span>

            <select
              value={
                entityFilter
              }
              onChange={(
                event
              ) =>
                setEntityFilter(
                  event
                    .target
                    .value
                )
              }
            >
              <option value="">
                All modules
              </option>

              {entities.map(
                (
                  entity
                ) => (
                  <option
                    key={
                      entity
                    }
                    value={
                      entity
                    }
                  >
                    {
                      entity
                    }
                  </option>
                )
              )}
            </select>
          </label>

          <label className="field">
            <span>
              From
            </span>

            <input
              type="date"
              value={
                from
              }
              onChange={(
                event
              ) =>
                setFrom(
                  event
                    .target
                    .value
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
                to
              }
              onChange={(
                event
              ) =>
                setTo(
                  event
                    .target
                    .value
                )
              }
            />
          </label>
        </div>
      </Card>

      {/* ============================================================= */}
      {/* Audit Table */}
      {/* ============================================================= */}

      <Card>
        <div className="card-head">
          <div>
            <h2>
              Activity History
            </h2>

            <p>
              {
                filtered.length
              }{" "}
              record(s) found.
            </p>
          </div>

          <button
            className="button secondary"
            onClick={
              load
            }
            disabled={
              loading
            }
          >
            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>

        {loading ? (
          <p>
            Loading audit log...
          </p>
        ) : filtered.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    Date & Time
                  </th>

                  <th>
                    User
                  </th>

                  <th>
                    Action
                  </th>

                  <th>
                    Module
                  </th>

                  <th>
                    Description
                  </th>
                </tr>
              </thead>

              <tbody>
                {filtered.map(
                  (
                    log
                  ) => (
                    <tr
                      key={
                        log._id
                      }
                    >
                      <td>
                        {formatDateTime(
                          log.createdAt
                        )}
                      </td>

                      <td>
                        <strong>
                          {actorName(
                            log
                          )}
                        </strong>

                        <small>
                          {log.actorUserId
                            ?.role ||
                            log.actor
                              ?.role ||
                            ""}
                        </small>
                      </td>

                      <td>
                        <Badge
                          value={
                            log.action ||
                            "activity"
                          }
                        />
                      </td>

                      <td>
                        <strong>
                          {log.entity ||
                            "—"}
                        </strong>

                        {log.entityId && (
                          <small>
                            {String(
                              log.entityId
                            ).slice(
                              -8
                            )}
                          </small>
                        )}
                      </td>

                      <td>
                        {log.description ||
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
            title="No audit activity found"
            description="No audit records match the selected filters."
          />
        )}
      </Card>
    </>
  );
}