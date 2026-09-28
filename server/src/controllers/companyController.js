import Company from "../models/Company.js";
import User from "../models/User.js";

import {
  writeAudit,
} from "../utils/audit.js";

import {
  sendTestEmail,
} from "../utils/mailer.js";

/*
|--------------------------------------------------------------------------
| Get Company
|--------------------------------------------------------------------------
*/

export const getCompany =
  async (
    req,
    res
  ) => {
    const company =
      await Company.findById(
        req.user.companyId
      );

    if (
      !company
    ) {
      return res
        .status(404)
        .json({
          message:
            "Company not found.",
        });
    }

    res.json(
      company
    );
  };

/*
|--------------------------------------------------------------------------
| Update Company
|--------------------------------------------------------------------------
*/

export const updateCompany =
  async (
    req,
    res
  ) => {
    try {
      const company =
        await Company.findById(
          req.user.companyId
        );

      if (
        !company
      ) {
        return res
          .status(404)
          .json({
            message:
              "Company not found.",
          });
      }

      const allowed = [
        "name",
        "email",
        "phone",
        "address",
        "timezone",
        "currency",
        "workStartTime",
        "workEndTime",
        "graceMinutes",
      ];

      for (
        const key of allowed
      ) {
        if (
          Object.prototype.hasOwnProperty.call(
            req.body,
            key
          )
        ) {
          company[key] =
            req.body[key];
        }
      }

      /*
      |--------------------------------------------------------------------------
      | Email Notification Preferences
      |--------------------------------------------------------------------------
      */

      if (
        req.body.emailNotifications &&
        typeof req.body.emailNotifications ===
          "object"
      ) {
        const incoming =
          req.body.emailNotifications;

        const current = {
          enabled:
            company
              .emailNotifications
              ?.enabled ??
            false,

          leave:
            company
              .emailNotifications
              ?.leave ??
            true,

          shift:
            company
              .emailNotifications
              ?.shift ??
            true,

          attendance:
            company
              .emailNotifications
              ?.attendance ??
            true,

          lifecycle:
            company
              .emailNotifications
              ?.lifecycle ??
            true,

          system:
            company
              .emailNotifications
              ?.system ??
            true,

          payroll:
            company
              .emailNotifications
              ?.payroll ??
            true,
        };

        const keys = [
          "enabled",
          "leave",
          "shift",
          "attendance",
          "lifecycle",
          "system",
          "payroll",
        ];

        keys.forEach(
          (
            key
          ) => {
            if (
              typeof incoming[
                key
              ] ===
              "boolean"
            ) {
              current[key] =
                incoming[
                  key
                ];
            }
          }
        );

        company.emailNotifications =
          current;
      }

      await company.save();

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "company.updated",

        entity:
          "Company",

        entityId:
          company._id,

        description:
          "Company settings were updated.",
      });

      res.json(
        company
      );
    } catch (error) {
      console.error(
        "updateCompany:",
        error
      );

      res
        .status(500)
        .json({
          message:
            "Unable to update company settings.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Test Email
|--------------------------------------------------------------------------
*/

export const testCompanyEmail =
  async (
    req,
    res
  ) => {
    try {
      const user =
        await User.findOne({
          _id:
            req.user._id,

          companyId:
            req.user.companyId,
        }).select(
          "email"
        );

      if (
        !user?.email
      ) {
        return res
          .status(400)
          .json({
            message:
              "Your account does not have an email address.",
          });
      }

      const result =
        await sendTestEmail({
          companyId:
            req.user.companyId,

          userId:
            req.user._id,
        });

      if (
        !result.sent
      ) {
        return res
          .status(400)
          .json({
            message:
              result.reason ===
              "smtp_not_configured"
                ? "SMTP is not configured on the server."
                : "Test email could not be sent. Check SMTP settings in the server terminal.",
          });
      }

      res.json({
        message:
          `Test email sent successfully to ${user.email}.`,
      });
    } catch (error) {
      console.error(
        "testCompanyEmail:",
        error
      );

      res
        .status(500)
        .json({
          message:
            "Unable to send test email.",
        });
    }
  };