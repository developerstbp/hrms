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
  StatCard,
} from "../Components/UI";

import {
  formatDate,
  fullName,
  getError,
} from "../utils/format";

const currentMonth = () =>
  new Date()
    .toISOString()
    .slice(0, 7);

const money = (
  value,
  currency = "PKR"
) =>
  new Intl.NumberFormat(
    "en-PK",
    {
      style:
        "currency",

      currency,

      maximumFractionDigits:
        0,
    }
  ).format(
    Number(
      value || 0
    )
  );

const blankSalary = {
  basicSalary:
    "",

  fixedAllowance:
    0,

  otherAllowance:
    0,

  fixedDeduction:
    0,

  overtimeHourlyRate:
    0,

  paymentMethod:
    "bank",

  bankName:
    "",

  accountTitle:
    "",

  accountNumber:
    "",

  notes:
    "",

  effectiveFrom:
    "",

  revisionReason:
    "",
};

export default function Payroll() {
  const {
    employee,
    company,
    hasPermission,
  } = useAuth();

  const canManage =
    hasPermission(
      "payroll.manage"
    );

  const canView =
    hasPermission(
      "payroll.view"
    ) ||
    canManage;

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    profiles,
    setProfiles,
  ] = useState([]);

  const [
    runs,
    setRuns,
  ] = useState([]);

  const [
    payslips,
    setPayslips,
  ] = useState([]);

  const [
    settings,
    setSettings,
  ] = useState(null);

  const [
    currency,
    setCurrency,
  ] = useState(
    company?.currency ||
      "PKR"
  );

  const [
    month,
    setMonth,
  ] = useState(
    currentMonth()
  );

  const [
    selectedRun,
    setSelectedRun,
  ] = useState(null);

  const [
    selectedPayslip,
    setSelectedPayslip,
  ] = useState(null);

  const [
    salaryEmployee,
    setSalaryEmployee,
  ] = useState(null);

  const [
    salaryForm,
    setSalaryForm,
  ] = useState(
    blankSalary
  );

  const [
    salaryHistory,
    setSalaryHistory,
  ] = useState([]);

  const [
    settingsOpen,
    setSettingsOpen,
  ] = useState(false);

  const [
    adjusting,
    setAdjusting,
  ] = useState(null);

  const [
    adjustForm,
    setAdjustForm,
  ] = useState({
    manualAdjustment:
      0,

    adjustmentNote:
      "",
  });

  const [
    error,
    setError,
  ] = useState("");

  const [
    notice,
    setNotice,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  /*
  |--------------------------------------------------------------------------
  | Load
  |--------------------------------------------------------------------------
  */

  const load = async () => {
    try {
      if (
        canView
      ) {
        const [
          employeesRes,
          profilesRes,
          runsRes,
          settingsRes,
        ] =
          await Promise.all([
            api.get(
              "/employees"
            ),

            api.get(
              "/payroll/salary-profiles"
            ),

            api.get(
              "/payroll/runs"
            ),

            api.get(
              "/payroll/settings"
            ),
          ]);

        setEmployees(
          employeesRes.data
        );

        setProfiles(
          profilesRes.data
        );

        setRuns(
          runsRes.data
        );

        setSettings(
          settingsRes.data
            .payrollSettings
        );

        setCurrency(
          settingsRes.data
            .currency ||
            company?.currency ||
            "PKR"
        );
      }

      if (
        hasPermission(
          "payroll.self"
        ) &&
        employee
      ) {
        const {
          data,
        } =
          await api.get(
            "/payroll/me/payslips"
          );

        setPayslips(
          data
        );
      }

      setError("");
    } catch (err) {
      setError(
        getError(
          err,
          "Unable to load payroll."
        )
      );
    }
  };

  useEffect(() => {
    load();
  }, [
    employee?._id,
  ]);

  /*
  |--------------------------------------------------------------------------
  | Profile Map
  |--------------------------------------------------------------------------
  */

  const profileMap =
    useMemo(
      () =>
        new Map(
          profiles
            .filter(
              (profile) =>
                profile.employeeId
            )
            .map(
              (profile) => [
                profile
                  .employeeId
                  ._id,

                profile,
              ]
            )
        ),
      [
        profiles,
      ]
    );

  const latestRun =
    runs[0];

  const configuredCount =
    profiles.length;

  /*
  |--------------------------------------------------------------------------
  | Open Salary / Compensation
  |--------------------------------------------------------------------------
  */

  const openSalary = (
    emp
  ) => {
    const profile =
      profileMap.get(
        emp._id
      );

    setSalaryEmployee(
      emp
    );

    setSalaryHistory(
      profile
        ?.compensationHistory ||
        []
    );

    if (profile) {
      setSalaryForm({
        basicSalary:
          profile.basicSalary,

        fixedAllowance:
          profile.fixedAllowance ||
          0,

        otherAllowance:
          profile.otherAllowance ||
          0,

        fixedDeduction:
          profile.fixedDeduction ||
          0,

        overtimeHourlyRate:
          profile.overtimeHourlyRate ||
          0,

        paymentMethod:
          profile.paymentMethod ||
          "bank",

        bankName:
          profile.bankName ||
          "",

        accountTitle:
          profile.accountTitle ||
          "",

        accountNumber:
          profile.accountNumber ||
          "",

        notes:
          profile.notes ||
          "",

        effectiveFrom:
          new Date()
            .toISOString()
            .slice(
              0,
              10
            ),

        revisionReason:
          "",
      });
    } else {
      setSalaryForm({
        ...blankSalary,

        effectiveFrom:
          emp.joiningDate?.slice(
            0,
            10
          ) ||
          new Date()
            .toISOString()
            .slice(
              0,
              10
            ),
      });
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Save Compensation Revision
  |--------------------------------------------------------------------------
  */

  const saveSalary =
    async (event) => {
      event.preventDefault();

      try {
        await api.put(
          `/payroll/salary-profiles/${salaryEmployee._id}`,
          salaryForm
        );

        setSalaryEmployee(
          null
        );

        setSalaryHistory(
          []
        );

        setNotice(
          "Compensation revision saved successfully."
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
  | Generate Payroll
  |--------------------------------------------------------------------------
  */

  const generate =
    async () => {
      setLoading(true);

      try {
        const {
          data,
        } =
          await api.post(
            "/payroll/runs/generate",
            {
              month,
            }
          );

        setSelectedRun(
          data
        );

        if (
          data
            .skippedEmployees
            ?.length
        ) {
          setNotice(
            `Draft payroll generated. ${data.skippedEmployees.length} employee(s) were skipped because compensation was missing or did not cover the payroll period.`
          );
        } else {
          setNotice(
            "Draft payroll generated successfully."
          );
        }

        await load();
      } catch (err) {
        setError(
          getError(err)
        );
      } finally {
        setLoading(false);
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Open Run
  |--------------------------------------------------------------------------
  */

  const openRun =
    async (run) => {
      try {
        const {
          data,
        } =
          await api.get(
            `/payroll/runs/${run._id}`
          );

        setSelectedRun(
          data
        );
      } catch (err) {
        setError(
          getError(err)
        );
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Finalize
  |--------------------------------------------------------------------------
  */

  const finalize =
    async () => {
      if (
        !window.confirm(
          "Finalize and lock this payroll? It can no longer be regenerated or adjusted."
        )
      ) {
        return;
      }

      try {
        await api.put(
          `/payroll/runs/${selectedRun.run._id}/finalize`
        );

        setNotice(
          "Payroll finalized and locked."
        );

        const {
          data,
        } =
          await api.get(
            `/payroll/runs/${selectedRun.run._id}`
          );

        setSelectedRun(
          data
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
  | Paid
  |--------------------------------------------------------------------------
  */

  const markPaid =
    async () => {
      if (
        !window.confirm(
          "Mark this finalized payroll as paid?"
        )
      ) {
        return;
      }

      try {
        await api.put(
          `/payroll/runs/${selectedRun.run._id}/paid`
        );

        setNotice(
          "Payroll marked as paid."
        );

        const {
          data,
        } =
          await api.get(
            `/payroll/runs/${selectedRun.run._id}`
          );

        setSelectedRun(
          data
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
  | Adjustment
  |--------------------------------------------------------------------------
  */

  const saveAdjustment =
    async (event) => {
      event.preventDefault();

      try {
        await api.put(
          `/payroll/entries/${adjusting._id}/adjust`,
          {
            ...adjustForm,

            manualAdjustment:
              Number(
                adjustForm.manualAdjustment ||
                  0
              ),
          }
        );

        setAdjusting(
          null
        );

        const {
          data,
        } =
          await api.get(
            `/payroll/runs/${selectedRun.run._id}`
          );

        setSelectedRun(
          data
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
  | Existing Payroll Settings Modal
  |--------------------------------------------------------------------------
  */

  const saveSettings =
    async (event) => {
      event.preventDefault();

      try {
        await api.put(
          "/payroll/settings",
          settings
        );

        setSettingsOpen(
          false
        );

        setNotice(
          "Payroll calculation settings updated."
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
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <>
      <PageHeader
        title="Payroll"
        description={
          canView
            ? "Manage effective-dated compensation, payroll runs and locked payslips."
            : "View your finalized monthly payslips."
        }
        action={
          canManage && (
            <button
              className="button secondary"
              onClick={() =>
                setSettingsOpen(
                  true
                )
              }
            >
              Payroll settings
            </button>
          )
        }
      />

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

      {canView && (
        <>
          <div className="stats-grid">
            <StatCard
              label="Salary profiles"
              value={`${configuredCount}/${employees.length}`}
              helper="Employees configured"
              icon="₨"
            />

            <StatCard
              label="Latest payroll"
              value={
                latestRun?.month ||
                "—"
              }
              helper={
                latestRun?.status ||
                "No run yet"
              }
              icon="▣"
            />

            <StatCard
              label="Latest net total"
              value={
                latestRun
                  ? money(
                      latestRun.netTotal,
                      currency
                    )
                  : "—"
              }
              helper="After deductions"
              icon="↗"
            />

            <StatCard
              label="Pay day"
              value={
                settings?.payDay
                  ? `Day ${settings.payDay}`
                  : "—"
              }
              helper="Company payroll setting"
              icon="◷"
            />
          </div>

          {/* ===========================================================
              GENERATE PAYROLL
          ============================================================ */}

          <Card className="payroll-generate">
            <div>
              <span className="eyebrow">
                Payroll run
              </span>

              <h2>
                Generate a draft
                before finalizing
              </h2>

              <p>
                The configured
                payroll cycle,
                work calendar,
                holidays and
                effective salary
                history will be
                used automatically.
              </p>
            </div>

            <div className="payroll-generate-actions">
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

              <button
                className="button primary"
                disabled={
                  loading
                }
                onClick={
                  generate
                }
              >
                {loading
                  ? "Generating..."
                  : "Generate payroll"}
              </button>
            </div>
          </Card>

          {/* ===========================================================
              PAYROLL HISTORY
          ============================================================ */}

          <Card>
            <div className="card-head">
              <div>
                <h2>
                  Payroll history
                </h2>

                <p>
                  Finalized runs
                  retain their
                  original period
                  and calculation
                  snapshots.
                </p>
              </div>
            </div>

            {runs.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>
                        Month
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Employees
                      </th>

                      <th>
                        Gross
                      </th>

                      <th>
                        Deductions
                      </th>

                      <th>
                        Net payroll
                      </th>

                      <th />
                    </tr>
                  </thead>

                  <tbody>
                    {runs.map(
                      (run) => (
                        <tr
                          key={
                            run._id
                          }
                        >
                          <td>
                            <strong>
                              {
                                run.month
                              }
                            </strong>

                            <small>
                              {formatDate(
                                run.periodStart
                              )}{" "}
                              —{" "}
                              {formatDate(
                                run.periodEnd
                              )}
                            </small>
                          </td>

                          <td>
                            <Badge
                              value={
                                run.status
                              }
                            />
                          </td>

                          <td>
                            {
                              run.employeeCount
                            }
                          </td>

                          <td>
                            {money(
                              run.grossTotal,
                              currency
                            )}
                          </td>

                          <td>
                            {money(
                              run.deductionTotal,
                              currency
                            )}
                          </td>

                          <td>
                            <strong>
                              {money(
                                run.netTotal,
                                currency
                              )}
                            </strong>
                          </td>

                          <td>
                            <button
                              className="text-button"
                              onClick={() =>
                                openRun(
                                  run
                                )
                              }
                            >
                              Open
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
                title="No payroll runs yet"
                description="Choose a month and generate the first draft payroll."
              />
            )}
          </Card>

          {/* ===========================================================
              COMPENSATION SETUP
          ============================================================ */}

          <Card>
            <div className="card-head">
              <div>
                <h2>
                  Compensation
                  setup
                </h2>

                <p>
                  Salary revisions
                  are effective-dated.
                  Previous salary
                  history is
                  preserved.
                </p>
              </div>
            </div>

            {employees.length ? (
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
                        Current salary
                      </th>

                      <th>
                        Allowances
                      </th>

                      <th>
                        Effective
                      </th>

                      <th>
                        Revisions
                      </th>

                      <th />
                    </tr>
                  </thead>

                  <tbody>
                    {employees.map(
                      (emp) => {
                        const profile =
                          profileMap.get(
                            emp._id
                          );

                        return (
                          <tr
                            key={
                              emp._id
                            }
                          >
                            <td>
                              <strong>
                                {fullName(
                                  emp
                                )}
                              </strong>

                              <small>
                                {
                                  emp.employeeCode
                                }{" "}
                                ·{" "}
                                {
                                  emp.designation
                                }
                              </small>
                            </td>

                            <td>
                              {emp
                                .departmentId
                                ?.name ||
                                "—"}
                            </td>

                            <td>
                              {profile
                                ? money(
                                    profile.basicSalary,
                                    currency
                                  )
                                : "—"}
                            </td>

                            <td>
                              {profile
                                ? money(
                                    Number(
                                      profile.fixedAllowance ||
                                        0
                                    ) +
                                      Number(
                                        profile.otherAllowance ||
                                          0
                                      ),
                                    currency
                                  )
                                : "—"}
                            </td>

                            <td>
                              {profile
                                ?.effectiveFrom
                                ? formatDate(
                                    profile.effectiveFrom
                                  )
                                : "—"}
                            </td>

                            <td>
                              {profile
                                ?.compensationHistory
                                ?.length ||
                                0}
                            </td>

                            <td>
                              {canManage && (
                                <button
                                  className="text-button"
                                  onClick={() =>
                                    openSalary(
                                      emp
                                    )
                                  }
                                >
                                  {profile
                                    ? "Manage"
                                    : "Set salary"}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No employees available" />
            )}
          </Card>
        </>
      )}

      {/* ===============================================================
          MY PAYSLIPS
      ================================================================ */}

      {hasPermission(
        "payroll.self"
      ) &&
        employee && (
          <Card>
            <div className="card-head">
              <div>
                <h2>
                  My payslips
                </h2>

                <p>
                  Only finalized
                  or paid payroll
                  is visible here.
                </p>
              </div>
            </div>

            {payslips.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>
                        Month
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Gross pay
                      </th>

                      <th>
                        Deductions
                      </th>

                      <th>
                        Adjustment
                      </th>

                      <th>
                        Net pay
                      </th>

                      <th />
                    </tr>
                  </thead>

                  <tbody>
                    {payslips.map(
                      (entry) => (
                        <tr
                          key={
                            entry._id
                          }
                        >
                          <td>
                            <strong>
                              {
                                entry
                                  .run
                                  ?.month
                              }
                            </strong>

                            <small>
                              {formatDate(
                                entry
                                  .run
                                  ?.periodStart
                              )}{" "}
                              —{" "}
                              {formatDate(
                                entry
                                  .run
                                  ?.periodEnd
                              )}
                            </small>
                          </td>

                          <td>
                            <Badge
                              value={
                                entry
                                  .run
                                  ?.status
                              }
                            />
                          </td>

                          <td>
                            {money(
                              entry.grossPay,
                              currency
                            )}
                          </td>

                          <td>
                            {money(
                              entry.totalDeductions,
                              currency
                            )}
                          </td>

                          <td>
                            {money(
                              entry.manualAdjustment,
                              currency
                            )}
                          </td>

                          <td>
                            <strong>
                              {money(
                                entry.netPay +
                                  entry.manualAdjustment,
                                currency
                              )}
                            </strong>
                          </td>

                          <td>
                            <button
                              className="text-button"
                              onClick={() =>
                                setSelectedPayslip(
                                  entry
                                )
                              }
                            >
                              View payslip
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
                title="No payslips available"
                description="Finalized payroll will appear here automatically."
              />
            )}
          </Card>
        )}

      {/* ===============================================================
          COMPENSATION MODAL
      ================================================================ */}

      <Modal
        open={
          Boolean(
            salaryEmployee
          )
        }
        onClose={() =>
          setSalaryEmployee(
            null
          )
        }
        title="Compensation"
        wide
      >
        <form
          onSubmit={
            saveSalary
          }
        >
          <Alert type="error">
            {error}
          </Alert>

          {salaryEmployee && (
            <div className="review-summary">
              <strong>
                {fullName(
                  salaryEmployee
                )}
              </strong>

              <span>
                {
                  salaryEmployee.employeeCode
                }{" "}
                ·{" "}
                {
                  salaryEmployee.designation
                }
              </span>
            </div>
          )}

          <div className="form-grid three">
            <label className="field">
              <span>
                Basic monthly
                salary *
              </span>

              <input
                type="number"
                min="0"
                required
                value={
                  salaryForm.basicSalary
                }
                onChange={(
                  event
                ) =>
                  setSalaryForm({
                    ...salaryForm,

                    basicSalary:
                      event
                        .target
                        .value,
                  })
                }
              />
            </label>

            <label className="field">
              <span>
                Fixed allowance
              </span>

              <input
                type="number"
                min="0"
                value={
                  salaryForm.fixedAllowance
                }
                onChange={(
                  event
                ) =>
                  setSalaryForm({
                    ...salaryForm,

                    fixedAllowance:
                      event
                        .target
                        .value,
                  })
                }
              />
            </label>

            <label className="field">
              <span>
                Other allowance
              </span>

              <input
                type="number"
                min="0"
                value={
                  salaryForm.otherAllowance
                }
                onChange={(
                  event
                ) =>
                  setSalaryForm({
                    ...salaryForm,

                    otherAllowance:
                      event
                        .target
                        .value,
                  })
                }
              />
            </label>

            <label className="field">
              <span>
                Fixed monthly
                deduction
              </span>

              <input
                type="number"
                min="0"
                value={
                  salaryForm.fixedDeduction
                }
                onChange={(
                  event
                ) =>
                  setSalaryForm({
                    ...salaryForm,

                    fixedDeduction:
                      event
                        .target
                        .value,
                  })
                }
              />
            </label>

            <label className="field">
              <span>
                Overtime hourly
                rate
              </span>

              <input
                type="number"
                min="0"
                value={
                  salaryForm.overtimeHourlyRate
                }
                onChange={(
                  event
                ) =>
                  setSalaryForm({
                    ...salaryForm,

                    overtimeHourlyRate:
                      event
                        .target
                        .value,
                  })
                }
              />
            </label>

            <label className="field">
              <span>
                Effective from *
              </span>

              <input
                type="date"
                required
                value={
                  salaryForm.effectiveFrom
                }
                onChange={(
                  event
                ) =>
                  setSalaryForm({
                    ...salaryForm,

                    effectiveFrom:
                      event
                        .target
                        .value,
                  })
                }
              />
            </label>

            <label className="field span-two">
              <span>
                Revision reason
              </span>

              <input
                value={
                  salaryForm.revisionReason
                }
                onChange={(
                  event
                ) =>
                  setSalaryForm({
                    ...salaryForm,

                    revisionReason:
                      event
                        .target
                        .value,
                  })
                }
                placeholder="Annual increment, promotion, correction..."
              />
            </label>

            <label className="field">
              <span>
                Payment method
              </span>

              <select
                value={
                  salaryForm.paymentMethod
                }
                onChange={(
                  event
                ) =>
                  setSalaryForm({
                    ...salaryForm,

                    paymentMethod:
                      event
                        .target
                        .value,
                  })
                }
              >
                <option value="bank">
                  Bank transfer
                </option>

                <option value="cash">
                  Cash
                </option>

                <option value="cheque">
                  Cheque
                </option>

                <option value="other">
                  Other
                </option>
              </select>
            </label>

            <label className="field">
              <span>
                Bank name
              </span>

              <input
                value={
                  salaryForm.bankName
                }
                onChange={(
                  event
                ) =>
                  setSalaryForm({
                    ...salaryForm,

                    bankName:
                      event
                        .target
                        .value,
                  })
                }
              />
            </label>

            <label className="field">
              <span>
                Account title
              </span>

              <input
                value={
                  salaryForm.accountTitle
                }
                onChange={(
                  event
                ) =>
                  setSalaryForm({
                    ...salaryForm,

                    accountTitle:
                      event
                        .target
                        .value,
                  })
                }
              />
            </label>

            <label className="field span-two">
              <span>
                Account / IBAN
              </span>

              <input
                value={
                  salaryForm.accountNumber
                }
                onChange={(
                  event
                ) =>
                  setSalaryForm({
                    ...salaryForm,

                    accountNumber:
                      event
                        .target
                        .value,
                  })
                }
              />
            </label>

            <label className="field">
              <span>
                Internal notes
              </span>

              <input
                value={
                  salaryForm.notes
                }
                onChange={(
                  event
                ) =>
                  setSalaryForm({
                    ...salaryForm,

                    notes:
                      event
                        .target
                        .value,
                  })
                }
              />
            </label>
          </div>

          {/* ===========================================================
              SALARY HISTORY
          ============================================================ */}

          <div
            style={{
              marginTop:
                24,
            }}
          >
            <div className="card-head">
              <div>
                <h2>
                  Compensation
                  history
                </h2>

                <p>
                  Previous salary
                  revisions are
                  preserved and
                  used for
                  historical
                  payroll.
                </p>
              </div>
            </div>

            {salaryHistory.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>
                        Effective
                      </th>

                      <th>
                        Basic
                        salary
                      </th>

                      <th>
                        Allowances
                      </th>

                      <th>
                        Fixed
                        deduction
                      </th>

                      <th>
                        Reason
                      </th>

                      <th>
                        Changed by
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {salaryHistory.map(
                      (
                        revision
                      ) => (
                        <tr
                          key={
                            revision._id
                          }
                        >
                          <td>
                            {formatDate(
                              revision.effectiveFrom
                            )}
                          </td>

                          <td>
                            <strong>
                              {money(
                                revision.basicSalary,
                                currency
                              )}
                            </strong>
                          </td>

                          <td>
                            {money(
                              Number(
                                revision.fixedAllowance ||
                                  0
                              ) +
                                Number(
                                  revision.otherAllowance ||
                                    0
                                ),
                              currency
                            )}
                          </td>

                          <td>
                            {money(
                              revision.fixedDeduction,
                              currency
                            )}
                          </td>

                          <td>
                            {revision.reason ||
                              "—"}
                          </td>

                          <td>
                            {revision.changedByUserId
                              ? `${revision.changedByUserId.firstName || ""} ${revision.changedByUserId.lastName || ""}`.trim() ||
                                revision.changedByUserId
                                  .email ||
                                "—"
                              : "—"}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <p
                style={{
                  color:
                    "#6b7280",
                }}
              >
                No salary revision
                history yet. Saving
                this compensation
                will create the
                first dated record.
              </p>
            )}
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                setSalaryEmployee(
                  null
                )
              }
            >
              Cancel
            </button>

            <button className="button primary">
              Save compensation
              revision
            </button>
          </div>
        </form>
      </Modal>

      {/* ===============================================================
          PAYROLL RUN MODAL
      ================================================================ */}

      <Modal
        open={
          Boolean(
            selectedRun
          )
        }
        onClose={() =>
          setSelectedRun(
            null
          )
        }
        title={
          selectedRun
            ? `Payroll · ${selectedRun.run.month}`
            : "Payroll"
        }
        wide
      >
        {selectedRun && (
          <>
            <div className="payroll-run-summary">
              <div>
                <span>
                  Status
                </span>

                <Badge
                  value={
                    selectedRun
                      .run
                      .status
                  }
                />
              </div>

              <div>
                <span>
                  Period
                </span>

                <strong>
                  {formatDate(
                    selectedRun
                      .run
                      .periodStart
                  )}{" "}
                  —{" "}
                  {formatDate(
                    selectedRun
                      .run
                      .periodEnd
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Employees
                </span>

                <strong>
                  {
                    selectedRun
                      .run
                      .employeeCount
                  }
                </strong>
              </div>

              <div>
                <span>
                  Gross
                </span>

                <strong>
                  {money(
                    selectedRun
                      .run
                      .grossTotal,
                    currency
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Deductions
                </span>

                <strong>
                  {money(
                    selectedRun
                      .run
                      .deductionTotal,
                    currency
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Net payroll
                </span>

                <strong>
                  {money(
                    selectedRun
                      .run
                      .netTotal,
                    currency
                  )}
                </strong>
              </div>
            </div>

            <div className="table-wrap payroll-entry-table">
              <table>
                <thead>
                  <tr>
                    <th>
                      Employee
                    </th>

                    <th>
                      Attendance
                    </th>

                    <th>
                      Salary
                      segments
                    </th>

                    <th>
                      Gross
                    </th>

                    <th>
                      Deductions
                    </th>

                    <th>
                      Adjustment
                    </th>

                    <th>
                      Net
                    </th>

                    <th />
                  </tr>
                </thead>

                <tbody>
                  {selectedRun.entries.map(
                    (entry) => (
                      <tr
                        key={
                          entry._id
                        }
                      >
                        <td>
                          <strong>
                            {
                              entry
                                .employeeSnapshot
                                .name
                            }
                          </strong>

                          <small>
                            {
                              entry
                                .employeeSnapshot
                                .employeeCode
                            }{" "}
                            ·{" "}
                            {
                              entry
                                .employeeSnapshot
                                .department
                            }
                          </small>
                        </td>

                        <td>
                          <strong>
                            {
                              entry
                                .attendanceSummary
                                .presentDays
                            }{" "}
                            present ·{" "}
                            {
                              entry
                                .attendanceSummary
                                .lateDays
                            }{" "}
                            late
                          </strong>

                          <small>
                            {
                              entry
                                .attendanceSummary
                                .wfhDays
                            }{" "}
                            WFH ·{" "}
                            {
                              entry
                                .attendanceSummary
                                .holidayDays
                            }{" "}
                            holiday ·{" "}
                            {
                              entry
                                .attendanceSummary
                                .absentDays
                            }{" "}
                            absent
                          </small>
                        </td>

                        <td>
                          <strong>
                            {entry
                              .salarySegments
                              ?.length ||
                              1}
                          </strong>

                          <small>
                            Effective salary
                            segment(s)
                          </small>
                        </td>

                        <td>
                          {money(
                            entry.grossPay,
                            currency
                          )}
                        </td>

                        <td>
                          {money(
                            entry.totalDeductions,
                            currency
                          )}
                        </td>

                        <td>
                          {money(
                            entry.manualAdjustment,
                            currency
                          )}
                        </td>

                        <td>
                          <strong>
                            {money(
                              entry.netPay +
                                entry.manualAdjustment,
                              currency
                            )}
                          </strong>
                        </td>

                        <td>
                          {canManage &&
                            selectedRun
                              .run
                              .status ===
                              "draft" && (
                              <button
                                className="text-button"
                                onClick={() => {
                                  setAdjusting(
                                    entry
                                  );

                                  setAdjustForm(
                                    {
                                      manualAdjustment:
                                        entry.manualAdjustment ||
                                        0,

                                      adjustmentNote:
                                        entry.adjustmentNote ||
                                        "",
                                    }
                                  );
                                }}
                              >
                                Adjust
                              </button>
                            )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="modal-actions">
              <button
                className="button secondary"
                onClick={() =>
                  setSelectedRun(
                    null
                  )
                }
              >
                Close
              </button>

              {canManage &&
                selectedRun
                  .run
                  .status ===
                  "draft" && (
                  <button
                    className="button primary"
                    onClick={
                      finalize
                    }
                  >
                    Finalize &
                    lock
                  </button>
                )}

              {canManage &&
                selectedRun
                  .run
                  .status ===
                  "finalized" && (
                  <button
                    className="button primary"
                    onClick={
                      markPaid
                    }
                  >
                    Mark as paid
                  </button>
                )}
            </div>
          </>
        )}
      </Modal>

      {/* ===============================================================
          ADJUSTMENT MODAL
      ================================================================ */}

      <Modal
        open={
          Boolean(
            adjusting
          )
        }
        onClose={() =>
          setAdjusting(
            null
          )
        }
        title="Manual payroll adjustment"
      >
        <form
          onSubmit={
            saveAdjustment
          }
        >
          <Alert type="error">
            {error}
          </Alert>

          {adjusting && (
            <div className="review-summary">
              <strong>
                {
                  adjusting
                    .employeeSnapshot
                    .name
                }
              </strong>

              <span>
                Calculated net:{" "}
                {money(
                  adjusting.netPay,
                  currency
                )}
              </span>
            </div>
          )}

          <label className="field">
            <span>
              Adjustment amount
            </span>

            <input
              type="number"
              step="0.01"
              value={
                adjustForm.manualAdjustment
              }
              onChange={(
                event
              ) =>
                setAdjustForm({
                  ...adjustForm,

                  manualAdjustment:
                    event
                      .target
                      .value,
                })
              }
            />

            <small>
              Positive value =
              addition. Negative
              value = deduction.
            </small>
          </label>

          <label className="field">
            <span>
              Adjustment note
            </span>

            <textarea
              rows="3"
              value={
                adjustForm.adjustmentNote
              }
              onChange={(
                event
              ) =>
                setAdjustForm({
                  ...adjustForm,

                  adjustmentNote:
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
                setAdjusting(
                  null
                )
              }
            >
              Cancel
            </button>

            <button className="button primary">
              Save adjustment
            </button>
          </div>
        </form>
      </Modal>

      {/* ===============================================================
          PAYROLL SETTINGS
      ================================================================ */}

      <Modal
        open={
          settingsOpen
        }
        onClose={() =>
          setSettingsOpen(
            false
          )
        }
        title="Payroll settings"
      >
        <form
          onSubmit={
            saveSettings
          }
        >
          {settings && (
            <div className="form-grid two">
              <label className="field">
                <span>
                  Salary day
                  divisor
                </span>

                <input
                  type="number"
                  min="1"
                  value={
                    settings.salaryDayDivisor ??
                    30
                  }
                  onChange={(
                    event
                  ) =>
                    setSettings({
                      ...settings,

                      salaryDayDivisor:
                        Number(
                          event
                            .target
                            .value
                        ),
                    })
                  }
                />
              </label>

              <label className="field">
                <span>
                  Pay day
                </span>

                <input
                  type="number"
                  min="1"
                  max="31"
                  value={
                    settings.payDay ??
                    5
                  }
                  onChange={(
                    event
                  ) =>
                    setSettings({
                      ...settings,

                      payDay:
                        Number(
                          event
                            .target
                            .value
                        ),
                    })
                  }
                />
              </label>

              <label className="field">
                <span>
                  Late penalty
                  per late day
                </span>

                <input
                  type="number"
                  min="0"
                  value={
                    settings.latePenaltyAmount ??
                    0
                  }
                  onChange={(
                    event
                  ) =>
                    setSettings({
                      ...settings,

                      latePenaltyAmount:
                        Number(
                          event
                            .target
                            .value
                        ),
                    })
                  }
                />
              </label>

              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={
                    Boolean(
                      settings.overtimeEnabled
                    )
                  }
                  onChange={(
                    event
                  ) =>
                    setSettings({
                      ...settings,

                      overtimeEnabled:
                        event
                          .target
                          .checked,
                    })
                  }
                />

                <span>
                  <strong>
                    Calculate
                    overtime
                  </strong>
                </span>
              </label>

              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={
                    settings.deductAbsence !==
                    false
                  }
                  onChange={(
                    event
                  ) =>
                    setSettings({
                      ...settings,

                      deductAbsence:
                        event
                          .target
                          .checked,
                    })
                  }
                />

                <span>
                  <strong>
                    Deduct
                    absences
                  </strong>
                </span>
              </label>

              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={
                    settings.deductUnpaidLeave !==
                    false
                  }
                  onChange={(
                    event
                  ) =>
                    setSettings({
                      ...settings,

                      deductUnpaidLeave:
                        event
                          .target
                          .checked,
                    })
                  }
                />

                <span>
                  <strong>
                    Deduct unpaid
                    leave
                  </strong>
                </span>
              </label>

              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={
                    settings.deductHalfDay !==
                    false
                  }
                  onChange={(
                    event
                  ) =>
                    setSettings({
                      ...settings,

                      deductHalfDay:
                        event
                          .target
                          .checked,
                    })
                  }
                />

                <span>
                  <strong>
                    Deduct
                    half-days
                  </strong>
                </span>
              </label>
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                setSettingsOpen(
                  false
                )
              }
            >
              Cancel
            </button>

            <button className="button primary">
              Save settings
            </button>
          </div>
        </form>
      </Modal>

      {/* ===============================================================
          PAYSLIP
      ================================================================ */}

      <Modal
        open={
          Boolean(
            selectedPayslip
          )
        }
        onClose={() =>
          setSelectedPayslip(
            null
          )
        }
        title={
          selectedPayslip
            ? `Payslip · ${selectedPayslip.run?.month}`
            : "Payslip"
        }
      >
        {selectedPayslip && (
          <div className="payslip">
            <div className="payslip-head">
              <div>
                <span>
                  {
                    selectedPayslip
                      .employeeSnapshot
                      .employeeCode
                  }
                </span>

                <h2>
                  {
                    selectedPayslip
                      .employeeSnapshot
                      .name
                  }
                </h2>

                <p>
                  {
                    selectedPayslip
                      .employeeSnapshot
                      .designation
                  }
                </p>
              </div>

              <Badge
                value={
                  selectedPayslip
                    .run
                    ?.status
                }
              />
            </div>

            <div className="payslip-lines">
              <div>
                <span>
                  Basic pay
                </span>

                <strong>
                  {money(
                    selectedPayslip.basePay,
                    currency
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Allowances
                </span>

                <strong>
                  {money(
                    selectedPayslip.allowanceTotal,
                    currency
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Overtime
                </span>

                <strong>
                  {money(
                    selectedPayslip.overtimeAmount,
                    currency
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Attendance /
                  leave deductions
                </span>

                <strong>
                  -{" "}
                  {money(
                    Number(
                      selectedPayslip.absenceDeduction ||
                        0
                    ) +
                      Number(
                        selectedPayslip.unpaidLeaveDeduction ||
                          0
                      ) +
                      Number(
                        selectedPayslip.halfDayDeduction ||
                          0
                      ) +
                      Number(
                        selectedPayslip.lateDeduction ||
                          0
                      ),
                    currency
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Fixed
                  deduction
                </span>

                <strong>
                  -{" "}
                  {money(
                    selectedPayslip.fixedDeduction,
                    currency
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Manual
                  adjustment
                </span>

                <strong>
                  {money(
                    selectedPayslip.manualAdjustment,
                    currency
                  )}
                </strong>
              </div>

              <div className="total">
                <span>
                  Net pay
                </span>

                <strong>
                  {money(
                    selectedPayslip.netPay +
                      selectedPayslip.manualAdjustment,
                    currency
                  )}
                </strong>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}