import nodemailer from "nodemailer";

import Company from "../models/Company.js";
import User from "../models/User.js";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const smtpConfigured = () =>
  Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );

let transporter = null;

const getTransporter = () => {
  if (!smtpConfigured()) {
    return null;
  }

  if (!transporter) {
    const port =
      Number(
        process.env.SMTP_PORT ||
        587
      );

    const secure =
      String(
        process.env.SMTP_SECURE ||
        ""
      ).toLowerCase() ===
        "true" ||
      port === 465;

    transporter =
      nodemailer.createTransport({
        host:
          process.env.SMTP_HOST,

        port,

        secure,

        auth: {
          user:
            process.env.SMTP_USER,

          pass:
            process.env.SMTP_PASS,
        },
      });
  }

  return transporter;
};

const escapeHtml = (
  value = ""
) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const appLink = (
  link = ""
) => {
  if (!link) {
    return "";
  }

  if (
    /^https?:\/\//i.test(
      link
    )
  ) {
    return link;
  }

  const base =
    (
      process.env.APP_URL ||
      "http://localhost:5173"
    ).replace(
      /\/$/,
      ""
    );

  return `${base}${
    link.startsWith("/")
      ? link
      : `/${link}`
  }`;
};

const preferenceEnabled = (
  settings,
  type
) => {
  if (
    !settings?.enabled
  ) {
    return false;
  }

  const map = {
    leave:
      "leave",

    shift:
      "shift",

    attendance:
      "attendance",

    lifecycle:
      "lifecycle",

    system:
      "system",
  };

  const key =
    map[type] ||
    "system";

  return (
    settings[key] !==
    false
  );
};

/*
|--------------------------------------------------------------------------
| Raw Email
|--------------------------------------------------------------------------
*/

export const sendRawEmail =
  async ({
    to,
    subject,
    text,
    html,
    companyName = "HRMS",
  }) => {
    try {
      const mailer =
        getTransporter();

      if (!mailer) {
        console.warn(
          "Email skipped: SMTP is not configured."
        );

        return {
          sent: false,
          reason:
            "smtp_not_configured",
        };
      }

      if (!to) {
        return {
          sent: false,
          reason:
            "missing_recipient",
        };
      }

      await mailer.sendMail({
        from: {
          name:
            process.env
              .MAIL_FROM_NAME ||
            companyName ||
            "HRMS",

          address:
            process.env
              .MAIL_FROM_EMAIL ||
            process.env
              .SMTP_USER,
        },

        to,

        subject,

        text,

        html,
      });

      return {
        sent: true,
      };
    } catch (error) {
      /*
      |--------------------------------------------------------------------------
      | IMPORTANT
      |--------------------------------------------------------------------------
      | Email failure must NEVER break leave / shift / payroll / HR actions.
      */

      console.error(
        "Email delivery failed:",
        error.message
      );

      return {
        sent: false,
        reason:
          "delivery_failed",
      };
    }
  };

/*
|--------------------------------------------------------------------------
| Notification Email
|--------------------------------------------------------------------------
*/

export const sendNotificationEmail =
  async ({
    companyId,
    userId,
    type = "system",
    title,
    message,
    link = "",
  }) => {
    try {
      const [
        company,
        user,
      ] =
        await Promise.all([
          Company.findById(
            companyId
          ).select(
            "name emailNotifications"
          ),

          User.findOne({
            _id:
              userId,

            companyId,

            isActive:
              true,
          }).select(
            "firstName lastName email"
          ),
        ]);

      if (
        !company ||
        !user?.email
      ) {
        return {
          sent: false,
          reason:
            "recipient_not_found",
        };
      }

      if (
        !preferenceEnabled(
          company.emailNotifications,
          type
        )
      ) {
        return {
          sent: false,
          reason:
            "email_disabled",
        };
      }

      const fullLink =
        appLink(
          link
        );

      const safeCompany =
        escapeHtml(
          company.name ||
          "HRMS"
        );

      const safeName =
        escapeHtml(
          user.firstName ||
          "there"
        );

      const safeTitle =
        escapeHtml(
          title
        );

      const safeMessage =
        escapeHtml(
          message
        );

      const html = `
        <!doctype html>
        <html>
          <body style="
            margin:0;
            padding:0;
            background:#f6f4fb;
            font-family:Arial,Helvetica,sans-serif;
            color:#1f2937;
          ">
            <div style="
              max-width:600px;
              margin:0 auto;
              padding:32px 18px;
            ">
              <div style="
                background:#ffffff;
                border-radius:16px;
                padding:30px;
                border:1px solid #ece9f3;
              ">
                <div style="
                  font-size:13px;
                  font-weight:700;
                  color:#7c3aed;
                  margin-bottom:20px;
                ">
                  ${safeCompany} · HRMS
                </div>

                <p style="
                  margin:0 0 10px;
                  color:#6b7280;
                ">
                  Hi ${safeName},
                </p>

                <h2 style="
                  margin:0 0 12px;
                  font-size:22px;
                  color:#111827;
                ">
                  ${safeTitle}
                </h2>

                <p style="
                  margin:0;
                  font-size:15px;
                  line-height:1.6;
                  color:#4b5563;
                ">
                  ${safeMessage}
                </p>

                ${
                  fullLink
                    ? `
                      <div style="margin-top:24px;">
                        <a
                          href="${escapeHtml(
                            fullLink
                          )}"
                          style="
                            display:inline-block;
                            background:#7c3aed;
                            color:#ffffff;
                            text-decoration:none;
                            padding:11px 18px;
                            border-radius:8px;
                            font-size:14px;
                            font-weight:700;
                          "
                        >
                          Open HRMS
                        </a>
                      </div>
                    `
                    : ""
                }

                <div style="
                  margin-top:30px;
                  padding-top:18px;
                  border-top:1px solid #eeeeee;
                  font-size:12px;
                  line-height:1.5;
                  color:#9ca3af;
                ">
                  This is an automated HRMS notification.
                  Please do not share confidential HR information
                  outside your organization.
                </div>
              </div>
            </div>
          </body>
        </html>
      `;

      return sendRawEmail({
        to:
          user.email,

        subject:
          `${company.name || "HRMS"} — ${title}`,

        text:
          `Hi ${user.firstName || ""},

${title}

${message}

${fullLink || ""}`,

        html,

        companyName:
          company.name,
      });
    } catch (error) {
      console.error(
        "Notification email error:",
        error.message
      );

      return {
        sent: false,
        reason:
          "email_error",
      };
    }
  };

/*
|--------------------------------------------------------------------------
| Test Email
|--------------------------------------------------------------------------
*/

export const sendTestEmail =
  async ({
    companyId,
    userId,
  }) => {
    const [
      company,
      user,
    ] =
      await Promise.all([
        Company.findById(
          companyId
        ).select(
          "name"
        ),

        User.findOne({
          _id:
            userId,

          companyId,
        }).select(
          "email firstName"
        ),
      ]);

    if (
      !company ||
      !user?.email
    ) {
      return {
        sent: false,
        reason:
          "recipient_not_found",
      };
    }

    return sendRawEmail({
      to:
        user.email,

      subject:
        `${company.name} — HRMS Test Email`,

      companyName:
        company.name,

      text:
        "Your HRMS email configuration is working successfully.",

      html: `
        <div style="
          font-family:Arial,sans-serif;
          max-width:600px;
          margin:auto;
          padding:30px;
        ">
          <h2>Email setup is working ✓</h2>

          <p>
            Hi ${escapeHtml(
              user.firstName ||
              "there"
            )},
          </p>

          <p>
            Your HRMS SMTP configuration is working successfully.
          </p>

          <p style="color:#6b7280;font-size:13px;">
            ${escapeHtml(
              company.name
            )} HRMS
          </p>
        </div>
      `,
    });
  };