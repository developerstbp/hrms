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

const today = () =>
  new Date()
    .toISOString()
    .slice(0, 10);

const blankRequest = {
  employeeId: "",
  leaveTypeId: "",
  startDate: today(),
  endDate: today(),
  halfDay: false,
  halfDayPeriod:
    "first-half",
  reason: "",
};

const blankPolicy = {
  name:
    "",

  code:
    "",

  daysPerYear:
    0,

  isPaid:
    true,

  allowHalfDay:
    true,

  requiresReason:
    true,

  carryForwardAllowed:
    false,

  maxCarryForward:
    0,

  maxConsecutiveDays:
    0,

  noticeDays:
    0,

  isActive:
    true,
};

export default function Leaves() {
  const {
    employee,
    hasPermission,
  } =
    useAuth();

  const [
    viewingRequest,
    setViewingRequest,
  ] = useState(null);

  const canSelf =
    hasPermission(
      "leave.self"
    );

  const canTeam =
    hasPermission(
      "leave.team"
    );

  const canApprove =
    hasPermission(
      "leave.approve"
    );

  const canPolicies =
    hasPermission(
      "leave.policies"
    );

  const [
    requests,
    setRequests,
  ] =
    useState([]);

  const [
    types,
    setTypes,
  ] =
    useState([]);

  const [
    balances,
    setBalances,
  ] =
    useState([]);

  const [
    employees,
    setEmployees,
  ] =
    useState([]);

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
    busy,
    setBusy,
  ] =
    useState(false);

  /*
  |--------------------------------------------------------------------------
  | Request
  |--------------------------------------------------------------------------
  */

  const [
    requestOpen,
    setRequestOpen,
  ] =
    useState(false);

  const [
    requestForm,
    setRequestForm,
  ] =
    useState(
      blankRequest
    );

  /*
  |--------------------------------------------------------------------------
  | Policy
  |--------------------------------------------------------------------------
  */

  const [
    policyOpen,
    setPolicyOpen,
  ] =
    useState(false);

  const [
    editingPolicy,
    setEditingPolicy,
  ] =
    useState(null);

  const [
    policyForm,
    setPolicyForm,
  ] =
    useState(
      blankPolicy
    );

  /*
  |--------------------------------------------------------------------------
  | Reject
  |--------------------------------------------------------------------------
  */

  const [
    rejecting,
    setRejecting,
  ] =
    useState(null);

  const [
    rejectNote,
    setRejectNote,
  ] =
    useState("");

  /*
  |--------------------------------------------------------------------------
  | Filter
  |--------------------------------------------------------------------------
  */

  const [
    filter,
    setFilter,
  ] =
    useState(
      "all"
    );

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
            "/leaves"
          ),

          api.get(
            "/leaves/types"
          ),
        ];

        if (
          employee &&
          canSelf
        ) {
          calls.push(
            api.get(
              "/leaves/balances/me"
            )
          );
        }

        if (
          canTeam ||
          canApprove
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

        let index = 0;

        setRequests(
          result[index++]
            .data ||
            []
        );

        setTypes(
          result[index++]
            .data ||
            []
        );

        if (
          employee &&
          canSelf
        ) {
          setBalances(
            result[index++]
              .data ||
              []
          );
        }

        if (
          canTeam ||
          canApprove
        ) {
          setEmployees(
            result[index++]
              ?.data ||
              []
          );
        }

        setError("");
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to load leave management."
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

  const pendingApprovals =
    useMemo(
      () =>
        requests.filter(
          (request) =>
            request.status ===
              "pending" &&
            request
              .employeeId
              ?._id !==
              employee?._id
        ),

      [
        requests,
        employee,
      ]
    );

  const visibleRequests =
    useMemo(
      () =>
        requests.filter(
          (request) =>
            filter ===
              "all" ||
            request.status ===
              filter
        ),

      [
        requests,
        filter,
      ]
    );

  /*
  |--------------------------------------------------------------------------
  | Open Request
  |--------------------------------------------------------------------------
  */

  const openRequest =
    () => {
      const firstType =
        types.find(
          (type) =>
            type.isActive
        );

      setRequestForm({
        ...blankRequest,

        employeeId:
          employee?._id ||
          "",

        leaveTypeId:
          firstType?._id ||
          "",

        startDate:
          today(),

        endDate:
          today(),
      });

      setError("");

      setRequestOpen(
        true
      );
    };

  const selectedType =
    types.find(
      (type) =>
        type._id ===
        requestForm.leaveTypeId
    );

  /*
  |--------------------------------------------------------------------------
  | Submit Leave
  |--------------------------------------------------------------------------
  */

  const submitRequest =
    async (
      event
    ) => {
      event.preventDefault();

      try {
        setBusy(true);

        await api.post(
          "/leaves",
          requestForm
        );

        setRequestOpen(
          false
        );

        setNotice(
          "Leave request submitted."
        );

        await load();
      } catch (err) {
        setError(
          getError(err)
        );
      } finally {
        setBusy(false);
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Approve
  |--------------------------------------------------------------------------
  */

  const approve =
    async (
      request
    ) => {
      try {
        setBusy(true);

        await api.put(
          `/leaves/${request._id}/review`,
          {
            status:
              "approved",

            note:
              "",
          }
        );

        setNotice(
          "Leave approved."
        );

        await load();
      } catch (err) {
        setError(
          getError(err)
        );
      } finally {
        setBusy(false);
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Reject
  |--------------------------------------------------------------------------
  */

  const reject =
    async (
      event
    ) => {
      event.preventDefault();

      try {
        setBusy(true);

        await api.put(
          `/leaves/${rejecting._id}/review`,
          {
            status:
              "rejected",

            note:
              rejectNote,
          }
        );

        setRejecting(
          null
        );

        setRejectNote("");

        setNotice(
          "Leave rejected."
        );

        await load();
      } catch (err) {
        setError(
          getError(err)
        );
      } finally {
        setBusy(false);
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Cancel
  |--------------------------------------------------------------------------
  */

  const cancel =
    async (
      request
    ) => {
      if (
        !window.confirm(
          "Cancel this leave request?"
        )
      ) {
        return;
      }

      try {
        await api.put(
          `/leaves/${request._id}/cancel`
        );

        setNotice(
          "Leave request cancelled."
        );

        await load();
      } catch (err) {
        setError(
          getError(err)
        );
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Policies
  |--------------------------------------------------------------------------
  */

  const openNewPolicy =
    () => {
      setEditingPolicy(
        null
      );

      setPolicyForm(
        blankPolicy
      );

      setPolicyOpen(
        true
      );
    };

  const openEditPolicy =
    (policy) => {
      setEditingPolicy(
        policy
      );

      setPolicyForm({
        ...blankPolicy,
        ...policy,
      });

      setPolicyOpen(
        true
      );
    };

  const savePolicy =
    async (
      event
    ) => {
      event.preventDefault();

      try {
        setBusy(true);

        const payload = {
          ...policyForm,

          code:
            policyForm.code
              .trim()
              .toUpperCase(),

          daysPerYear:
            Number(
              policyForm.daysPerYear ||
                0
            ),

          maxCarryForward:
            policyForm
              .carryForwardAllowed
              ? Number(
                  policyForm.maxCarryForward ||
                    0
                )
              : 0,

          maxConsecutiveDays:
            Number(
              policyForm.maxConsecutiveDays ||
                0
            ),

          noticeDays:
            Number(
              policyForm.noticeDays ||
                0
            ),
        };

        if (
          editingPolicy
        ) {
          await api.put(
            `/leaves/types/${editingPolicy._id}`,
            payload
          );
        } else {
          await api.post(
            "/leaves/types",
            payload
          );
        }

        setPolicyOpen(
          false
        );

        setEditingPolicy(
          null
        );

        setNotice(
          editingPolicy
            ? "Leave policy updated."
            : "Leave policy added."
        );

        await load();
      } catch (err) {
        setError(
          getError(err)
        );
      } finally {
        setBusy(false);
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
        title="Leave Management"
        description="Request leave, approve employee requests and manage leave policies."
        action={
          <div className="button-row">
            {canPolicies && (
              <button
                className="button secondary"
                onClick={
                  openNewPolicy
                }
              >
                + Add Leave Policy
              </button>
            )}

            {(canSelf ||
              canTeam) && (
              <button
                className="button primary"
                onClick={
                  openRequest
                }
              >
                + Request Leave
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
        !requestOpen &&
        !policyOpen &&
        !rejecting && (
          <Alert type="error">
            {error}
          </Alert>
        )}

      {/* ============================================================= */}
      {/* MY BALANCE */}
      {/* ============================================================= */}

      {employee &&
        balances.length >
          0 && (
          <Card>
            <div className="card-head">
              <div>
                <h2>
                  My Leave Balance
                </h2>

                <p>
                  Your current leave availability.
                </p>
              </div>
            </div>

            <div
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "repeat(auto-fit, minmax(160px, 1fr))",

                gap: 12,
              }}
            >
              {balances.map(
                (balance) => (
                  <div
                    key={
                      balance
                        .leaveType
                        ._id
                    }
                    style={{
                      padding: 16,

                      border:
                        "1px solid #e4e0ed",

                      borderRadius:
                        12,
                    }}
                  >
                    <small>
                      {
                        balance
                          .leaveType
                          .name
                      }
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
                      {balance
                        .leaveType
                        .daysPerYear ===
                      0
                        ? "No Limit"
                        : balance.available}
                    </strong>

                    <small>
                      {balance.approved} used
                      {" · "}
                      {balance.pending} pending
                    </small>
                  </div>
                )
              )}
            </div>
          </Card>
        )}

      {/* ============================================================= */}
      {/* PENDING APPROVALS */}
      {/* ============================================================= */}

      {canApprove && (
        <Card>
          <div className="card-head">
            <div>
              <h2>
                Pending Approvals
                {pendingApprovals.length
                  ? ` (${pendingApprovals.length})`
                  : ""}
              </h2>

              <p>
                Read the complete request before approving or rejecting.
              </p>
            </div>
          </div>

          {pendingApprovals.length ? (
            <div
              style={{
                display:
                  "grid",

                gap:
                  14,
              }}
            >
              {pendingApprovals.map(
                (request) => (
                  <div
                    key={
                      request._id
                    }
                    style={{
                      border:
                        "1px solid #e4e0ed",

                      borderRadius:
                        14,

                      padding:
                        18,
                    }}
                  >
                    <div className="card-head">
                      <div>
                        <h3
                          style={{
                            margin:
                              "0 0 4px",
                          }}
                        >
                          {fullName(
                            request.employeeId
                          )}
                        </h3>

                        <p>
                          {request
                            .employeeId
                            ?.employeeCode ||
                            ""}
                        </p>
                      </div>

                      <Badge
                        value="pending"
                      />
                    </div>

                    <div
                      style={{
                        display:
                          "grid",

                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(150px, 1fr))",

                        gap:
                          12,

                        marginBottom:
                          16,
                      }}
                    >
                      <div>
                        <small>
                          Leave Type
                        </small>

                        <strong
                          style={{
                            display:
                              "block",
                          }}
                        >
                          {request
                            .leaveTypeId
                            ?.name ||
                            "—"}
                        </strong>
                      </div>

                      <div>
                        <small>
                          Dates
                        </small>

                        <strong
                          style={{
                            display:
                              "block",
                          }}
                        >
                          {formatDate(
                            request.startDate
                          )}
                          {" — "}
                          {formatDate(
                            request.endDate
                          )}
                        </strong>
                      </div>

                      <div>
                        <small>
                          Days
                        </small>

                        <strong
                          style={{
                            display:
                              "block",
                          }}
                        >
                          {
                            request.days
                          }
                        </strong>
                      </div>

                      <div>
                        <small>
                          Requested By
                        </small>

                        <strong
                          style={{
                            display:
                              "block",
                          }}
                        >
                          {request.requestedOnBehalf
                            ? fullName(
                                request.requestedByUserId
                              )
                            : "Employee"}
                        </strong>

                        <small>
                          {request.requestedOnBehalf
                            ? `${request.requestedByRole?.toUpperCase()} · on behalf`
                            : "Self request"}
                        </small>
                      </div>
                    </div>

                    <div
                      style={{
                        background:
                          "#f8f7fb",

                        borderRadius:
                          10,

                        padding:
                          14,

                        marginBottom:
                          16,
                      }}
                    >
                      <small
                        style={{
                          fontWeight:
                            700,

                          display:
                            "block",

                          marginBottom:
                            6,
                        }}
                      >
                        REASON
                      </small>

                      <p
                        style={{
                          margin: 0,

                          whiteSpace:
                            "pre-wrap",

                          lineHeight:
                            1.6,
                        }}
                      >
                        {request.reason ||
                          "No reason provided."}
                      </p>
                    </div>

                    <div
                      className="button-row"
                      style={{
                        justifyContent:
                          "flex-end",
                      }}
                    >
                      <button
                        className="button secondary"
                        disabled={
                          busy
                        }
                        onClick={() => {
                          setRejecting(
                            request
                          );

                          setRejectNote(
                            ""
                          );
                        }}
                      >
                        Reject
                      </button>

                      <button
                        className="button primary"
                        disabled={
                          busy
                        }
                        onClick={() =>
                          approve(
                            request
                          )
                        }
                      >
                        Approve
                      </button>
                      <button
                        className="button secondary"
                        onClick={() =>
                          setViewingRequest(
                            request
                          )
                        }
                      >
                        View Full Request
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <EmptyState
              title="No pending approvals"
              description="New leave requests will appear here."
            />
          )}
        </Card>
      )}

      {/* ============================================================= */}
      {/* ALL REQUESTS */}
      {/* ============================================================= */}

      <Card>
        <div className="card-head">
          <div>
            <h2>
              Leave Requests
            </h2>

            <p>
              Complete leave history visible within your access.
            </p>
          </div>

          <select
            className="compact-select"
            value={
              filter
            }
            onChange={(event) =>
              setFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All
            </option>

            <option value="pending">
              Pending
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
        </div>

        {visibleRequests.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    Employee
                  </th>

                  <th>
                    Leave
                  </th>

                  <th>
                    Dates
                  </th>

                  <th>
                    Days
                  </th>

                  <th>
                    Requested By
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
                {visibleRequests.map(
                  (request) => (
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
                          {request
                            .employeeId
                            ?.employeeCode ||
                            ""}
                        </small>
                      </td>

                      <td>
                        {request
                          .leaveTypeId
                          ?.name ||
                          "—"}

                        {request.halfDay && (
                          <small>
                            {request
                              .halfDayPeriod ===
                            "first-half"
                              ? "First half"
                              : "Second half"}
                          </small>
                        )}
                      </td>

                      <td>
                        {formatDate(
                          request.startDate
                        )}
                        {" — "}
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
                        {request.requestedOnBehalf ? (
                          <>
                            <strong>
                              {fullName(
                                request.requestedByUserId
                              )}
                            </strong>

                            <small>
                              {request.requestedByRole
                                ?.toUpperCase()}
                              {" · "}
                              on behalf
                            </small>
                          </>
                        ) : (
                          <>
                            <strong>
                              Self
                            </strong>

                            <small>
                              Employee request
                            </small>
                          </>
                        )}
                      </td>

                      <td
                        style={{
                          maxWidth:
                            320,

                          whiteSpace:
                            "pre-wrap",
                        }}
                      >
                        {request.reason ||
                          "No reason provided"}
                      </td>

                      <td>
                        <Badge
                          value={
                            request.status
                          }
                        />

                        {request.reviewNote && (
                          <small>
                            {
                              request.reviewNote
                            }
                          </small>
                        )}
                      </td>

                      <td>
                        <div className="row-actions">
                          <button
                            className="text-button"
                            onClick={() =>
                              setViewingRequest(
                                request
                              )
                            }
                          >
                            View
                          </button>

                          {request.status === "pending" &&
                            canApprove &&
                            request.employeeId?._id !==
                              employee?._id && (
                              <>
                                <button
                                  className="text-button"
                                  disabled={busy}
                                  onClick={() =>
                                    approve(
                                      request
                                    )
                                  }
                                >
                                  Approve
                                </button>

                                <button
                                  className="text-button danger"
                                  disabled={busy}
                                  onClick={() => {
                                    setRejecting(
                                      request
                                    );

                                    setRejectNote(
                                      ""
                                    );
                                  }}
                                >
                                  Reject
                                </button>
                              </>
                            )}

                          {[
                            "pending",
                            "approved",
                          ].includes(
                            request.status
                          ) &&
                            request.employeeId?._id ===
                              employee?._id && (
                              <button
                                className="text-button danger"
                                onClick={() =>
                                  cancel(
                                    request
                                  )
                                }
                              >
                                Cancel
                              </button>
                            )}
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
            title="No leave requests"
          />
        )}
      </Card>

      {/* ============================================================= */}
      {/* POLICIES */}
      {/* ============================================================= */}

      {canPolicies && (
        <Card>
          <div className="card-head">
            <div>
              <h2>
                Leave Policies
              </h2>

              <p>
                Define the leave types employees can request.
              </p>
            </div>

            <button
              className="button primary"
              onClick={
                openNewPolicy
              }
            >
              + Add Leave Policy
            </button>
          </div>

          {types.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      Leave
                    </th>

                    <th>
                      Code
                    </th>

                    <th>
                      Entitlement
                    </th>

                    <th>
                      Type
                    </th>

                    <th>
                      Rules
                    </th>

                    <th>
                      Status
                    </th>

                    <th />
                  </tr>
                </thead>

                <tbody>
                  {types.map(
                    (type) => (
                      <tr
                        key={
                          type._id
                        }
                      >
                        <td>
                          <strong>
                            {
                              type.name
                            }
                          </strong>
                        </td>

                        <td>
                          {
                            type.code
                          }
                        </td>

                        <td>
                          {type.daysPerYear >
                          0
                            ? `${type.daysPerYear} days/year`
                            : "No fixed limit"}
                        </td>

                        <td>
                          {type.isPaid
                            ? "Paid"
                            : "Unpaid"}
                        </td>

                        <td>
                          <small
                            style={{
                              display:
                                "block",
                            }}
                          >
                            {type.allowHalfDay
                              ? "Half-day allowed"
                              : "Full-day only"}
                          </small>

                          {type.noticeDays >
                            0 && (
                            <small
                              style={{
                                display:
                                  "block",
                              }}
                            >
                              {type.noticeDays} day notice
                            </small>
                          )}

                          {type.maxConsecutiveDays >
                            0 && (
                            <small
                              style={{
                                display:
                                  "block",
                              }}
                            >
                              Max {type.maxConsecutiveDays} consecutive
                            </small>
                          )}

                          {type.carryForwardAllowed && (
                            <small
                              style={{
                                display:
                                  "block",
                              }}
                            >
                              Carry forward: {type.maxCarryForward || 0}
                            </small>
                          )}
                        </td>

                        <td>
                          <Badge
                            value={
                              type.isActive
                                ? "active"
                                : "inactive"
                            }
                          />
                        </td>

                        <td>
                          <button
                            className="text-button"
                            onClick={() =>
                              openEditPolicy(
                                type
                              )
                            }
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No leave policies"
              description="Add your first leave policy."
            />
          )}
        </Card>
      )}

      {/* ============================================================= */}
      {/* REQUEST MODAL */}
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
        title="Request Leave"
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

          {(canTeam ||
            canApprove) && (
            <label className="field">
              <span>
                Request For *
              </span>

              <select
                required
                value={
                  requestForm.employeeId
                }
                onChange={(event) =>
                  setRequestForm({
                    ...requestForm,

                    employeeId:
                      event.target.value,
                  })
                }
              >
                <option value="">
                  Select employee
                </option>

                {employees.map(
                  (item) => (
                    <option
                      key={
                        item._id
                      }
                      value={
                        item._id
                      }
                    >
                      {item._id ===
                      employee?._id
                        ? "Myself — "
                        : ""}
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
          )}

          <label className="field">
            <span>
              Leave Type *
            </span>

            <select
              required
              value={
                requestForm.leaveTypeId
              }
              onChange={(event) =>
                setRequestForm({
                  ...requestForm,

                  leaveTypeId:
                    event.target.value,
                })
              }
            >
              <option value="">
                Select leave
              </option>

              {types
                .filter(
                  (type) =>
                    type.isActive
                )
                .map(
                  (type) => (
                    <option
                      key={
                        type._id
                      }
                      value={
                        type._id
                      }
                    >
                      {
                        type.name
                      }
                      {" — "}
                      {type.isPaid
                        ? "Paid"
                        : "Unpaid"}
                    </option>
                  )
                )}
            </select>
          </label>

          {selectedType && (
            <div
              style={{
                padding:
                  12,

                border:
                  "1px solid #e4e0ed",

                borderRadius:
                  10,

                marginBottom:
                  14,
              }}
            >
              <strong>
                {
                  selectedType.name
                }
              </strong>

              <small
                style={{
                  display:
                    "block",

                  marginTop:
                    4,
                }}
              >
                {selectedType.isPaid
                  ? "Paid Leave"
                  : "Unpaid Leave"}
                {" · "}
                {selectedType.daysPerYear >
                0
                  ? `${selectedType.daysPerYear} days/year`
                  : "No fixed annual limit"}
              </small>
            </div>
          )}

          <div className="form-grid two">
            <label className="field">
              <span>
                Start Date *
              </span>

              <input
                type="date"
                required
                value={
                  requestForm.startDate
                }
                onChange={(event) =>
                  setRequestForm({
                    ...requestForm,

                    startDate:
                      event.target.value,

                    endDate:
                      requestForm.halfDay
                        ? event.target.value
                        : requestForm.endDate <
                            event.target.value
                          ? event.target.value
                          : requestForm.endDate,
                  })
                }
              />
            </label>

            <label className="field">
              <span>
                End Date *
              </span>

              <input
                type="date"
                required
                disabled={
                  requestForm.halfDay
                }
                min={
                  requestForm.startDate
                }
                value={
                  requestForm.endDate
                }
                onChange={(event) =>
                  setRequestForm({
                    ...requestForm,

                    endDate:
                      event.target.value,
                  })
                }
              />
            </label>
          </div>

          {selectedType
            ?.allowHalfDay && (
            <label className="switch-row">
              <input
                type="checkbox"
                checked={
                  requestForm.halfDay
                }
                onChange={(event) =>
                  setRequestForm({
                    ...requestForm,

                    halfDay:
                      event.target.checked,

                    endDate:
                      event.target.checked
                        ? requestForm.startDate
                        : requestForm.endDate,
                  })
                }
              />

              <span>
                <strong>
                  Half Day
                </strong>
              </span>
            </label>
          )}

          {requestForm.halfDay && (
            <label className="field">
              <span>
                Which Half?
              </span>

              <select
                value={
                  requestForm.halfDayPeriod
                }
                onChange={(event) =>
                  setRequestForm({
                    ...requestForm,

                    halfDayPeriod:
                      event.target.value,
                  })
                }
              >
                <option value="first-half">
                  First Half
                </option>

                <option value="second-half">
                  Second Half
                </option>
              </select>
            </label>
          )}

          <label className="field">
            <span>
              Reason
              {selectedType
                ?.requiresReason
                ? " *"
                : ""}
            </span>

            <textarea
              rows="6"
              required={
                Boolean(
                  selectedType
                    ?.requiresReason
                )
              }
              value={
                requestForm.reason
              }
              onChange={(event) =>
                setRequestForm({
                  ...requestForm,

                  reason:
                    event.target.value,
                })
              }
              placeholder="Explain why you need leave. This will be shown to the approver."
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
                busy
              }
            >
              Submit Request
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================= */}
      {/* POLICY MODAL */}
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
        title={
          editingPolicy
            ? "Edit Leave Policy"
            : "Add Leave Policy"
        }
      >
        <form
          onSubmit={
            savePolicy
          }
        >
          <div className="form-grid two">
            <label className="field">
              <span>
                Leave Name *
              </span>

              <input
                required
                value={
                  policyForm.name
                }
                onChange={(event) =>
                  setPolicyForm({
                    ...policyForm,

                    name:
                      event.target.value,
                  })
                }
                placeholder="Casual Leave"
              />
            </label>

            <label className="field">
              <span>
                Code *
              </span>

              <input
                required
                value={
                  policyForm.code
                }
                onChange={(event) =>
                  setPolicyForm({
                    ...policyForm,

                    code:
                      event.target.value
                        .toUpperCase(),
                  })
                }
                placeholder="CL"
              />
            </label>

            <label className="field span-two">
              <span>
                Days Per Year
              </span>

              <input
                type="number"
                min="0"
                step="0.5"
                value={
                  policyForm.daysPerYear
                }
                onChange={(event) =>
                  setPolicyForm({
                    ...policyForm,

                    daysPerYear:
                      event.target.value,
                  })
                }
              />

              <small>
                Use 0 for no fixed annual limit.
              </small>
            </label>
            <label className="field">
              <span>
                Maximum Consecutive Days
              </span>

              <input
                type="number"
                min="0"
                step="0.5"
                value={
                  policyForm.maxConsecutiveDays
                }
                onChange={(event) =>
                  setPolicyForm({
                    ...policyForm,

                    maxConsecutiveDays:
                      event.target.value,
                  })
                }
              />

              <small>
                Use 0 for no limit.
              </small>
            </label>

            <label className="field">
              <span>
                Advance Notice Days
              </span>

              <input
                type="number"
                min="0"
                value={
                  policyForm.noticeDays
                }
                onChange={(event) =>
                  setPolicyForm({
                    ...policyForm,

                    noticeDays:
                      event.target.value,
                  })
                }
              />

              <small>
                Use 0 if advance notice is not required.
              </small>
            </label>

            <label className="field span-two">
              <span>
                Maximum Carry Forward
              </span>

              <input
                type="number"
                min="0"
                step="0.5"
                disabled={
                  !policyForm.carryForwardAllowed
                }
                value={
                  policyForm.maxCarryForward
                }
                onChange={(event) =>
                  setPolicyForm({
                    ...policyForm,

                    maxCarryForward:
                      event.target.value,
                  })
                }
              />

              <small>
                Number of unused days that can move to the next year.
              </small>
            </label>
          </div>

          <label className="switch-row">
            <input
              type="checkbox"
              checked={
                policyForm.isPaid
              }
              onChange={(event) =>
                setPolicyForm({
                  ...policyForm,

                  isPaid:
                    event.target.checked,
                })
              }
            />

            <span>
              <strong>
                Paid Leave
              </strong>

              <small>
                Turn OFF only if this leave should deduct salary.
              </small>
            </span>
          </label>

          <label className="switch-row">
            <input
              type="checkbox"
              checked={
                policyForm.allowHalfDay
              }
              onChange={(event) =>
                setPolicyForm({
                  ...policyForm,

                  allowHalfDay:
                    event.target.checked,
                })
              }
            />

            <span>
              <strong>
                Allow Half Day
              </strong>
            </span>
          </label>

          <label className="switch-row">
            <input
              type="checkbox"
              checked={
                policyForm.requiresReason
              }
              onChange={(event) =>
                setPolicyForm({
                  ...policyForm,

                  requiresReason:
                    event.target.checked,
                })
              }
            />

            <span>
              <strong>
                Reason Required
              </strong>
            </span>
          </label>

          <label className="switch-row">
            <input
              type="checkbox"
              checked={
                policyForm.carryForwardAllowed
              }
              onChange={(event) =>
                setPolicyForm({
                  ...policyForm,

                  carryForwardAllowed:
                    event.target.checked,

                  maxCarryForward:
                    event.target.checked
                      ? policyForm.maxCarryForward
                      : 0,
                })
              }
            />

            <span>
              <strong>
                Allow Carry Forward
              </strong>

              <small>
                Unused leave can move into the next leave year.
              </small>
            </span>
          </label>

          {editingPolicy && (
            <label className="switch-row">
              <input
                type="checkbox"
                checked={
                  policyForm.isActive
                }
                onChange={(event) =>
                  setPolicyForm({
                    ...policyForm,

                    isActive:
                      event.target.checked,
                  })
                }
              />

              <span>
                <strong>
                  Active Policy
                </strong>
              </span>
            </label>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                setPolicyOpen(
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
              {editingPolicy
                ? "Save Changes"
                : "Add Policy"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================= */}
      {/* REJECT MODAL */}
      {/* ============================================================= */}

      <Modal
        open={
          Boolean(
            rejecting
          )
        }
        onClose={() =>
          setRejecting(
            null
          )
        }
        title="Reject Leave Request"
      >
        <form
          onSubmit={
            reject
          }
        >
          {rejecting && (
            <Alert type="info">
              Rejecting leave for{" "}
              <strong>
                {fullName(
                  rejecting.employeeId
                )}
              </strong>
              .
            </Alert>
          )}

          <label className="field">
            <span>
              Reason for Rejection
            </span>

            <textarea
              rows="4"
              required
              value={
                rejectNote
              }
              onChange={(event) =>
                setRejectNote(
                  event.target.value
                )
              }
              placeholder="Explain why the request is being rejected."
            />
          </label>

          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                setRejecting(
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
              Reject Leave
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(
          viewingRequest
        )}
        onClose={() =>
          setViewingRequest(
            null
          )
        }
        title="Leave Request Details"
        wide
      >
        {viewingRequest && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "flex-start",
                gap: 16,
                marginBottom: 20,
              }}
            >
              <div>
                <small>
                  EMPLOYEE
                </small>

                <h2
                  style={{
                    margin:
                      "4px 0",
                  }}
                >
                  {fullName(
                    viewingRequest.employeeId
                  )}
                </h2>

                <p>
                  {viewingRequest
                    .employeeId
                    ?.employeeCode ||
                    ""}
                </p>
              </div>

              <Badge
                value={
                  viewingRequest.status
                }
              />
            </div>

            <div
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "repeat(auto-fit, minmax(170px, 1fr))",

                gap: 14,

                marginBottom:
                  20,
              }}
            >
              <div>
                <small>
                  Leave Type
                </small>

                <strong
                  style={{
                    display:
                      "block",
                    marginTop:
                      4,
                  }}
                >
                  {viewingRequest
                    .leaveTypeId
                    ?.name ||
                    "—"}
                </strong>
              </div>

              <div>
                <small>
                  Start Date
                </small>

                <strong
                  style={{
                    display:
                      "block",
                    marginTop:
                      4,
                  }}
                >
                  {formatDate(
                    viewingRequest.startDate
                  )}
                </strong>
              </div>

              <div>
                <small>
                  End Date
                </small>

                <strong
                  style={{
                    display:
                      "block",
                    marginTop:
                      4,
                  }}
                >
                  {formatDate(
                    viewingRequest.endDate
                  )}
                </strong>
              </div>

              <div>
                <small>
                  Total Days
                </small>

                <strong
                  style={{
                    display:
                      "block",
                    marginTop:
                      4,
                  }}
                >
                  {
                    viewingRequest.days
                  }
                </strong>
              </div>

              {viewingRequest.halfDay && (
                <div>
                  <small>
                    Half Day
                  </small>

                  <strong
                    style={{
                      display:
                        "block",
                      marginTop:
                        4,
                    }}
                  >
                    {viewingRequest
                      .halfDayPeriod ===
                    "first-half"
                      ? "First Half"
                      : "Second Half"}
                  </strong>
                </div>
              )}

              <div>
                <small>
                  Requested By
                </small>

                <strong
                  style={{
                    display:
                      "block",
                    marginTop:
                      4,
                  }}
                >
                  {viewingRequest
                    .requestedOnBehalf
                    ? fullName(
                        viewingRequest.requestedByUserId
                      )
                    : "Employee (Self)"}
                </strong>
                {viewingRequest.requestedOnBehalf && (
                  <small
                    style={{
                      display:
                        "block",
                      marginTop:
                        4,
                    }}
                  >
                    {viewingRequest.requestedByRole
                      ?.toUpperCase()}
                    {" · "}
                    Submitted on behalf of employee
                  </small>
                )}
              </div>
            </div>

            {/* Reason */}

            <div
              style={{
                background:
                  "#f8f7fb",

                border:
                  "1px solid #e7e3ee",

                borderRadius:
                  12,

                padding:
                  18,

                marginBottom:
                  18,
              }}
            >
              <small
                style={{
                  display:
                    "block",

                  fontWeight:
                    700,

                  marginBottom:
                    8,
                }}
              >
                REASON FOR LEAVE
              </small>

              <p
                style={{
                  margin: 0,
                  lineHeight:
                    1.7,
                  whiteSpace:
                    "pre-wrap",
                }}
              >
                {viewingRequest.reason ||
                  "No reason provided."}
              </p>
            </div>

            {/* Review */}

            {viewingRequest.status !==
              "pending" && (
              <div
                style={{
                  background:
                    "#fafafa",

                  border:
                    "1px solid #e5e7eb",

                  borderRadius:
                    12,

                  padding:
                    18,

                  marginBottom:
                    18,
                }}
              >
                <small
                  style={{
                    display:
                      "block",
                    fontWeight:
                      700,
                    marginBottom:
                      8,
                  }}
                >
                  REVIEW DETAILS
                </small>

                <p
                  style={{
                    margin:
                      "0 0 6px",
                  }}
                >
                  <strong>
                    Status:
                  </strong>{" "}
                  {viewingRequest.status}
                </p>

                {viewingRequest.reviewedByUserId && (
                  <p
                    style={{
                      margin:
                        "0 0 6px",
                    }}
                  >
                    <strong>
                      Reviewed By:
                    </strong>{" "}
                    {fullName(
                      viewingRequest.reviewedByUserId
                    )}
                  </p>
                )}

                {viewingRequest.reviewedAt && (
                  <p
                    style={{
                      margin:
                        "0 0 6px",
                    }}
                  >
                    <strong>
                      Reviewed On:
                    </strong>{" "}
                    {formatDate(
                      viewingRequest.reviewedAt
                    )}
                  </p>
                )}

                <p
                  style={{
                    margin: 0,
                  }}
                >
                  <strong>
                    Review Note:
                  </strong>{" "}
                  {viewingRequest.reviewNote ||
                    "No note added."}
                </p>
              </div>
            )}

            {/* Actions */}

            <div
              className="modal-actions"
            >
              <button
                type="button"
                className="button secondary"
                onClick={() =>
                  setViewingRequest(
                    null
                  )
                }
              >
                Close
              </button>

              {canApprove &&
                viewingRequest.status ===
                  "pending" &&
                viewingRequest
                  .employeeId
                  ?._id !==
                  employee?._id && (
                  <>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => {
                        setRejecting(
                          viewingRequest
                        );

                        setViewingRequest(
                          null
                        );

                        setRejectNote(
                          ""
                        );
                      }}
                    >
                      Reject
                    </button>

                    <button
                      type="button"
                      className="button primary"
                      disabled={
                        busy
                      }
                      onClick={async () => {
                        await approve(
                          viewingRequest
                        );

                        setViewingRequest(
                          null
                        );
                      }}
                    >
                      Approve
                    </button>
                  </>
                )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}