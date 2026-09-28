import {
  useEffect,
  useState,
} from "react";

import api from "../services/api";

import {
  Alert,
  Card,
  PageHeader,
} from "../Components/UI";

import {
  getError,
} from "../utils/format";

import {
  useAuth,
} from "../context/AuthContext";

const defaultEmailSettings = {
  enabled: false,
  leave: true,
  shift: true,
  attendance: true,
  lifecycle: true,
  system: true,
  payroll: true,
};

export default function Settings() {
  const {
    refreshMe,
  } =
    useAuth();

  const [
    form,
    setForm,
  ] =
    useState({
      name: "",
      email: "",
      phone: "",
      address: "",
      timezone:
        "Asia/Karachi",
      currency:
        "PKR",
      workStartTime:
        "09:00",
      workEndTime:
        "18:00",
      graceMinutes:
        15,
      emailNotifications: {
        ...defaultEmailSettings,
      },
    });

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
    testingEmail,
    setTestingEmail,
  ] =
    useState(false);

  /*
  |--------------------------------------------------------------------------
  | Load
  |--------------------------------------------------------------------------
  */

  useEffect(
    () => {
      api
        .get(
          "/company"
        )
        .then(
          ({
            data,
          }) => {
            setForm(
              (
                previous
              ) => ({
                ...previous,
                ...data,

                emailNotifications: {
                  ...defaultEmailSettings,
                  ...(
                    data.emailNotifications ||
                    {}
                  ),
                },
              })
            );
          }
        )
        .catch(
          (
            err
          ) =>
            setError(
              getError(
                err
              )
            )
        );
    },
    []
  );

  /*
  |--------------------------------------------------------------------------
  | General Fields
  |--------------------------------------------------------------------------
  */

  const change =
    (
      event
    ) => {
      setForm({
        ...form,

        [
          event.target
            .name
        ]:
          event.target
            .value,
      });
    };

  /*
  |--------------------------------------------------------------------------
  | Email Toggles
  |--------------------------------------------------------------------------
  */

  const toggleEmail =
    (
      key
    ) => {
      setForm({
        ...form,

        emailNotifications: {
          ...form.emailNotifications,

          [key]:
            !form
              .emailNotifications[
                key
              ],
        },
      });
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

      try {
        setError(
          ""
        );

        await api.put(
          "/company",
          {
            name:
              form.name,

            email:
              form.email,

            phone:
              form.phone,

            address:
              form.address,

            timezone:
              form.timezone,

            currency:
              form.currency,

            workStartTime:
              form.workStartTime,

            workEndTime:
              form.workEndTime,

            graceMinutes:
              Number(
                form.graceMinutes
              ),

            emailNotifications:
              form.emailNotifications,
          }
        );

        setNotice(
          "Company settings updated successfully."
        );

        await refreshMe();
      } catch (err) {
        setError(
          getError(
            err
          )
        );
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Test Email
  |--------------------------------------------------------------------------
  */

  const testEmail =
    async () => {
      try {
        setTestingEmail(
          true
        );

        setError(
          ""
        );

        const {
          data,
        } =
          await api.post(
            "/company/email/test"
          );

        setNotice(
          data.message
        );
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to send test email."
          )
        );
      } finally {
        setTestingEmail(
          false
        );
      }
    };

  return (
    <>
      <PageHeader
        title="Company Settings"
        description="Manage company information, attendance defaults and HRMS email notifications."
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

      <form
        onSubmit={
          submit
        }
      >
        {/* =========================================================== */}
        {/* COMPANY */}
        {/* =========================================================== */}

        <Card>
          <div className="card-head">
            <div>
              <h2>
                Company Information
              </h2>

              <p>
                Used throughout the
                HRMS workspace.
              </p>
            </div>
          </div>

          <div className="form-grid two">
            <label className="field">
              <span>
                Company Name *
              </span>

              <input
                name="name"
                required
                value={
                  form.name ||
                  ""
                }
                onChange={
                  change
                }
              />
            </label>

            <label className="field">
              <span>
                Company Email *
              </span>

              <input
                type="email"
                name="email"
                required
                value={
                  form.email ||
                  ""
                }
                onChange={
                  change
                }
              />
            </label>

            <label className="field">
              <span>
                Phone
              </span>

              <input
                name="phone"
                value={
                  form.phone ||
                  ""
                }
                onChange={
                  change
                }
              />
            </label>

            <label className="field">
              <span>
                Currency
              </span>

              <input
                name="currency"
                value={
                  form.currency ||
                  ""
                }
                onChange={
                  change
                }
              />
            </label>

            <label className="field span-two">
              <span>
                Address
              </span>

              <textarea
                name="address"
                rows="3"
                value={
                  form.address ||
                  ""
                }
                onChange={
                  change
                }
              />
            </label>
          </div>
        </Card>

        {/* =========================================================== */}
        {/* ATTENDANCE */}
        {/* =========================================================== */}

        <Card>
          <div className="card-head">
            <div>
              <h2>
                Attendance Defaults
              </h2>

              <p>
                General attendance
                defaults used by the
                workspace.
              </p>
            </div>
          </div>

          <div className="form-grid three">
            <label className="field">
              <span>
                Work Starts
              </span>

              <input
                type="time"
                name="workStartTime"
                value={
                  form.workStartTime ||
                  "09:00"
                }
                onChange={
                  change
                }
              />
            </label>

            <label className="field">
              <span>
                Work Ends
              </span>

              <input
                type="time"
                name="workEndTime"
                value={
                  form.workEndTime ||
                  "18:00"
                }
                onChange={
                  change
                }
              />
            </label>

            <label className="field">
              <span>
                Grace Period
              </span>

              <input
                type="number"
                min="0"
                name="graceMinutes"
                value={
                  form.graceMinutes ??
                  15
                }
                onChange={
                  change
                }
              />

              <small>
                Minutes
              </small>
            </label>

            <label className="field">
              <span>
                Timezone
              </span>

              <input
                name="timezone"
                value={
                  form.timezone ||
                  "Asia/Karachi"
                }
                onChange={
                  change
                }
              />
            </label>
          </div>
        </Card>

        {/* =========================================================== */}
        {/* EMAIL */}
        {/* =========================================================== */}

        <Card>
          <div className="card-head">
            <div>
              <h2>
                Email Notifications
              </h2>

              <p>
                Send HRMS updates to
                employee and HR email
                addresses.
              </p>
            </div>

            <button
              type="button"
              className="button secondary"
              disabled={
                testingEmail
              }
              onClick={
                testEmail
              }
            >
              {testingEmail
                ? "Sending..."
                : "Send Test Email"}
            </button>
          </div>

          <label className="switch-row">
            <input
              type="checkbox"
              checked={
                Boolean(
                  form
                    .emailNotifications
                    .enabled
                )
              }
              onChange={() =>
                toggleEmail(
                  "enabled"
                )
              }
            />

            <span>
              <strong>
                Enable Email Notifications
              </strong>

              <small>
                In-app notifications will
                continue working even if
                email notifications are
                disabled.
              </small>
            </span>
          </label>

          {form
            .emailNotifications
            .enabled && (
            <>
              <div className="section-label">
                Send Email For
              </div>

              {[
                [
                  "leave",
                  "Leave Management",
                  "Requests, approvals, rejections and cancellations.",
                ],

                [
                  "shift",
                  "Shift Changes",
                  "Assignments, requests and approval decisions.",
                ],

                [
                  "attendance",
                  "Attendance",
                  "Attendance-related alerts and exceptions.",
                ],

                [
                  "lifecycle",
                  "Employee Changes",
                  "Department, designation, manager and employment updates.",
                ],

                [
                  "system",
                  "System Notifications",
                  "Account and general HRMS updates.",
                ],

                [
                  "payroll",
                  "Payroll & Payslips",
                  "Payroll finalization and payslip emails when Payroll is finalized.",
                ],
              ].map(
                ([
                  key,
                  title,
                  description,
                ]) => (
                  <label
                    key={
                      key
                    }
                    className="switch-row"
                  >
                    <input
                      type="checkbox"
                      checked={
                        Boolean(
                          form
                            .emailNotifications[
                              key
                            ]
                        )
                      }
                      onChange={() =>
                        toggleEmail(
                          key
                        )
                      }
                    />

                    <span>
                      <strong>
                        {title}
                      </strong>

                      <small>
                        {description}
                      </small>
                    </span>
                  </label>
                )
              )}
            </>
          )}
        </Card>

        <div className="save-bar">
          <button className="button primary">
            Save Company Settings
          </button>
        </div>
      </form>
    </>
  );
}