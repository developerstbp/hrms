import Attendance from "../models/Attendance.js";
import AttendancePunch from "../models/AttendancePunch.js";
import AttendanceImportBatch from "../models/AttendanceImportBatch.js";
import Employee from "../models/Employees.js";
import Company from "../models/Company.js";
import Holiday from "../models/Holiday.js";
import LeaveRequest from "../models/LeaveRequest.js";

import {
  getEmployeeForUser,
  getScopedEmployeeIds,
  canActForEmployee,
} from "../utils/scope.js";

import {
  toDateKey,
} from "../utils/date.js";

import {
  writeAudit,
} from "../utils/audit.js";

import {
  getShiftAssignmentForDate,
  timeToMinutes,
  workedMinutes,
} from "../utils/shifts.js";

import {
  resolveCalendarDay,
} from "../utils/workCalendar.js";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const populateAttendance = (
  query
) =>
  query.populate({
    path:
      "employeeId",

    select:
      "firstName lastName employeeCode designation departmentId",

    populate: {
      path:
        "departmentId",

      select:
        "name code",
    },
  });

const dateOnlyUTC = (
  value
) => {
  if (
    typeof value ===
      "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return new Date(
      `${value}T00:00:00.000Z`
    );
  }

  const date =
    new Date(
      value
    );

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )
  );
};

const endOfDayUTC = (
  value
) => {
  const date =
    dateOnlyUTC(
      value
    );

  date.setUTCHours(
    23,
    59,
    59,
    999
  );

  return date;
};

const addDaysUTC = (
  value,
  amount
) => {
  const date =
    dateOnlyUTC(
      value
    );

  date.setUTCDate(
    date.getUTCDate() +
      amount
  );

  return date;
};

const normalizeDateKey = (
  value
) => {
  if (
    !value
  ) {
    return "";
  }

  if (
    typeof value ===
      "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      value.trim()
    )
  ) {
    return value.trim();
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

const normalizeTime = (
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
    return `${String(
      value.getHours()
    ).padStart(
      2,
      "0"
    )}:${String(
      value.getMinutes()
    ).padStart(
      2,
      "0"
    )}`;
  }

  const raw =
    String(
      value
    ).trim();

  const match =
    raw.match(
      /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i
    );

  if (
    !match
  ) {
    return "";
  }

  let hours =
    Number(
      match[1]
    );

  const minutes =
    Number(
      match[2]
    );

  const meridiem =
    match[3]?.toUpperCase();

  if (
    minutes >
    59
  ) {
    return "";
  }

  if (
    meridiem
  ) {
    if (
      hours <
        1 ||
      hours >
        12
    ) {
      return "";
    }

    if (
      meridiem ===
        "AM" &&
      hours ===
        12
    ) {
      hours =
        0;
    }

    if (
      meridiem ===
        "PM" &&
      hours !==
        12
    ) {
      hours +=
        12;
    }
  } else if (
    hours >
    23
  ) {
    return "";
  }

  return `${String(
    hours
  ).padStart(
    2,
    "0"
  )}:${String(
    minutes
  ).padStart(
    2,
    "0"
  )}`;
};

const punchDateTime = (
  dateKey,
  time
) =>
  new Date(
    `${dateKey}T${time}:00.000Z`
  );

const expectedMinutesForAssignment =
  (
    assignment,
    company
  ) => {
    const start =
      assignment
        ?.snapshot
        ?.startTime ||
      company
        ?.workStartTime ||
      "09:00";

    const end =
      assignment
        ?.snapshot
        ?.endTime ||
      company
        ?.workEndTime ||
      "18:00";

    const breakMinutes =
      Number(
        assignment
          ?.snapshot
          ?.breakMinutes ||
          0
      );

    const startMinutes =
      timeToMinutes(
        start
      );

    let endMinutes =
      timeToMinutes(
        end
      );

    if (
      endMinutes <=
      startMinutes
    ) {
      endMinutes +=
        24 * 60;
    }

    return Math.max(
      0,
      endMinutes -
        startMinutes -
        breakMinutes
    );
  };

const getOverrides =
  async (
    companyId,
    start,
    end
  ) =>
    Holiday.find({
      companyId,

      $or: [
        {
          endDate: {
            $gte:
              start,
          },

          date: {
            $lte:
              end,
          },
        },

        {
          endDate:
            null,

          date: {
            $gte:
              start,

            $lte:
              end,
          },
        },
      ],
    }).lean();

const leaveForDate = (
  leaves,
  employeeId,
  date
) => {
  const target =
    dateOnlyUTC(
      date
    );

  return leaves.find(
    (
      leave
    ) => {
      if (
        String(
          leave.employeeId
        ) !==
        String(
          employeeId
        )
      ) {
        return false;
      }

      const start =
        dateOnlyUTC(
          leave.startDate
        );

      const end =
        dateOnlyUTC(
          leave.endDate
        );

      return (
        target >=
          start &&
        target <=
          end
      );
    }
  );
};

/*
|--------------------------------------------------------------------------
| Build Final Attendance
|--------------------------------------------------------------------------
*/

const buildAttendanceResult =
  ({
    company,
    calendar,
    assignment,
    punches,
    leave,
  }) => {
    const scheduledStart =
      assignment
        ?.snapshot
        ?.startTime ||
      company
        ?.workStartTime ||
      "09:00";

    const scheduledEnd =
      assignment
        ?.snapshot
        ?.endTime ||
      company
        ?.workEndTime ||
      "18:00";

    const breakMinutes =
      Number(
        assignment
          ?.snapshot
          ?.breakMinutes ||
          0
      );

    const scheduledMinutes =
      calendar.isWorkingDay &&
      !leave
        ? expectedMinutesForAssignment(
            assignment,
            company
          )
        : 0;

    const ordered =
      [
        ...punches,
      ].sort(
        (
          a,
          b
        ) =>
          new Date(
            a.punchTime
          ) -
          new Date(
            b.punchTime
          )
      );

    const base = {
      checkIn:
        null,

      checkOut:
        null,

      workedMinutes:
        0,

      shiftAssignmentId:
        assignment?._id ||
        null,

      shiftName:
        assignment
          ?.snapshot
          ?.name ||
        "Company default",

      scheduledStart,

      scheduledEnd,

      scheduledMinutes,

      breakMinutes,

      workMode:
        calendar.workMode ||
        "",

      calendarLabel:
        calendar.label ||
        "",

      status:
        "absent",

      isException:
        false,

      exceptionType:
        "",

      exceptionReason:
        "",
    };

    /*
    |--------------------------------------------------------------------------
    | Full-Day Leave
    |--------------------------------------------------------------------------
    */

    if (
      leave &&
      !leave.halfDay
    ) {
      return {
        ...base,

        status:
          "on-leave",
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Off / Holiday
    |--------------------------------------------------------------------------
    */

    if (
      !calendar.isWorkingDay
    ) {
      const status =
        calendar.dayType ===
          "holiday" ||
        calendar.dayType ===
          "optional_holiday"
          ? "holiday"
          : "off";

      if (
        !ordered.length
      ) {
        return {
          ...base,
          status,
        };
      }
    }

    /*
    |--------------------------------------------------------------------------
    | No Punches
    |--------------------------------------------------------------------------
    */

    if (
      !ordered.length
    ) {
      return {
        ...base,

        status:
          leave?.halfDay
            ? "half-day"
            : "absent",
      };
    }

    /*
    |--------------------------------------------------------------------------
    | One Punch Only
    |--------------------------------------------------------------------------
    */

    if (
      ordered.length ===
      1
    ) {
      const only =
        ordered[0];

      const isOut =
        only.punchType ===
        "out";

      const value =
        new Date(
          only.punchTime
        )
          .toISOString()
          .slice(
            11,
            16
          );

      return {
        ...base,

        checkIn:
          isOut
            ? null
            : value,

        checkOut:
          isOut
            ? value
            : null,

        status:
          "incomplete",

        isException:
          true,

        exceptionType:
          isOut
            ? "missing-check-in"
            : "missing-check-out",

        exceptionReason:
          isOut
            ? "Check-in is missing."
            : "Check-out is missing.",
      };
    }

    /*
    |--------------------------------------------------------------------------
    | First Punch / Last Punch
    |--------------------------------------------------------------------------
    */

    const first =
      ordered[0];

    const last =
      ordered[
        ordered.length -
          1
      ];

    const checkIn =
      new Date(
        first.punchTime
      )
        .toISOString()
        .slice(
          11,
          16
        );

    const checkOut =
      new Date(
        last.punchTime
      )
        .toISOString()
        .slice(
          11,
          16
        );

    const grossMinutes =
      workedMinutes(
        checkIn,
        checkOut
      );

    /*
    | Break is deducted automatically.
    |
    | Example:
    | 10:00 - 18:30 = 510 mins
    | minus 30 min break = 480 mins = 8 hours
    */

    const minutes =
      Math.max(
        0,
        grossMinutes -
          breakMinutes
      );

    const graceMinutes =
      Number(
        assignment
          ?.snapshot
          ?.graceMinutes ??
          company
            ?.graceMinutes ??
          0
      );

    const late =
      timeToMinutes(
        checkIn
      ) >
      timeToMinutes(
        scheduledStart
      ) +
        graceMinutes;

    const short =
      scheduledMinutes >
        0 &&
      minutes <
        scheduledMinutes;

    let status =
      "present";

    if (
      leave?.halfDay
    ) {
      status =
        "half-day";
    } else if (
      scheduledMinutes >
        0 &&
      minutes <
        scheduledMinutes /
          2
    ) {
      status =
        "half-day";
    } else if (
      late
    ) {
      status =
        "late";
    }

    if (
      !calendar.isWorkingDay
    ) {
      status =
        calendar.dayType ===
          "holiday" ||
        calendar.dayType ===
          "optional_holiday"
          ? "holiday"
          : "off";
    }

    return {
      ...base,

      checkIn,

      checkOut,

      workedMinutes:
        minutes,

      status,

      isException:
        calendar.isWorkingDay &&
        !leave &&
        short,

      exceptionType:
        calendar.isWorkingDay &&
        !leave &&
        short
          ? "short-hours"
          : "",

      exceptionReason:
        calendar.isWorkingDay &&
        !leave &&
        short
          ? `Worked ${minutes} minutes against ${scheduledMinutes} scheduled minutes.`
          : "",
    };
  };

/*
|--------------------------------------------------------------------------
| Validate Excel Rows
|--------------------------------------------------------------------------
*/

const validateImportRows =
  async (
    companyId,
    rows = []
  ) => {
    const employeeCodes =
      [
        ...new Set(
          rows
            .map(
              (
                row
              ) =>
                String(
                  row.employeeCode ||
                    ""
                )
                  .trim()
                  .toUpperCase()
            )
            .filter(
              Boolean
            )
        ),
      ];

    const employees =
      await Employee.find({
        companyId,

        employeeCode: {
          $in:
            employeeCodes,
        },
      })
        .select(
          "_id employeeCode firstName lastName"
        )
        .lean();

    const employeeMap =
      new Map(
        employees.map(
          (
            employee
          ) => [
            employee.employeeCode.toUpperCase(),
            employee,
          ]
        )
      );

    const validRows =
      [];

    const validationErrors =
      [];

    rows.forEach(
      (
        row,
        index
      ) => {
        const rowNumber =
          Number(
            row.rowNumber ||
              row.__rowNumber ||
              index +
                2
          );

        const employeeCode =
          String(
            row.employeeCode ||
              ""
          )
            .trim()
            .toUpperCase();

        const date =
          normalizeDateKey(
            row.date
          );

        const checkIn =
          normalizeTime(
            row.checkIn
          );

        const checkOut =
          normalizeTime(
            row.checkOut
          );

        const punchTime =
          normalizeTime(
            row.punchTime
          );

        const punchType =
          [
            "in",
            "out",
            "unknown",
          ].includes(
            String(
              row.punchType ||
                ""
            ).toLowerCase()
          )
            ? String(
                row.punchType
              ).toLowerCase()
            : "unknown";

        const fail =
          (
            field,
            message
          ) =>
            validationErrors.push({
              rowNumber,
              employeeCode,
              date,
              field,
              message,
            });

        if (
          !employeeCode
        ) {
          return fail(
            "Employee Code",
            "Employee Code is required."
          );
        }

        const employee =
          employeeMap.get(
            employeeCode
          );

        if (
          !employee
        ) {
          return fail(
            "Employee Code",
            `Employee ${employeeCode} was not found.`
          );
        }

        if (
          !date
        ) {
          return fail(
            "Date",
            "Use a valid date such as 2026-09-24."
          );
        }

        if (
          !checkIn &&
          !checkOut &&
          !punchTime
        ) {
          return fail(
            "Time",
            "Add Check In / Check Out, or a Punch Time."
          );
        }

        if (
          row.checkIn &&
          !checkIn
        ) {
          return fail(
            "Check In",
            "Invalid check-in time."
          );
        }

        if (
          row.checkOut &&
          !checkOut
        ) {
          return fail(
            "Check Out",
            "Invalid check-out time."
          );
        }

        if (
          row.punchTime &&
          !punchTime
        ) {
          return fail(
            "Punch Time",
            "Invalid punch time."
          );
        }

        validRows.push({
          rowNumber,

          employee,

          employeeCode,

          date,

          checkIn,

          checkOut,

          punchTime,

          punchType,

          raw:
            row,
        });
      }
    );

    return {
      validRows,
      validationErrors,
    };
  };

/*
|--------------------------------------------------------------------------
| Get Attendance
|--------------------------------------------------------------------------
*/

export const getAttendance =
  async (
    req,
    res
  ) => {
    try {
      const scopedIds =
        await getScopedEmployeeIds(
          req.user,
          true
        );

      const query = {
        companyId:
          req.user.companyId,
      };

      if (
        scopedIds
      ) {
        query.employeeId =
          {
            $in:
              scopedIds,
          };
      }

      if (
        req.query.date
      ) {
        query.dateKey =
          req.query.date;
      }

      if (
        req.query.from ||
        req.query.to
      ) {
        query.date =
          {};

        if (
          req.query.from
        ) {
          query.date.$gte =
            dateOnlyUTC(
              req.query.from
            );
        }

        if (
          req.query.to
        ) {
          query.date.$lte =
            endOfDayUTC(
              req.query.to
            );
        }
      }

      if (
        req.query.status
      ) {
        query.status =
          req.query.status;
      }

      const records =
        await populateAttendance(
          Attendance.find(
            query
          )
        )
          .sort({
            date:
              -1,

            createdAt:
              -1,
          })
          .limit(
            2000
          );

      res.json(
        records
      );
    } catch (error) {
      console.error(
        "getAttendance:",
        error
      );

      res
        .status(
          500
        )
        .json({
          message:
            "Unable to load attendance.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Employee Today
|--------------------------------------------------------------------------
*/

export const getToday =
  async (
    req,
    res
  ) => {
    try {
      const employee =
        await getEmployeeForUser(
          req.user
        );

      if (
        !employee
      ) {
        return res
          .status(
            404
          )
          .json({
            message:
              "Employee profile is not linked to this account.",
          });
      }

      const record =
        await Attendance.findOne({
          companyId:
            req.user.companyId,

          employeeId:
            employee._id,

          dateKey:
            toDateKey(),
        });

      res.json(
        record
      );
    } catch (error) {
      res
        .status(
          500
        )
        .json({
          message:
            "Unable to load today's attendance.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Check In
|--------------------------------------------------------------------------
*/

export const checkIn =
  async (
    req,
    res
  ) => {
    try {
      const employee =
        await getEmployeeForUser(
          req.user
        );

      if (
        !employee
      ) {
        return res
          .status(
            404
          )
          .json({
            message:
              "Employee profile is not linked to this account.",
          });
      }

      const company =
        await Company.findById(
          req.user.companyId
        );

      const now =
        new Date();

      const dateKey =
        toDateKey(
          now
        );

      const existing =
        await Attendance.findOne({
          companyId:
            req.user.companyId,

          employeeId:
            employee._id,

          dateKey,
        });

      if (
        existing?.checkIn
      ) {
        return res
          .status(
            409
          )
          .json({
            message:
              "You have already checked in today.",
          });
      }

      const overrides =
        await getOverrides(
          req.user.companyId,
          dateOnlyUTC(
            now
          ),
          endOfDayUTC(
            now
          )
        );

      const calendar =
        resolveCalendarDay(
          company,
          overrides,
          now
        );

      if (
        !calendar.isWorkingDay
      ) {
        return res
          .status(
            400
          )
          .json({
            message:
              `Today is marked as ${calendar.label || "Off"}.`,
          });
      }

      const assignment =
        await getShiftAssignmentForDate(
          req.user.companyId,
          employee._id,
          now
        );

      const scheduledStart =
        assignment
          ?.snapshot
          ?.startTime ||
        company
          ?.workStartTime ||
        "09:00";

      const scheduledEnd =
        assignment
          ?.snapshot
          ?.endTime ||
        company
          ?.workEndTime ||
        "18:00";

      const scheduledMinutes =
        expectedMinutesForAssignment(
          assignment,
          company
        );

      const graceMinutes =
        Number(
          assignment
            ?.snapshot
            ?.graceMinutes ??
            company
              ?.graceMinutes ??
            0
        );

      const currentTime =
        now
          .toTimeString()
          .slice(
            0,
            5
          );

      const late =
        timeToMinutes(
          currentTime
        ) >
        timeToMinutes(
          scheduledStart
        ) +
          graceMinutes;

      const record =
        existing ||
        new Attendance({
          companyId:
            req.user.companyId,

          employeeId:
            employee._id,

          date:
            dateOnlyUTC(
              now
            ),

          dateKey,
        });

      record.checkIn =
        currentTime;

      record.source =
        "self";

      record.shiftAssignmentId =
        assignment?._id ||
        null;

      record.shiftName =
        assignment
          ?.snapshot
          ?.name ||
        "Company default";

      record.scheduledStart =
        scheduledStart;

      record.scheduledEnd =
        scheduledEnd;

      record.scheduledMinutes =
        scheduledMinutes;

      record.breakMinutes =
        Number(
          assignment
            ?.snapshot
            ?.breakMinutes ||
            0
        );

      record.workMode =
        calendar.workMode ||
        "";

      record.calendarLabel =
        calendar.label ||
        "";

      record.status =
        late
          ? "late"
          : "present";

      record.isException =
        false;

      record.exceptionType =
        "";

      record.exceptionReason =
        "";

      await record.save();

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "attendance.check_in",

        entity:
          "Attendance",

        entityId:
          record._id,

        description:
          "Employee checked in.",
      });

      res.json(
        record
      );
    } catch (error) {
      console.error(
        "checkIn:",
        error
      );

      res
        .status(
          500
        )
        .json({
          message:
            "Unable to check in.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Check Out
|--------------------------------------------------------------------------
*/

export const checkOut =
  async (
    req,
    res
  ) => {
    try {
      const employee =
        await getEmployeeForUser(
          req.user
        );

      if (
        !employee
      ) {
        return res
          .status(
            404
          )
          .json({
            message:
              "Employee profile is not linked to this account.",
          });
      }

      const record =
        await Attendance.findOne({
          companyId:
            req.user.companyId,

          employeeId:
            employee._id,

          dateKey:
            toDateKey(),
        });

      if (
        !record?.checkIn
      ) {
        return res
          .status(
            400
          )
          .json({
            message:
              "Please check in before checking out.",
          });
      }

      if (
        record.checkOut
      ) {
        return res
          .status(
            409
          )
          .json({
            message:
              "You have already checked out today.",
          });
      }

      record.checkOut =
        new Date()
          .toTimeString()
          .slice(
            0,
            5
          );

      record.workedMinutes =
        Math.max(
          0,

          workedMinutes(
            record.checkIn,
            record.checkOut
          ) -
            Number(
              record.breakMinutes ||
                0
            )
        );

      if (
        record.scheduledMinutes >
          0 &&
        record.workedMinutes <
          record.scheduledMinutes
      ) {
        record.isException =
          true;

        record.exceptionType =
          "short-hours";

        record.exceptionReason =
          `Worked ${record.workedMinutes} minutes against ${record.scheduledMinutes} scheduled minutes.`;

        if (
          record.workedMinutes <
          record.scheduledMinutes /
            2
        ) {
          record.status =
            "half-day";
        }
      }

      await record.save();

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "attendance.check_out",

        entity:
          "Attendance",

        entityId:
          record._id,

        description:
          "Employee checked out.",
      });

      res.json(
        record
      );
    } catch (error) {
      console.error(
        "checkOut:",
        error
      );

      res
        .status(
          500
        )
        .json({
          message:
            "Unable to check out.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Manual Attendance
|--------------------------------------------------------------------------
*/

export const markAttendance =
  async (
    req,
    res
  ) => {
    try {
      const {
        employeeId,
        date,
        checkIn =
          null,
        checkOut =
          null,
        status =
          "present",
        notes =
          "",
      } =
        req.body;

      if (
        !employeeId ||
        !date
      ) {
        return res
          .status(
            400
          )
          .json({
            message:
              "Employee and date are required.",
          });
      }

      if (
        !(
          await canActForEmployee(
            req.user,
            employeeId
          )
        )
      ) {
        return res
          .status(
            403
          )
          .json({
            message:
              "You do not have access to this employee.",
          });
      }

      if (
        !(
          await Employee.exists({
            _id:
              employeeId,

            companyId:
              req.user.companyId,
          })
        )
      ) {
        return res
          .status(
            404
          )
          .json({
            message:
              "Employee not found.",
          });
      }

      const dateKey =
        normalizeDateKey(
          date
        );

      const company =
        await Company.findById(
          req.user.companyId
        );

      const assignment =
        await getShiftAssignmentForDate(
          req.user.companyId,
          employeeId,
          dateKey
        );

      const overrides =
        await getOverrides(
          req.user.companyId,
          dateOnlyUTC(
            dateKey
          ),
          endOfDayUTC(
            dateKey
          )
        );

      const calendar =
        resolveCalendarDay(
          company,
          overrides,
          dateOnlyUTC(
            dateKey
          )
        );

      const inTime =
        normalizeTime(
          checkIn
        ) ||
        null;

      const outTime =
        normalizeTime(
          checkOut
        ) ||
        null;

      const breakMinutes =
        Number(
          assignment
            ?.snapshot
            ?.breakMinutes ||
            0
        );

      const minutes =
        Math.max(
          0,

          workedMinutes(
            inTime,
            outTime
          ) -
            breakMinutes
        );

      const record =
        await Attendance.findOneAndUpdate(
          {
            companyId:
              req.user.companyId,

            employeeId,

            dateKey,
          },

          {
            companyId:
              req.user.companyId,

            employeeId,

            date:
              dateOnlyUTC(
                dateKey
              ),

            dateKey,

            checkIn:
              inTime,

            checkOut:
              outTime,

            workedMinutes:
              minutes,

            status,

            notes,

            source:
              "manual",

            shiftAssignmentId:
              assignment?._id ||
              null,

            shiftName:
              assignment
                ?.snapshot
                ?.name ||
              "Company default",

            scheduledStart:
              assignment
                ?.snapshot
                ?.startTime ||
              company
                ?.workStartTime ||
              "09:00",

            scheduledEnd:
              assignment
                ?.snapshot
                ?.endTime ||
              company
                ?.workEndTime ||
              "18:00",

            scheduledMinutes:
              expectedMinutesForAssignment(
                assignment,
                company
              ),

            breakMinutes,

            workMode:
              calendar.workMode ||
              "",

            calendarLabel:
              calendar.label ||
              "",

            isException:
              Boolean(
                inTime &&
                  !outTime
              ),

            exceptionType:
              inTime &&
              !outTime
                ? "missing-check-out"
                : "",

            exceptionReason:
              inTime &&
              !outTime
                ? "Check-out is missing."
                : "",

            exceptionResolved:
              false,
          },

          {
            upsert:
              true,

            new:
              true,

            setDefaultsOnInsert:
              true,

            runValidators:
              true,
          }
        );

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "attendance.manual_update",

        entity:
          "Attendance",

        entityId:
          record._id,

        description:
          `Attendance was updated for ${dateKey}.`,
      });

      res.json(
        await populateAttendance(
          Attendance.findById(
            record._id
          )
        )
      );
    } catch (error) {
      console.error(
        "markAttendance:",
        error
      );

      res
        .status(
          500
        )
        .json({
          message:
            "Unable to update attendance.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Preview Excel Import
|--------------------------------------------------------------------------
*/

export const previewAttendanceImport =
  async (
    req,
    res
  ) => {
    try {
      const rows =
        Array.isArray(
          req.body.rows
        )
          ? req.body.rows
          : [];

      if (
        !rows.length
      ) {
        return res
          .status(
            400
          )
          .json({
            message:
              "No Excel rows were provided.",
          });
      }

      const {
        validRows,
        validationErrors,
      } =
        await validateImportRows(
          req.user.companyId,
          rows
        );

      const dates =
        validRows
          .map(
            (
              row
            ) =>
              row.date
          )
          .sort();

      res.json({
        totalRows:
          rows.length,

        validRows:
          validRows.length,

        invalidRows:
          validationErrors.length,

        validationErrors,

        periodStart:
          dates[0] ||
          null,

        periodEnd:
          dates[
            dates.length -
              1
          ] ||
          null,
      });
    } catch (error) {
      console.error(
        "previewAttendanceImport:",
        error
      );

      res
        .status(
          500
        )
        .json({
          message:
            "Unable to validate attendance import.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Commit Excel Import
|--------------------------------------------------------------------------
*/

export const importAttendance =
  async (
    req,
    res
  ) => {
    let batch;

    try {
      const rows =
        Array.isArray(
          req.body.rows
        )
          ? req.body.rows
          : [];

      const fileName =
        String(
          req.body.fileName ||
            "Attendance.xlsx"
        ).trim();

      if (
        !rows.length
      ) {
        return res
          .status(
            400
          )
          .json({
            message:
              "No Excel rows were provided.",
          });
      }

      batch =
        await AttendanceImportBatch.create({
          companyId:
            req.user.companyId,

          fileName,

          source:
            "excel",

          status:
            "processing",

          totalRows:
            rows.length,

          importedByUserId:
            req.user._id,
        });

      const {
        validRows,
        validationErrors,
      } =
        await validateImportRows(
          req.user.companyId,
          rows
        );

      let punchesCreated =
        0;

      let duplicatesSkipped =
        0;

      const dates =
        validRows
          .map(
            (
              row
            ) =>
              row.date
          )
          .sort();

      for (
        const row of validRows
      ) {
        const punches =
          [];

        if (
          row.punchTime
        ) {
          punches.push({
            time:
              row.punchTime,

            type:
              row.punchType,
          });
        }

        if (
          row.checkIn
        ) {
          punches.push({
            time:
              row.checkIn,

            type:
              "in",
          });
        }

        if (
          row.checkOut
        ) {
          punches.push({
            time:
              row.checkOut,

            type:
              "out",
          });
        }

        for (
          const punch of punches
        ) {
          try {
            await AttendancePunch.create({
              companyId:
                req.user.companyId,

              employeeId:
                row.employee._id,

              employeeCode:
                row.employeeCode,

              punchTime:
                punchDateTime(
                  row.date,
                  punch.time
                ),

              dateKey:
                row.date,

              punchType:
                punch.type,

              source:
                "excel",

              importBatchId:
                batch._id,

              rawData:
                row.raw,
            });

            punchesCreated +=
              1;
          } catch (error) {
            if (
              error?.code ===
              11000
            ) {
              duplicatesSkipped +=
                1;
            } else {
              throw error;
            }
          }
        }
      }

      batch.validRows =
        validRows.length;

      batch.invalidRows =
        validationErrors.length;

      batch.validationErrors =
        validationErrors;

      batch.punchesCreated =
        punchesCreated;

      batch.duplicatesSkipped =
        duplicatesSkipped;

      batch.periodStart =
        dates[0]
          ? dateOnlyUTC(
              dates[0]
            )
          : null;

      batch.periodEnd =
        dates[
          dates.length -
            1
        ]
          ? dateOnlyUTC(
              dates[
                dates.length -
                  1
              ]
            )
          : null;

      batch.status =
        "processed";

      batch.completedAt =
        new Date();

      await batch.save();

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "attendance.imported",

        entity:
          "AttendanceImportBatch",

        entityId:
          batch._id,

        description:
          `${fileName} attendance file was imported.`,
      });

      res
        .status(
          201
        )
        .json({
          batchId:
            batch._id,

          totalRows:
            rows.length,

          validRows:
            validRows.length,

          invalidRows:
            validationErrors.length,

          validationErrors,

          punchesCreated,

          duplicatesSkipped,

          periodStart:
            dates[0] ||
            null,

          periodEnd:
            dates[
              dates.length -
                1
            ] ||
            null,
        });
    } catch (error) {
      console.error(
        "importAttendance:",
        error
      );

      if (
        batch
      ) {
        batch.status =
          "failed";

        batch.failureMessage =
          error.message ||
          "Import failed.";

        batch.completedAt =
          new Date();

        await batch
          .save()
          .catch(
            () => {}
          );
      }

      res
        .status(
          500
        )
        .json({
          message:
            "Unable to import attendance.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Import History
|--------------------------------------------------------------------------
*/

export const getImportBatches =
  async (
    req,
    res
  ) => {
    try {
      const batches =
        await AttendanceImportBatch.find({
          companyId:
            req.user.companyId,
        })
          .populate(
            "importedByUserId",
            "firstName lastName email"
          )
          .sort({
            createdAt:
              -1,
          })
          .limit(
            50
          );

      res.json(
        batches
      );
    } catch (error) {
      res
        .status(
          500
        )
        .json({
          message:
            "Unable to load attendance import history.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Process Attendance
|--------------------------------------------------------------------------
*/

export const processAttendance =
  async (
    req,
    res
  ) => {
    try {
      let from =
        normalizeDateKey(
          req.body.from
        );

      let to =
        normalizeDateKey(
          req.body.to
        );

      const force =
        Boolean(
          req.body.force
        );

      /*
      | If dates are not provided,
      | use pending raw punch range.
      */

      if (
        !from ||
        !to
      ) {
        const pending =
          await AttendancePunch.find({
            companyId:
              req.user.companyId,

            processed:
              false,
          })
            .sort({
              dateKey:
                1,
            })
            .select(
              "dateKey"
            )
            .lean();

        if (
          !pending.length
        ) {
          return res
            .status(
              400
            )
            .json({
              message:
                "No unprocessed attendance punches were found.",
            });
        }

        from =
          from ||
          pending[0]
            .dateKey;

        to =
          to ||
          pending[
            pending.length -
              1
          ].dateKey;
      }

      if (
        from >
        to
      ) {
        return res
          .status(
            400
          )
          .json({
            message:
              "From date cannot be after To date.",
          });
      }

      const start =
        dateOnlyUTC(
          from
        );

      const end =
        endOfDayUTC(
          to
        );

      const [
        company,
        employees,
        overrides,
        leaves,
        punches,
      ] =
        await Promise.all([
          Company.findById(
            req.user.companyId
          ).lean(),

          Employee.find({
            companyId:
              req.user.companyId,

            status: {
              $ne:
                "inactive",
            },
          }).lean(),

          getOverrides(
            req.user.companyId,
            start,
            end
          ),

          LeaveRequest.find({
            companyId:
              req.user.companyId,

            status:
              "approved",

            startDate: {
              $lte:
                end,
            },

            endDate: {
              $gte:
                start,
            },
          }).lean(),

          AttendancePunch.find({
            companyId:
              req.user.companyId,

            dateKey: {
              $gte:
                from,

              $lte:
                to,
            },
          }).sort({
            punchTime:
              1,
          }),
        ]);

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

      /*
      |--------------------------------------------------------------------------
      | Group Punches
      |--------------------------------------------------------------------------
      */

      const punchMap =
        new Map();

      punches.forEach(
        (
          punch
        ) => {
          const key =
            `${punch.employeeId}:${punch.dateKey}`;

          if (
            !punchMap.has(
              key
            )
          ) {
            punchMap.set(
              key,
              []
            );
          }

          punchMap
            .get(
              key
            )
            .push(
              punch
            );
        }
      );

      let attendanceUpdated =
        0;

      let exceptionsCreated =
        0;

      let protectedRecordsSkipped =
        0;

      const affectedBatchCounts =
        new Map();

      /*
      |--------------------------------------------------------------------------
      | Employee x Date
      |--------------------------------------------------------------------------
      */

      for (
        const employee of employees
      ) {
        const employeeStart =
          employee.joiningDate
            ? dateOnlyUTC(
                employee.joiningDate
              )
            : start;

        const employeeEnd =
          employee.lastWorkingDate
            ? endOfDayUTC(
                employee.lastWorkingDate
              )
            : end;

        let cursor =
          new Date(
            start
          );

        while (
          cursor <=
          end
        ) {
          if (
            cursor >=
              employeeStart &&
            cursor <=
              employeeEnd
          ) {
            const dateKey =
              cursor
                .toISOString()
                .slice(
                  0,
                  10
                );

            const key =
              `${employee._id}:${dateKey}`;

            const dayPunches =
              punchMap.get(
                key
              ) ||
              [];

            const existing =
              await Attendance.findOne({
                companyId:
                  req.user.companyId,

                employeeId:
                  employee._id,

                dateKey,
              });

            /*
            | Protect manual/self record
            | if there are no raw punches.
            */

            if (
              !force &&
              existing &&
              [
                "manual",
                "self",
              ].includes(
                existing.source
              ) &&
              !dayPunches.length
            ) {
              protectedRecordsSkipped +=
                1;

              cursor =
                addDaysUTC(
                  cursor,
                  1
                );

              continue;
            }

            const assignment =
              await getShiftAssignmentForDate(
                req.user.companyId,
                employee._id,
                dateKey
              );

            const calendar =
              resolveCalendarDay(
                company,
                overrides,
                dateOnlyUTC(
                  dateKey
                )
              );

            const leave =
              leaveForDate(
                leaves,
                employee._id,
                dateKey
              );

            const result =
              buildAttendanceResult({
                company,
                calendar,
                assignment,
                punches:
                  dayPunches,
                leave,
              });

            const batchId =
              dayPunches.find(
                (
                  punch
                ) =>
                  punch.importBatchId
              )?.importBatchId ||
              null;

            const record =
              await Attendance.findOneAndUpdate(
                {
                  companyId:
                    req.user.companyId,

                  employeeId:
                    employee._id,

                  dateKey,
                },

                {
                  companyId:
                    req.user.companyId,

                  employeeId:
                    employee._id,

                  date:
                    dateOnlyUTC(
                      dateKey
                    ),

                  dateKey,

                  ...result,

                  source:
                    dayPunches.length
                      ? "excel"
                      : "system",

                  importBatchId:
                    batchId,

                  processedAt:
                    new Date(),

                  processedByUserId:
                    req.user._id,

                  exceptionResolved:
                    false,

                  exceptionResolvedAt:
                    null,

                  exceptionResolvedByUserId:
                    null,

                  resolutionNote:
                    "",
                },

                {
                  upsert:
                    true,

                  new:
                    true,

                  setDefaultsOnInsert:
                    true,

                  runValidators:
                    true,
                }
              );

            attendanceUpdated +=
              1;

            if (
              record.isException
            ) {
              exceptionsCreated +=
                1;
            }

            /*
            |--------------------------------------------------------------------------
            | Mark Raw Punches Processed
            |--------------------------------------------------------------------------
            */

            if (
              dayPunches.length
            ) {
              const dayBatchIds =
                new Set();

              for (
                const punch of dayPunches
              ) {
                punch.processed =
                  true;

                punch.processedAt =
                  new Date();

                punch.attendanceId =
                  record._id;

                if (
                  punch.importBatchId
                ) {
                  dayBatchIds.add(
                    String(
                      punch.importBatchId
                    )
                  );
                }

                await punch.save();
              }

              for (
                const batchKey of dayBatchIds
              ) {
                affectedBatchCounts.set(
                  batchKey,

                  (
                    affectedBatchCounts.get(
                      batchKey
                    ) ||
                    0
                  ) +
                    1
                );
              }
            }
          }

          cursor =
            addDaysUTC(
              cursor,
              1
            );
        }
      }

      for (
        const [
          batchId,
          count,
        ] of affectedBatchCounts.entries()
      ) {
        await AttendanceImportBatch.findByIdAndUpdate(
          batchId,
          {
            $inc: {
              attendanceUpdated:
                count,
            },
          }
        );
      }

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "attendance.processed",

        entity:
          "Attendance",

        description:
          `Attendance processed from ${from} to ${to}.`,
      });

      res.json({
        from,
        to,
        attendanceUpdated,
        exceptionsCreated,
        protectedRecordsSkipped,
      });
    } catch (error) {
      console.error(
        "processAttendance:",
        error
      );

      res
        .status(
          500
        )
        .json({
          message:
            "Unable to process attendance.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Exceptions
|--------------------------------------------------------------------------
*/

export const getExceptions =
  async (
    req,
    res
  ) => {
    try {
      const scopedIds =
        await getScopedEmployeeIds(
          req.user,
          true
        );

      const query = {
        companyId:
          req.user.companyId,

        isException:
          true,

        exceptionResolved:
          false,
      };

      if (
        scopedIds
      ) {
        query.employeeId =
          {
            $in:
              scopedIds,
          };
      }

      if (
        req.query.from ||
        req.query.to
      ) {
        query.date =
          {};

        if (
          req.query.from
        ) {
          query.date.$gte =
            dateOnlyUTC(
              req.query.from
            );
        }

        if (
          req.query.to
        ) {
          query.date.$lte =
            endOfDayUTC(
              req.query.to
            );
        }
      }

      const records =
        await populateAttendance(
          Attendance.find(
            query
          )
        ).sort({
          date:
            -1,

          createdAt:
            -1,
        });

      res.json(
        records
      );
    } catch (error) {
      res
        .status(
          500
        )
        .json({
          message:
            "Unable to load attendance exceptions.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Resolve Exception
|--------------------------------------------------------------------------
*/

export const resolveException =
  async (
    req,
    res
  ) => {
    try {
      const record =
        await Attendance.findOne({
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
              "Attendance record not found.",
          });
      }

      if (
        !(
          await canActForEmployee(
            req.user,
            record.employeeId
          )
        )
      ) {
        return res
          .status(
            403
          )
          .json({
            message:
              "You do not have access to this employee.",
          });
      }

      if (
        req.body.checkIn !==
        undefined
      ) {
        record.checkIn =
          normalizeTime(
            req.body.checkIn
          ) ||
          null;
      }

      if (
        req.body.checkOut !==
        undefined
      ) {
        record.checkOut =
          normalizeTime(
            req.body.checkOut
          ) ||
          null;
      }

      if (
        req.body.status
      ) {
        record.status =
          req.body.status;
      }

      if (
        req.body.notes !==
        undefined
      ) {
        record.notes =
          req.body.notes;
      }

      record.workedMinutes =
        Math.max(
          0,

          workedMinutes(
            record.checkIn,
            record.checkOut
          ) -
            Number(
              record.breakMinutes ||
                0
            )
        );

      record.source =
        "manual";

      record.isException =
        false;

      record.exceptionType =
        "";

      record.exceptionReason =
        "";

      record.exceptionResolved =
        true;

      record.exceptionResolvedAt =
        new Date();

      record.exceptionResolvedByUserId =
        req.user._id;

      record.resolutionNote =
        String(
          req.body.resolutionNote ||
            ""
        ).trim();

      await record.save();

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "attendance.exception_resolved",

        entity:
          "Attendance",

        entityId:
          record._id,

        description:
          `Attendance exception resolved for ${record.dateKey}.`,
      });

      res.json(
        await populateAttendance(
          Attendance.findById(
            record._id
          )
        )
      );
    } catch (error) {
      console.error(
        "resolveException:",
        error
      );

      res
        .status(
          500
        )
        .json({
          message:
            "Unable to resolve attendance exception.",
        });
    }
  };