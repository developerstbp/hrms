import Company from "../models/Company.js";
import Holiday from "../models/Holiday.js";

import {
  notifyCompanyUsers,
} from "../utils/notifications.js";

import {
  buildWorkCalendar,
  getActiveWorkPolicy,
} from "../utils/workCalendar.js";

import {
  writeAudit,
} from "../utils/audit.js";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const dateKey = (
  value
) => {
  if (!value) {
    return "";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date
    .toISOString()
    .slice(
      0,
      10
    );
};

const calendarRangeLabel =
  (
    record
  ) => {
    const start =
      dateKey(
        record.date
      );

    const end =
      record.endDate
        ? dateKey(
            record.endDate
          )
        : "";

    if (
      end &&
      end !== start
    ) {
      return `${start} to ${end}`;
    }

    return start;
  };

const monthBounds = (
  month
) => {
  if (
    !/^\d{4}-\d{2}$/.test(
      String(
        month ||
          ""
      )
    )
  ) {
    return null;
  }

  const [
    year,
    monthNumber,
  ] = month
    .split("-")
    .map(Number);

  if (
    monthNumber <
      1 ||
    monthNumber >
      12
  ) {
    return null;
  }

  const start =
    new Date(
      year,
      monthNumber -
        1,
      1,
      0,
      0,
      0,
      0
    );

  const end =
    new Date(
      year,
      monthNumber,
      0,
      23,
      59,
      59,
      999
    );

  return {
    start,
    end,
  };
};

const normalizeWeekdayModes = (
  value = {}
) => ({
  monday:
    value.monday ||
    "office",

  tuesday:
    value.tuesday ||
    "office",

  wednesday:
    value.wednesday ||
    "office",

  thursday:
    value.thursday ||
    "office",

  friday:
    value.friday ||
    "office",

  saturday:
    value.saturday ||
    "off",

  sunday:
    value.sunday ||
    "off",
});

const normalizeSaturdayPolicy = (
  value = {}
) => ({
  pattern:
    value.pattern ||
    "standard",

  firstSaturdayWorking:
    value.firstSaturdayWorking !==
    false,

  workingMode:
    value.workingMode ||
    "wfh",
});

const getCalendarOverrides =
  async (
    companyId,
    start,
    end
  ) =>
    Holiday.find({
      companyId,

      date: {
        $lte:
          end,
      },

      $or: [
        {
          endDate: {
            $gte:
              start,
          },
        },

        {
          endDate:
            null,
        },
      ],
    })
      .sort({
        date: 1,
        createdAt:
          1,
      })
      .lean();

/*
|--------------------------------------------------------------------------
| Get Holiday / Special Day Records
|--------------------------------------------------------------------------
*/

export const getHolidays =
  async (
    req,
    res
  ) => {
    try {
      const query = {
        companyId:
          req.user.companyId,
      };

      if (
        req.query.year
      ) {
        const year =
          Number(
            req.query.year
          );

        if (
          !Number.isInteger(
            year
          )
        ) {
          return res
            .status(
              400
            )
            .json({
              message:
                "Invalid year.",
            });
        }

        const start =
          new Date(
            year,
            0,
            1,
            0,
            0,
            0,
            0
          );

        const end =
          new Date(
            year,
            11,
            31,
            23,
            59,
            59,
            999
          );

        query.date = {
          $lte:
            end,
        };

        query.$or = [
          {
            endDate: {
              $gte:
                start,
            },
          },

          {
            endDate:
              null,
          },
        ];
      }

      const records =
        await Holiday.find(
          query
        ).sort({
          date: 1,
          createdAt:
            1,
        });

      res.json(
        records
      );
    } catch (error) {
      console.error(
        "getHolidays:",
        error
      );

      res
        .status(
          500
        )
        .json({
          message:
            "Unable to load calendar dates.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Monthly Work Calendar
|--------------------------------------------------------------------------
|
| GET /api/holidays/calendar?month=2026-09
|
|--------------------------------------------------------------------------
*/

export const getWorkCalendar =
  async (
    req,
    res
  ) => {
    try {
      const month =
        req.query.month ||
        new Date()
          .toISOString()
          .slice(
            0,
            7
          );

      const bounds =
        monthBounds(
          month
        );

      if (
        !bounds
      ) {
        return res
          .status(
            400
          )
          .json({
            message:
              "Month must use YYYY-MM format.",
          });
      }

      const company =
        await Company.findById(
          req.user.companyId
        ).lean();

      if (
        !company
      ) {
        return res
          .status(
            404
          )
          .json({
            message:
              "Company not found.",
          });
      }

      const overrides =
        await getCalendarOverrides(
          req.user.companyId,
          bounds.start,
          bounds.end
        );

      const days =
        buildWorkCalendar(
          company,
          overrides,
          bounds.start,
          bounds.end
        ).map(
          (
            day
          ) => ({
            ...day,

            date:
              dateKey(
                day.date
              ),
          })
        );

      /*
      |--------------------------------------------------------------------------
      | Calendar Summary
      |--------------------------------------------------------------------------
      */

      const summary = {
        office:
          0,

        wfh:
          0,

        off:
          0,

        holidays:
          0,

        workingDays:
          0,
      };

      days.forEach(
        (
          day
        ) => {
          if (
            day.dayType ===
              "holiday" ||
            day.dayType ===
              "optional_holiday"
          ) {
            summary.holidays +=
              1;

            summary.off +=
              1;

            return;
          }

          if (
            !day.isWorkingDay
          ) {
            summary.off +=
              1;

            return;
          }

          summary.workingDays +=
            1;

          if (
            day.workMode ===
            "wfh"
          ) {
            summary.wfh +=
              1;
          } else {
            summary.office +=
              1;
          }
        }
      );

      const activePolicy =
        getActiveWorkPolicy(
          company,
          new Date()
        );

      res.json({
        month,

        days,

        overrides,

        summary,

        activePolicy,
      });
    } catch (error) {
      console.error(
        "getWorkCalendar:",
        error
      );

      res
        .status(
          500
        )
        .json({
          message:
            "Unable to load work calendar.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Create Calendar Date
|--------------------------------------------------------------------------
|
| Used when user clicks a normal calendar date and chooses:
|
| Office
| WFH
| Off
| Public Holiday
| Company Holiday
| Optional Holiday
|
|--------------------------------------------------------------------------
*/

export const createHoliday =
  async (
    req,
    res
  ) => {
    try {
      const {
        name,
        date,
        endDate =
          null,
        type =
          "public",
        workMode =
          "",
        description =
          "",
      } =
        req.body;

      if (
        !date
      ) {
        return res
          .status(
            400
          )
          .json({
            message:
              "Select a date.",
          });
      }

      const allowedTypes =
        [
          "public",
          "company",
          "optional",
          "off",
          "wfh",
          "working",
        ];

      if (
        !allowedTypes.includes(
          type
        )
      ) {
        return res
          .status(
            400
          )
          .json({
            message:
              "Invalid day type.",
          });
      }

      /*
      | Friendly automatic names.
      |
      | User does not need to enter a name
      | for Office / WFH / Off.
      */

      let resolvedName =
        String(
          name ||
            ""
        ).trim();

      if (
        !resolvedName
      ) {
        if (
          type ===
          "wfh"
        ) {
          resolvedName =
            "Work From Home";
        } else if (
          type ===
          "off"
        ) {
          resolvedName =
            "Day Off";
        } else if (
          type ===
          "working"
        ) {
          resolvedName =
            workMode ===
            "wfh"
              ? "Work From Home"
              : "Office";
        } else {
          return res
            .status(
              400
            )
            .json({
              message:
                "Enter the holiday name.",
            });
        }
      }

      const record =
        await Holiday.create({
          companyId:
            req.user.companyId,

          name:
            resolvedName,

          date,

          endDate:
            endDate ||
            null,

          type,

          workMode:
            type ===
            "working"
              ? workMode ||
                "office"
              : "",

          description,

          createdByUserId:
            req.user._id,
        });

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "work_calendar.day_created",

        entity:
          "Holiday",

        entityId:
          record._id,

        description:
          `${record.name} was set for ${dateKey(
            record.date
          )}.`,
      });

      await notifyCompanyUsers({
        companyId:
          req.user.companyId,

        type:
          "system",

        title:
          "Work Calendar updated",

        message:
          `${record.name} has been added to the Work Calendar for ${calendarRangeLabel(record)}.`,

        link:
          "/holidays",

        metadata: {
          calendarRecordId:
            record._id,

          action:
            "created",
        },
      });

      res
        .status(
          201
        )
        .json(
          record
        );
    } catch (error) {
      console.error(
        "createHoliday:",
        error
      );

      res
        .status(
          500
        )
        .json({
          message:
            error.message ||
            "Unable to save calendar date.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Update Calendar Date
|--------------------------------------------------------------------------
*/

export const updateHoliday =
  async (
    req,
    res
  ) => {
    try {
      const record =
        await Holiday.findOne({
          _id:
            req.params.id,

          companyId:
            req.user.companyId,
        });

      if (
        !record
      ) {
        return res
          .status(
            404
          )
          .json({
            message:
              "Calendar record not found.",
          });
      }

      const {
        name,
        date,
        endDate,
        type,
        workMode,
        description,
      } =
        req.body;

      if (
        date !==
        undefined
      ) {
        record.date =
          date;
      }

      if (
        endDate !==
        undefined
      ) {
        record.endDate =
          endDate ||
          null;
      }

      if (
        type !==
        undefined
      ) {
        record.type =
          type;
      }

      if (
        description !==
        undefined
      ) {
        record.description =
          description;
      }

      if (
        name !==
        undefined
      ) {
        record.name =
          name;
      }

      /*
      |--------------------------------------------------------------------------
      | Auto Naming
      |--------------------------------------------------------------------------
      */

      if (
        record.type ===
          "wfh" &&
        !record.name?.trim()
      ) {
        record.name =
          "Work From Home";
      }

      if (
        record.type ===
          "off" &&
        !record.name?.trim()
      ) {
        record.name =
          "Day Off";
      }

      if (
        record.type ===
        "working"
      ) {
        record.workMode =
          workMode ||
          record.workMode ||
          "office";

        if (
          !record.name?.trim()
        ) {
          record.name =
            record.workMode ===
            "wfh"
              ? "Work From Home"
              : "Office";
        }
      } else {
        record.workMode =
          "";
      }

      await record.save();

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "work_calendar.day_updated",

        entity:
          "Holiday",

        entityId:
          record._id,

        description:
          `${record.name} was updated for ${dateKey(
            record.date
          )}.`,
      });

      await notifyCompanyUsers({
        companyId:
          req.user.companyId,

        type:
          "system",

        title:
          "Work Calendar updated",

        message:
          `${record.name} has been updated for ${calendarRangeLabel(record)}.`,

        link:
          "/holidays",

        metadata: {
          calendarRecordId:
            record._id,

          action:
            "updated",
        },
      });

      res.json(
        record
      );
    } catch (error) {
      console.error(
        "updateHoliday:",
        error
      );

      res
        .status(
          500
        )
        .json({
          message:
            error.message ||
            "Unable to update calendar date.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Reset Calendar Date
|--------------------------------------------------------------------------
|
| Removing this record means:
|
| "Go back to the normal weekly schedule."
|
|--------------------------------------------------------------------------
*/

export const deleteHoliday =
  async (
    req,
    res
  ) => {
    try {
      const record =
        await Holiday.findOneAndDelete({
          _id:
            req.params.id,

          companyId:
            req.user.companyId,
        });

      if (
        !record
      ) {
        return res
          .status(
            404
          )
          .json({
            message:
              "Calendar record not found.",
          });
      }

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "work_calendar.day_reset",

        entity:
          "Holiday",

        entityId:
          record._id,

        description:
          `${dateKey(
            record.date
          )} was reset to the normal work schedule.`,
      });

      await notifyCompanyUsers({
        companyId:
          req.user.companyId,

        type:
          "system",

        title:
          "Work Calendar updated",

        message:
          `${calendarRangeLabel(record)} has been reset to the normal work schedule.`,

        link:
          "/holidays",

        metadata: {
          calendarRecordId:
            record._id,

          action:
            "reset",
        },
      });

      res.json({
        message:
          "Date reset to normal work schedule.",
      });
    } catch (error) {
      console.error(
        "deleteHoliday:",
        error
      );

      res
        .status(
          500
        )
        .json({
          message:
            "Unable to reset calendar date.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Get Work Schedule Policies
|--------------------------------------------------------------------------
*/

export const getWorkCalendarPolicies =
  async (
    req,
    res
  ) => {
    try {
      const company =
        await Company.findById(
          req.user.companyId
        ).lean();

      if (
        !company
      ) {
        return res
          .status(
            404
          )
          .json({
            message:
              "Company not found.",
          });
      }

      const policies = [
        ...(
          company.workCalendarPolicies ||
          []
        ),
      ].sort(
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

      const activePolicy =
        getActiveWorkPolicy(
          company,
          new Date()
        );

      res.json({
        activePolicy,
        policies,
      });
    } catch (error) {
      console.error(
        "getWorkCalendarPolicies:",
        error
      );

      res
        .status(
          500
        )
        .json({
          message:
            "Unable to load work schedule.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Save New Work Schedule
|--------------------------------------------------------------------------
|
| We intentionally ADD a new policy instead of overwriting old one.
|
| This keeps history correct for attendance/payroll.
|
|--------------------------------------------------------------------------
*/

export const createWorkCalendarPolicy =
  async (
    req,
    res
  ) => {
    try {
      const {
        name =
          "Work Schedule",

        effectiveFrom,

        weekdayModes =
          {},

        saturdayPolicy =
          {},

        notes =
          "",
      } =
        req.body;

      if (
        !effectiveFrom
      ) {
        return res
          .status(
            400
          )
          .json({
            message:
              "Select when this work schedule should start.",
          });
      }

      const company =
        await Company.findById(
          req.user.companyId
        );

      if (
        !company
      ) {
        return res
          .status(
            404
          )
          .json({
            message:
              "Company not found.",
          });
      }

      const normalizedWeekdays =
        normalizeWeekdayModes(
          weekdayModes
        );

      const normalizedSaturday =
        normalizeSaturdayPolicy(
          saturdayPolicy
        );

      const allowedSaturdayPatterns = [
        "standard",
        "alternate",
        "all_working",
        "all_off",
      ];

      if (
        !allowedSaturdayPatterns.includes(
          normalizedSaturday.pattern
        )
      ) {
        return res
          .status(400)
          .json({
            message:
              "Invalid Saturday schedule.",
          });
      }

      if (
        ![
          "office",
          "wfh",
        ].includes(
          normalizedSaturday.workingMode
        )
      ) {
        return res
          .status(400)
          .json({
            message:
              "Working Saturday must be Office or WFH.",
          });
      }

      /*
      |--------------------------------------------------------------------------
      | Friendly validation
      |--------------------------------------------------------------------------
      */

      const allowedModes =
        [
          "office",
          "wfh",
          "off",
        ];

      for (
        const mode of Object.values(
          normalizedWeekdays
        )
      ) {
        if (
          !allowedModes.includes(
            mode
          )
        ) {
          return res
            .status(
              400
            )
            .json({
              message:
                "Each weekday must be Office, WFH or Off.",
            });
        }
      }

      company.workCalendarPolicies.push({
        name:
          name.trim() ||
          "Work Schedule",

        effectiveFrom,

        weekdayModes:
          normalizedWeekdays,

        saturdayPolicy:
          normalizedSaturday,

        notes,

        createdByUserId:
          req.user._id,
      });

      await company.save();

      const policy =
        company.workCalendarPolicies[
          company
            .workCalendarPolicies
            .length -
            1
        ];

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "work_calendar.schedule_created",

        entity:
          "Company",

        entityId:
          company._id,

        description:
          `Work schedule "${policy.name}" was created.`,
      });

      await notifyCompanyUsers({
        companyId:
          req.user.companyId,

        type:
          "system",

        title:
          "New work schedule",

        message:
          `${policy.name} will apply from ${dateKey(policy.effectiveFrom)}.`,

        link:
          "/holidays",

        metadata: {
          policyId:
            policy._id,

          action:
            "policy-created",
        },
      });

      res
        .status(
          201
        )
        .json(
          policy
        );
    } catch (error) {
      console.error(
        "createWorkCalendarPolicy:",
        error
      );

      res
        .status(
          500
        )
        .json({
          message:
            error.message ||
            "Unable to save work schedule.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Delete Future / Incorrect Policy
|--------------------------------------------------------------------------
|
| This is mainly useful if HR accidentally creates a future policy.
|
|--------------------------------------------------------------------------
*/

export const deleteWorkCalendarPolicy =
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
          .status(
            404
          )
          .json({
            message:
              "Company not found.",
          });
      }

      const policy =
        company.workCalendarPolicies.id(
          req.params.id
        );

      if (
        !policy
      ) {
        return res
          .status(
            404
          )
          .json({
            message:
              "Work schedule not found.",
          });
      }

      const policyName =
        policy.name;

      const policyStart =
        new Date(
          policy.effectiveFrom
        );

      policyStart.setHours(
        0,
        0,
        0,
        0
      );

      const todayStart =
        new Date();

      todayStart.setHours(
        0,
        0,
        0,
        0
      );

      /*
      |--------------------------------------------------------------------------
      | Current / historical policy cannot be deleted.
      |--------------------------------------------------------------------------
      |
      | If HR needs to correct a current schedule,
      | create a new policy with the same effective date.
      | Latest policy wins.
      |
      */

      if (
        policyStart <=
        todayStart
      ) {
        return res
          .status(400)
          .json({
            message:
              "Current or historical work schedules cannot be removed. Create a new corrected schedule instead.",
          });
      }

      const policyDate =
        dateKey(
          policy.effectiveFrom
        );

      policy.deleteOne();

      await company.save();

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "work_calendar.schedule_deleted",

        entity:
          "Company",

        entityId:
          company._id,

        description:
          `Work schedule "${policyName}" was removed.`,
      });

      await notifyCompanyUsers({
        companyId:
          req.user.companyId,

        type:
          "system",

        title:
          "Scheduled work policy removed",

        message:
          `${policyName}, scheduled for ${policyDate}, has been removed.`,

        link:
          "/holidays",

        metadata: {
          action:
            "policy-removed",
        },
      });

      res.json({
        message:
          "Work schedule removed.",
      });
    } catch (error) {
      console.error(
        "deleteWorkCalendarPolicy:",
        error
      );

      res
        .status(
          500
        )
        .json({
          message:
            "Unable to remove work schedule.",
        });
    }
  };