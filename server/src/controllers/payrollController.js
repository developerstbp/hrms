import Company from "../models/Company.js";
import Employee from "../models/Employees.js";
import SalaryProfile from "../models/SalaryProfile.js";
import CompensationRevision from "../models/CompensationRevision.js";

import PayrollRun from "../models/PayrollRun.js";
import PayrollEntry from "../models/PayrollEntry.js";

import Attendance from "../models/Attendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import ShiftAssignment from "../models/ShiftAssignment.js";
import Holiday from "../models/Holiday.js";

import {
  getEmployeeForUser,
} from "../utils/scope.js";

import {
  dateOnly,
  dateKeyUTC,
  addDaysUTC,
  overtimeMinutesForRecord,
} from "../utils/shifts.js";

import {
  resolvePayrollPeriod,
  buildWorkCalendar,
} from "../utils/workCalendar.js";

import {
  writeAudit,
} from "../utils/audit.js";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const roundMoney = (
  value
) =>
  Math.round(
    (
      Number(
        value || 0
      ) +
      Number.EPSILON
    ) *
      100
  ) / 100;

const daysInclusive = (
  start,
  end
) =>
  Math.floor(
    (
      dateOnly(end) -
      dateOnly(start)
    ) /
      86400000
  ) + 1;

const assignmentForDate = (
  assignments,
  date
) =>
  assignments.find(
    (assignment) => {
      const from =
        dateOnly(
          assignment.effectiveFrom
        );

      const to =
        assignment.effectiveTo
          ? dateOnly(
              assignment.effectiveTo
            )
          : null;

      return (
        from <= date &&
        (
          !to ||
          to >= date
        )
      );
    }
  );

const activeRangeForEmployee =
  (
    employee,
    start,
    end
  ) => {
    const joining =
      employee.joiningDate
        ? dateOnly(
            employee.joiningDate
          )
        : start;

    const leaving =
      employee.lastWorkingDate
        ? dateOnly(
            employee.lastWorkingDate
          )
        : end;

    const activeStart =
      joining > start
        ? joining
        : start;

    const activeEnd =
      leaving < end
        ? leaving
        : end;

    if (
      activeEnd <
      activeStart
    ) {
      return null;
    }

    return {
      activeStart,
      activeEnd,
    };
  };

const leaveValueForDate =
  (
    leave,
    date
  ) => {
    const start =
      dateOnly(
        leave.startDate
      );

    const end =
      dateOnly(
        leave.endDate
      );

    if (
      date < start ||
      date > end
    ) {
      return 0;
    }

    if (
      leave.halfDay
    ) {
      return (
        dateKeyUTC(
          date
        ) ===
        dateKeyUTC(
          start
        )
          ? 0.5
          : 0
      );
    }

    return 1;
  };

/*
|--------------------------------------------------------------------------
| Compensation Helpers
|--------------------------------------------------------------------------
*/

const normalizeSalary = (
  record
) => ({
  _id:
    record?._id,

  effectiveFrom:
    record?.effectiveFrom,

  basicSalary:
    Number(
      record?.basicSalary ||
        0
    ),

  fixedAllowance:
    Number(
      record?.fixedAllowance ||
        0
    ),

  otherAllowance:
    Number(
      record?.otherAllowance ||
        0
    ),

  fixedDeduction:
    Number(
      record?.fixedDeduction ||
        0
    ),

  overtimeHourlyRate:
    Number(
      record?.overtimeHourlyRate ||
        0
    ),
});

/*
  Return the salary revision active on
  one particular calendar date.
*/

const salaryForDate = (
  history,
  fallbackProfile,
  date
) => {
  const target =
    dateOnly(date);

  const matches =
    history
      .filter(
        (revision) =>
          revision.effectiveFrom &&
          dateOnly(
            revision.effectiveFrom
          ) <= target
      )
      .sort(
        (a, b) =>
          dateOnly(
            b.effectiveFrom
          ) -
          dateOnly(
            a.effectiveFrom
          )
      );

  if (
    matches.length
  ) {
    return normalizeSalary(
      matches[0]
    );
  }

  /*
    Backward compatibility for old SalaryProfile
    records which existed before compensation
    history was introduced.
  */

  if (
    fallbackProfile
  ) {
    const effective =
      fallbackProfile.effectiveFrom
        ? dateOnly(
            fallbackProfile.effectiveFrom
          )
        : null;

    if (
      !effective ||
      effective <= target
    ) {
      return normalizeSalary(
        fallbackProfile
      );
    }
  }

  return null;
};

/*
|--------------------------------------------------------------------------
| Calendar Summary
|--------------------------------------------------------------------------
*/

const summarizeCalendar = (
  days
) => {
  const summary = {
    calendarDays:
      days.length,

    workingDays:
      0,

    officeDays:
      0,

    wfhDays:
      0,

    offDays:
      0,

    holidayDays:
      0,
  };

  for (
    const day of days
  ) {
    if (
      day.isWorkingDay
    ) {
      summary.workingDays +=
        1;

      if (
        day.workMode ===
        "wfh"
      ) {
        summary.wfhDays +=
          1;
      } else {
        summary.officeDays +=
          1;
      }
    } else if (
      [
        "holiday",
        "optional_holiday",
      ].includes(
        day.dayType
      )
    ) {
      summary.holidayDays +=
        1;
    } else {
      summary.offDays +=
        1;
    }
  }

  return summary;
};

/*
|--------------------------------------------------------------------------
| Build Salary Segments
|--------------------------------------------------------------------------
*/

const buildSalarySegments = ({
  history,
  fallbackProfile,

  activeStart,
  activeEnd,

  calendarMap,
}) => {
  const segments = [];

  let cursor =
    dateOnly(
      activeStart
    );

  while (
    cursor <= activeEnd
  ) {
    const salary =
      salaryForDate(
        history,
        fallbackProfile,
        cursor
      );

    if (!salary) {
      return {
        error:
          `No salary is effective on ${dateKeyUTC(
            cursor
          )}.`,
      };
    }

    const identity =
      salary._id?.toString?.() ||
      `${salary.effectiveFrom}-${salary.basicSalary}`;

    let segment =
      segments[
        segments.length - 1
      ];

    if (
      !segment ||
      segment.identity !==
        identity
    ) {
      segment = {
        identity,

        effectiveFrom:
          new Date(
            cursor
          ),

        effectiveTo:
          new Date(
            cursor
          ),

        calendarDays:
          0,

        workingDays:
          0,

        salary,
      };

      segments.push(
        segment
      );
    }

    segment.effectiveTo =
      new Date(cursor);

    segment.calendarDays +=
      1;

    const calendarDay =
      calendarMap.get(
        dateKeyUTC(
          cursor
        )
      );

    if (
      calendarDay
        ?.isWorkingDay
    ) {
      segment.workingDays +=
        1;
    }

    cursor =
      addDaysUTC(
        cursor,
        1
      );
  }

  return {
    segments,
  };
};

/*
|--------------------------------------------------------------------------
| Salary Segment Weight
|--------------------------------------------------------------------------
*/

const segmentWeight = ({
  basis,
  segment,

  fullPeriodEmployee,

  periodCalendarDays,
  totalWorkingDays,

  fixedDivisor,
}) => {
  /*
    Working Days:
    salary is weighted by expected working days.
  */

  if (
    basis ===
    "working_days"
  ) {
    return (
      segment.workingDays /
      Math.max(
        1,
        totalWorkingDays
      )
    );
  }

  /*
    Actual Calendar Days
  */

  if (
    basis ===
    "calendar_days"
  ) {
    return (
      segment.calendarDays /
      Math.max(
        1,
        periodCalendarDays
      )
    );
  }

  /*
    Fixed 30 / Custom Divisor

    Full-period employee still receives one
    complete monthly salary.

    Partial-period employee is prorated
    by the configured divisor.
  */

  if (
    fullPeriodEmployee
  ) {
    return (
      segment.calendarDays /
      Math.max(
        1,
        periodCalendarDays
      )
    );
  }

  return (
    segment.calendarDays /
    Math.max(
      1,
      fixedDivisor
    )
  );
};

/*
|--------------------------------------------------------------------------
| Daily Deduction Rate
|--------------------------------------------------------------------------
*/

const salaryDailyRate = ({
  company,
  salary,

  periodCalendarDays,
  totalWorkingDays,
}) => {
  const settings =
    company.payrollSettings ||
    {};

  const basis =
    settings.salaryCalculationBasis ||
    "fixed_30";

  let divisor;

  if (
    basis ===
    "working_days"
  ) {
    divisor =
      Math.max(
        1,
        totalWorkingDays
      );
  } else if (
    basis ===
    "calendar_days"
  ) {
    divisor =
      Math.max(
        1,
        periodCalendarDays
      );
  } else {
    divisor =
      Math.max(
        1,
        Number(
          settings.salaryDayDivisor ||
            30
        )
      );
  }

  return (
    Number(
      salary.basicSalary ||
        0
    ) /
    divisor
  );
};

/*
|--------------------------------------------------------------------------
| Build Payroll Entry
|--------------------------------------------------------------------------
*/

const buildEntry = async ({
  company,
  employee,

  salaryHistory,
  fallbackSalary,

  periodStart,
  periodEnd,

  periodCalendarDays,
  totalWorkingDays,

  calendarMap,
}) => {
  const range =
    activeRangeForEmployee(
      employee,
      periodStart,
      periodEnd
    );

  if (!range) {
    return null;
  }

  const salarySegmentResult =
    buildSalarySegments({
      history:
        salaryHistory,

      fallbackProfile:
        fallbackSalary,

      activeStart:
        range.activeStart,

      activeEnd:
        range.activeEnd,

      calendarMap,
    });

  if (
    salarySegmentResult.error
  ) {
    return {
      error:
        salarySegmentResult.error,
    };
  }

  const salarySegments =
    salarySegmentResult.segments;

  /*
  |--------------------------------------------------------------------------
  | Attendance / Leave / Shift
  |--------------------------------------------------------------------------
  */

  const [
    attendance,
    leaves,
    assignments,
  ] =
    await Promise.all([
      Attendance.find({
        companyId:
          company._id,

        employeeId:
          employee._id,

        date: {
          $gte:
            periodStart,

          $lte:
            new Date(
              `${dateKeyUTC(
                periodEnd
              )}T23:59:59.999Z`
            ),
        },
      }),

      LeaveRequest.find({
        companyId:
          company._id,

        employeeId:
          employee._id,

        status:
          "approved",

        startDate: {
          $lte:
            periodEnd,
        },

        endDate: {
          $gte:
            periodStart,
        },
      }).populate(
        "leaveTypeId",
        "isPaid name code"
      ),

      ShiftAssignment.find({
        companyId:
          company._id,

        employeeId:
          employee._id,

        effectiveFrom: {
          $lte:
            periodEnd,
        },

        $or: [
          {
            effectiveTo:
              null,
          },

          {
            effectiveTo: {
              $gte:
                periodStart,
            },
          },
        ],
      }).sort({
        effectiveFrom:
          1,
      }),
    ]);

  const attendanceMap =
    new Map(
      attendance.map(
        (record) => [
          record.dateKey ||
            dateKeyUTC(
              record.date
            ),

          record,
        ]
      )
    );

  const summary = {
    scheduledDays:
      0,

    officeDays:
      0,

    wfhDays:
      0,

    holidayDays:
      0,

    offDays:
      0,

    presentDays:
      0,

    lateDays:
      0,

    halfDays:
      0,

    absentDays:
      0,

    paidLeaveDays:
      0,

    unpaidLeaveDays:
      0,

    unrecordedDays:
      0,

    overtimeMinutes:
      0,

    shiftSegments:
      new Set(),
  };

  /*
    These are accumulated using the salary
    effective on each affected date.
  */

  let absenceDeduction =
    0;

  let unpaidLeaveDeduction =
    0;

  let halfDayDeduction =
    0;

  let overtimeAmount =
    0;

  let cursor =
    dateOnly(
      range.activeStart
    );

  while (
    cursor <=
    range.activeEnd
  ) {
    const key =
      dateKeyUTC(
        cursor
      );

    const calendarDay =
      calendarMap.get(
        key
      );

    /*
    |--------------------------------------------------------------------------
    | Off / Holiday
    |--------------------------------------------------------------------------
    */

    if (
      !calendarDay ||
      !calendarDay.isWorkingDay
    ) {
      if (
        calendarDay &&
        [
          "holiday",
          "optional_holiday",
        ].includes(
          calendarDay.dayType
        )
      ) {
        summary.holidayDays +=
          1;
      } else {
        summary.offDays +=
          1;
      }

      cursor =
        addDaysUTC(
          cursor,
          1
        );

      continue;
    }

    /*
    |--------------------------------------------------------------------------
    | Working Day
    |--------------------------------------------------------------------------
    */

    summary.scheduledDays +=
      1;

    if (
      calendarDay.workMode ===
      "wfh"
    ) {
      summary.wfhDays +=
        1;
    } else {
      summary.officeDays +=
        1;
    }

    const salary =
      salaryForDate(
        salaryHistory,
        fallbackSalary,
        cursor
      );

    if (!salary) {
      return {
        error:
          `No salary is effective on ${key}.`,
      };
    }

    const dailyRate =
      salaryDailyRate({
        company,
        salary,

        periodCalendarDays,
        totalWorkingDays,
      });

    const assignment =
      assignmentForDate(
        assignments,
        cursor
      );

    if (
      assignment?._id
    ) {
      summary.shiftSegments.add(
        assignment._id.toString()
      );
    }

    const record =
      attendanceMap.get(
        key
      );

    /*
    |--------------------------------------------------------------------------
    | Leave
    |--------------------------------------------------------------------------
    */

    let paidLeave =
      0;

    let unpaidLeave =
      0;

    for (
      const leave of leaves
    ) {
      const value =
        leaveValueForDate(
          leave,
          cursor
        );

      if (!value) {
        continue;
      }

      if (
        leave.leaveTypeId
          ?.isPaid ===
        false
      ) {
        unpaidLeave =
          Math.max(
            unpaidLeave,
            value
          );
      } else {
        paidLeave =
          Math.max(
            paidLeave,
            value
          );
      }
    }

    if (
      unpaidLeave > 0
    ) {
      summary.unpaidLeaveDays +=
        unpaidLeave;

      if (
        company
          .payrollSettings
          ?.deductUnpaidLeave !==
        false
      ) {
        unpaidLeaveDeduction +=
          dailyRate *
          unpaidLeave;
      }
    } else if (
      paidLeave > 0
    ) {
      summary.paidLeaveDays +=
        paidLeave;
    }

    /*
    |--------------------------------------------------------------------------
    | Attendance
    |--------------------------------------------------------------------------
    */

    if (record) {
      if (
        record.status ===
        "late"
      ) {
        summary.presentDays +=
          1;

        summary.lateDays +=
          1;
      }

      else if (
        record.status ===
        "present"
      ) {
        summary.presentDays +=
          1;
      }

      else if (
        record.status ===
        "half-day"
      ) {
        summary.halfDays +=
          1;

        if (
          company
            .payrollSettings
            ?.deductHalfDay !==
          false
        ) {
          halfDayDeduction +=
            dailyRate *
            0.5;
        }
      }

      else if (
        record.status ===
          "absent" &&
        paidLeave === 0 &&
        unpaidLeave === 0
      ) {
        summary.absentDays +=
          1;

        if (
          company
            .payrollSettings
            ?.deductAbsence !==
          false
        ) {
          absenceDeduction +=
            dailyRate;
        }
      }

      else if (
        record.status ===
          "on-leave" &&
        paidLeave === 0 &&
        unpaidLeave === 0
      ) {
        summary.unrecordedDays +=
          1;
      }

      /*
      |--------------------------------------------------------------------------
      | Overtime
      |--------------------------------------------------------------------------
      */

      if (
        company
          .payrollSettings
          ?.overtimeEnabled &&

        assignment &&

        record.checkOut
      ) {
        const overtimeMinutes =
          overtimeMinutesForRecord(
            assignment,
            record.checkIn,
            record.checkOut
          );

        summary.overtimeMinutes +=
          overtimeMinutes;

        overtimeAmount +=
          (
            overtimeMinutes /
            60
          ) *
          Number(
            salary.overtimeHourlyRate ||
              0
          );
      }
    }

    /*
      Missing attendance does NOT become an
      automatic absence.

      It remains an exception for HR to review.
    */

    else if (
      paidLeave === 0 &&
      unpaidLeave === 0
    ) {
      summary.unrecordedDays +=
        1;
    }

    cursor =
      addDaysUTC(
        cursor,
        1
      );
  }

  /*
  |--------------------------------------------------------------------------
  | Salary Segment Calculation
  |--------------------------------------------------------------------------
  */

  const settings =
    company.payrollSettings ||
    {};

  const basis =
    settings.salaryCalculationBasis ||
    "fixed_30";

  const fixedDivisor =
    Math.max(
      1,
      Number(
        settings.salaryDayDivisor ||
          30
      )
    );

  const fullPeriodEmployee =
    dateOnly(
      range.activeStart
    ).getTime() ===
      dateOnly(
        periodStart
      ).getTime() &&

    dateOnly(
      range.activeEnd
    ).getTime() ===
      dateOnly(
        periodEnd
      ).getTime();

  let basePay =
    0;

  let allowanceTotal =
    0;

  let fixedDeduction =
    0;

  const salarySegmentsSnapshot =
    [];

  for (
    const segment of salarySegments
  ) {
    const weight =
      segmentWeight({
        basis,

        segment,

        fullPeriodEmployee,

        periodCalendarDays,

        totalWorkingDays,

        fixedDivisor,
      });

    basePay +=
      Number(
        segment.salary
          .basicSalary ||
          0
      ) *
      weight;

    allowanceTotal +=
      (
        Number(
          segment.salary
            .fixedAllowance ||
            0
        ) +
        Number(
          segment.salary
            .otherAllowance ||
            0
        )
      ) *
      weight;

    fixedDeduction +=
      Number(
        segment.salary
          .fixedDeduction ||
          0
      ) *
      weight;

    salarySegmentsSnapshot.push(
      {
        effectiveFrom:
          segment.effectiveFrom,

        effectiveTo:
          segment.effectiveTo,

        calendarDays:
          segment.calendarDays,

        workingDays:
          segment.workingDays,

        basicSalary:
          segment.salary
            .basicSalary,

        fixedAllowance:
          segment.salary
            .fixedAllowance,

        otherAllowance:
          segment.salary
            .otherAllowance,

        fixedDeduction:
          segment.salary
            .fixedDeduction,

        overtimeHourlyRate:
          segment.salary
            .overtimeHourlyRate,
      }
    );
  }

  basePay =
    roundMoney(
      basePay
    );

  allowanceTotal =
    roundMoney(
      allowanceTotal
    );

  fixedDeduction =
    roundMoney(
      fixedDeduction
    );

  absenceDeduction =
    roundMoney(
      absenceDeduction
    );

  unpaidLeaveDeduction =
    roundMoney(
      unpaidLeaveDeduction
    );

  halfDayDeduction =
    roundMoney(
      halfDayDeduction
    );

  overtimeAmount =
    roundMoney(
      overtimeAmount
    );

  const lateDeduction =
    roundMoney(
      Number(
        settings.latePenaltyAmount ||
          0
      ) *
        summary.lateDays
    );

  const grossPay =
    roundMoney(
      basePay +
        allowanceTotal +
        overtimeAmount
    );

  const totalDeductions =
    roundMoney(
      fixedDeduction +
        absenceDeduction +
        unpaidLeaveDeduction +
        halfDayDeduction +
        lateDeduction
    );

  const netPay =
    roundMoney(
      Math.max(
        0,
        grossPay -
          totalDeductions
      )
    );

  /*
    Latest salary active at employee's
    last day in this payroll period.
  */

  const latestSalary =
    salaryForDate(
      salaryHistory,
      fallbackSalary,
      range.activeEnd
    );

  return {
    companyId:
      company._id,

    employeeId:
      employee._id,

    employeeSnapshot: {
      employeeCode:
        employee.employeeCode,

      name:
        `${employee.firstName} ${
          employee.lastName ||
          ""
        }`.trim(),

      designation:
        employee.designation ||
        "",

      department:
        employee.departmentId
          ?.name ||
        "",
    },

    salarySnapshot: {
      basicSalary:
        latestSalary
          ?.basicSalary ||
        0,

      fixedAllowance:
        latestSalary
          ?.fixedAllowance ||
        0,

      otherAllowance:
        latestSalary
          ?.otherAllowance ||
        0,

      fixedDeduction:
        latestSalary
          ?.fixedDeduction ||
        0,

      overtimeHourlyRate:
        latestSalary
          ?.overtimeHourlyRate ||
        0,
    },

    salarySegments:
      salarySegmentsSnapshot,

    attendanceSummary: {
      ...summary,

      shiftSegments:
        summary.shiftSegments
          .size,
    },

    basePay,

    allowanceTotal,

    overtimeAmount,

    absenceDeduction,

    unpaidLeaveDeduction,

    halfDayDeduction,

    lateDeduction,

    fixedDeduction,

    grossPay,

    totalDeductions,

    netPay,
  };
};

/*
|--------------------------------------------------------------------------
| Get Payroll Settings
|--------------------------------------------------------------------------
*/

export const getPayrollSettings =
  async (req, res) => {
    try {
      const company =
        await Company.findById(
          req.user.companyId
        ).select(
          "currency payrollSettings"
        );

      if (!company) {
        return res
          .status(404)
          .json({
            message:
              "Company not found.",
          });
      }

      res.json({
        currency:
          company.currency ||
          "PKR",

        payrollSettings:
          company.payrollSettings ||
          {},
      });
    } catch (error) {
      res.status(500).json({
        message:
          "Unable to load payroll settings.",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| Update Payroll Settings
|--------------------------------------------------------------------------
*/

export const updatePayrollSettings =
  async (req, res) => {
    try {
      const allowed = [
        "cycleType",
        "cycleWindow",
        "cycleStartDay",
        "cycleEndDay",

        "salaryCalculationBasis",
        "salaryDayDivisor",

        "deductAbsence",
        "deductUnpaidLeave",
        "deductHalfDay",

        "overtimeEnabled",
        "latePenaltyAmount",

        "payDay",
      ];

      const current =
        await Company.findById(
          req.user.companyId
        );

      if (!current) {
        return res
          .status(404)
          .json({
            message:
              "Company not found.",
          });
      }

      const next = {
        ...(
          current
            .payrollSettings
            ?.toObject?.() ||
          current.payrollSettings ||
          {}
        ),
      };

      for (
        const key of allowed
      ) {
        if (
          Object.prototype
            .hasOwnProperty.call(
              req.body,
              key
            )
        ) {
          next[key] =
            req.body[key];
        }
      }

      current.payrollSettings =
        next;

      await current.save();

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "payroll.settings_updated",

        entity:
          "Company",

        entityId:
          current._id,

        description:
          "Payroll calculation settings were updated.",
      });

      res.json({
        currency:
          current.currency,

        payrollSettings:
          current.payrollSettings,
      });
    } catch (error) {
      res.status(500).json({
        message:
          "Unable to update payroll settings.",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| Salary Profiles + Compensation History
|--------------------------------------------------------------------------
*/

export const getSalaryProfiles =
  async (req, res) => {
    try {
      const profiles =
        await SalaryProfile.find({
          companyId:
            req.user.companyId,
        })
          .populate({
            path:
              "employeeId",

            select:
              "firstName lastName employeeCode designation departmentId status joiningDate",

            populate: {
              path:
                "departmentId",

              select:
                "name code",
            },
          })
          .sort({
            updatedAt:
              -1,
          });

      const revisions =
        await CompensationRevision.find({
          companyId:
            req.user.companyId,

          employeeId: {
            $in:
              profiles
                .filter(
                  (profile) =>
                    profile.employeeId
                )
                .map(
                  (profile) =>
                    profile.employeeId
                      ._id
                ),
          },
        })
          .populate(
            "changedByUserId",
            "firstName lastName email role"
          )
          .sort({
            effectiveFrom:
              -1,
          });

      const historyMap =
        new Map();

      for (
        const revision of revisions
      ) {
        const key =
          revision.employeeId.toString();

        if (
          !historyMap.has(
            key
          )
        ) {
          historyMap.set(
            key,
            []
          );
        }

        historyMap
          .get(key)
          .push(
            revision
          );
      }

      res.json(
        profiles.map(
          (profile) => ({
            ...profile.toObject(),

            compensationHistory:
              historyMap.get(
                profile.employeeId
                  ?._id
                  ?.toString()
              ) ||
              [],
          })
        )
      );
    } catch (error) {
      console.error(
        "Salary profiles error:",
        error
      );

      res.status(500).json({
        message:
          "Unable to load salary profiles.",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| Save Salary Revision
|--------------------------------------------------------------------------
*/

export const upsertSalaryProfile =
  async (req, res) => {
    try {
      const employee =
        await Employee.findOne({
          _id:
            req.params.employeeId,

          companyId:
            req.user.companyId,
        });

      if (!employee) {
        return res
          .status(404)
          .json({
            message:
              "Employee not found.",
          });
      }

      const {
        basicSalary,

        fixedAllowance = 0,
        otherAllowance = 0,
        fixedDeduction = 0,
        overtimeHourlyRate = 0,

        paymentMethod =
          "bank",

        bankName = "",
        accountTitle = "",
        accountNumber = "",
        notes = "",

        effectiveFrom,

        revisionReason = "",
      } = req.body;

      if (
        basicSalary ===
          undefined ||
        Number(
          basicSalary
        ) < 0
      ) {
        return res
          .status(400)
          .json({
            message:
              "A valid basic salary is required.",
          });
      }

      if (!effectiveFrom) {
        return res
          .status(400)
          .json({
            message:
              "Effective date is required for a salary revision.",
          });
      }

      const effectiveDate =
        new Date(
          `${effectiveFrom}T00:00:00.000Z`
        );

      if (
        Number.isNaN(
          effectiveDate.getTime()
        )
      ) {
        return res
          .status(400)
          .json({
            message:
              "Invalid effective date.",
          });
      }

      /*
      |--------------------------------------------------------------------------
      | Existing Current Salary
      |--------------------------------------------------------------------------
      */

      const existingProfile =
        await SalaryProfile.findOne({
          companyId:
            req.user.companyId,

          employeeId:
            employee._id,
        });

      /*
      |--------------------------------------------------------------------------
      | Migrate Existing Salary Into History
      |--------------------------------------------------------------------------
      |
      | If this employee already had a salary before
      | compensation history existed, preserve it
      | before adding the first new revision.
      |
      */

      const revisionCount =
        await CompensationRevision.countDocuments(
          {
            companyId:
              req.user.companyId,

            employeeId:
              employee._id,
          }
        );

      if (
        revisionCount === 0 &&
        existingProfile
      ) {
        const originalEffective =
          existingProfile.effectiveFrom ||
          employee.joiningDate ||
          new Date(
            "1970-01-01T00:00:00.000Z"
          );

        /*
          Only create separate opening revision
          when it does not share the exact same
          effective date being saved now.
        */

        if (
          dateOnly(
            originalEffective
          ).getTime() !==
          dateOnly(
            effectiveDate
          ).getTime()
        ) {
          await CompensationRevision.create(
            {
              companyId:
                req.user.companyId,

              employeeId:
                employee._id,

              effectiveFrom:
                originalEffective,

              basicSalary:
                Number(
                  existingProfile.basicSalary ||
                    0
                ),

              fixedAllowance:
                Number(
                  existingProfile.fixedAllowance ||
                    0
                ),

              otherAllowance:
                Number(
                  existingProfile.otherAllowance ||
                    0
                ),

              fixedDeduction:
                Number(
                  existingProfile.fixedDeduction ||
                    0
                ),

              overtimeHourlyRate:
                Number(
                  existingProfile.overtimeHourlyRate ||
                    0
                ),

              reason:
                "Opening compensation record migrated from the previous salary profile.",

              changedByUserId:
                req.user._id,
            }
          );
        }
      }

      /*
      |--------------------------------------------------------------------------
      | Create / Update Revision
      |--------------------------------------------------------------------------
      */

      const revision =
        await CompensationRevision.findOneAndUpdate(
          {
            companyId:
              req.user.companyId,

            employeeId:
              employee._id,

            effectiveFrom:
              effectiveDate,
          },

          {
            companyId:
              req.user.companyId,

            employeeId:
              employee._id,

            effectiveFrom:
              effectiveDate,

            basicSalary:
              Number(
                basicSalary
              ),

            fixedAllowance:
              Number(
                fixedAllowance ||
                  0
              ),

            otherAllowance:
              Number(
                otherAllowance ||
                  0
              ),

            fixedDeduction:
              Number(
                fixedDeduction ||
                  0
              ),

            overtimeHourlyRate:
              Number(
                overtimeHourlyRate ||
                  0
              ),

            reason:
              revisionReason.trim(),

            changedByUserId:
              req.user._id,
          },

          {
            upsert:
              true,

            new:
              true,

            runValidators:
              true,

            setDefaultsOnInsert:
              true,
          }
        );

      /*
      |--------------------------------------------------------------------------
      | Find Latest Effective Revision
      |--------------------------------------------------------------------------
      |
      | SalaryProfile remains a quick "current/latest"
      | snapshot for UI/backward compatibility.
      |
      */

      const latestRevision =
        await CompensationRevision.findOne(
          {
            companyId:
              req.user.companyId,

            employeeId:
              employee._id,
          }
        ).sort({
          effectiveFrom:
            -1,
        });

      /*
      |--------------------------------------------------------------------------
      | Update Current Salary Snapshot
      |--------------------------------------------------------------------------
      */

      const profile =
        await SalaryProfile.findOneAndUpdate(
          {
            companyId:
              req.user.companyId,

            employeeId:
              employee._id,
          },

          {
            companyId:
              req.user.companyId,

            employeeId:
              employee._id,

            basicSalary:
              latestRevision
                .basicSalary,

            fixedAllowance:
              latestRevision
                .fixedAllowance,

            otherAllowance:
              latestRevision
                .otherAllowance,

            fixedDeduction:
              latestRevision
                .fixedDeduction,

            overtimeHourlyRate:
              latestRevision
                .overtimeHourlyRate,

            paymentMethod,

            bankName,

            accountTitle,

            accountNumber,

            notes,

            effectiveFrom:
              latestRevision
                .effectiveFrom,

            updatedByUserId:
              req.user._id,
          },

          {
            upsert:
              true,

            new:
              true,

            runValidators:
              true,

            setDefaultsOnInsert:
              true,
          }
        );

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "payroll.compensation_revision_saved",

        entity:
          "CompensationRevision",

        entityId:
          revision._id,

        description:
          `Compensation revision effective ${effectiveFrom} was saved for ${employee.firstName} ${employee.lastName || ""}.`,
      });

      const history =
        await CompensationRevision.find(
          {
            companyId:
              req.user.companyId,

            employeeId:
              employee._id,
          }
        )
          .populate(
            "changedByUserId",
            "firstName lastName email role"
          )
          .sort({
            effectiveFrom:
              -1,
          });

      const populated =
        await SalaryProfile.findById(
          profile._id
        ).populate(
          "employeeId",
          "firstName lastName employeeCode designation status"
        );

      res.json({
        ...populated.toObject(),

        compensationHistory:
          history,
      });
    } catch (error) {
      console.error(
        "Compensation revision error:",
        error
      );

      res.status(
        error.code ===
          11000
          ? 409
          : 500
      ).json({
        message:
          error.code ===
          11000
            ? "A salary revision already exists for this effective date."
            : "Unable to save compensation revision.",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| Payroll Runs
|--------------------------------------------------------------------------
*/

export const getPayrollRuns =
  async (req, res) => {
    try {
      const runs =
        await PayrollRun.find({
          companyId:
            req.user.companyId,
        }).sort({
          month:
            -1,
        });

      res.json(runs);
    } catch (error) {
      res.status(500).json({
        message:
          "Unable to load payroll runs.",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| Generate Payroll
|--------------------------------------------------------------------------
*/

export const generatePayroll =
  async (req, res) => {
    try {
      const month =
        String(
          req.body.month ||
            ""
        );

      const company =
        await Company.findById(
          req.user.companyId
        );

      if (!company) {
        return res
          .status(404)
          .json({
            message:
              "Company not found.",
          });
      }

      /*
      |--------------------------------------------------------------------------
      | Resolve Company Payroll Period
      |--------------------------------------------------------------------------
      */

      let payrollPeriod;

      try {
        payrollPeriod =
          resolvePayrollPeriod(
            month,
            company.payrollSettings ||
              {}
          );
      } catch (error) {
        return res
          .status(400)
          .json({
            message:
              error.message ||
              "Invalid payroll month.",
          });
      }

      const {
        periodStart,
        periodEnd,
      } =
        payrollPeriod;

      const periodCalendarDays =
        daysInclusive(
          periodStart,
          periodEnd
        );

      /*
      |--------------------------------------------------------------------------
      | Work Calendar
      |--------------------------------------------------------------------------
      */

      const overrides =
        await Holiday.find({
          companyId:
            company._id,

          $or: [
            {
              date: {
                $gte:
                  periodStart,

                $lte:
                  periodEnd,
              },
            },

            {
              date: {
                $lte:
                  periodEnd,
              },

              endDate: {
                $gte:
                  periodStart,
              },
            },
          ],
        }).sort({
          createdAt:
            1,
        });

      const calendarDays =
        buildWorkCalendar(
          company,
          overrides,
          periodStart,
          periodEnd
        );

      const calendarMap =
        new Map(
          calendarDays.map(
            (day) => [
              dateKeyUTC(
                day.date
              ),

              day,
            ]
          )
        );

      const calendarSummary =
        summarizeCalendar(
          calendarDays
        );

      /*
      |--------------------------------------------------------------------------
      | Existing Run
      |--------------------------------------------------------------------------
      */

      let run =
        await PayrollRun.findOne({
          companyId:
            req.user.companyId,

          month,
        });

      if (
        run &&
        run.status !==
          "draft"
      ) {
        return res
          .status(409)
          .json({
            message:
              "This payroll is finalized and cannot be regenerated.",
          });
      }

      const settings =
        company.payrollSettings ||
        {};

      const calculationSnapshot =
        {
          cycleType:
            settings.cycleType ||
            "calendar_month",

          cycleWindow:
            settings.cycleWindow ||
            "same_month",

          cycleStartDay:
            Number(
              settings.cycleStartDay ||
                1
            ),

          cycleEndDay:
            Number(
              settings.cycleEndDay ||
                31
            ),

          salaryCalculationBasis:
            settings.salaryCalculationBasis ||
            "fixed_30",

          salaryDayDivisor:
            Number(
              settings.salaryDayDivisor ||
                30
            ),

          deductAbsence:
            settings.deductAbsence !==
            false,

          deductUnpaidLeave:
            settings.deductUnpaidLeave !==
            false,

          deductHalfDay:
            settings.deductHalfDay !==
            false,

          overtimeEnabled:
            Boolean(
              settings.overtimeEnabled
            ),

          latePenaltyAmount:
            Number(
              settings.latePenaltyAmount ||
                0
            ),

          payDay:
            Number(
              settings.payDay ||
                5
            ),
        };

      if (!run) {
        run =
          await PayrollRun.create(
            {
              companyId:
                req.user.companyId,

              month,

              periodStart,

              periodEnd,

              generatedByUserId:
                req.user._id,

              notes:
                req.body.notes ||
                "",

              calculationSnapshot,

              calendarSummary,
            }
          );
      } else {
        run.periodStart =
          periodStart;

        run.periodEnd =
          periodEnd;

        run.generatedByUserId =
          req.user._id;

        run.notes =
          req.body.notes ??
          run.notes;

        run.calculationSnapshot =
          calculationSnapshot;

        run.calendarSummary =
          calendarSummary;

        await run.save();
      }

      /*
      |--------------------------------------------------------------------------
      | Rebuild Draft Entries
      |--------------------------------------------------------------------------
      */

      await PayrollEntry.deleteMany({
        companyId:
          req.user.companyId,

        payrollRunId:
          run._id,
      });

      /*
      |--------------------------------------------------------------------------
      | Employees
      |--------------------------------------------------------------------------
      */

      const employees =
        await Employee.find({
          companyId:
            req.user.companyId,

          joiningDate: {
            $lte:
              periodEnd,
          },

          $or: [
            {
              status: {
                $in: [
                  "active",
                  "on-notice",
                ],
              },
            },

            {
              lastWorkingDate: {
                $gte:
                  periodStart,
              },
            },
          ],
        }).populate(
          "departmentId",
          "name code"
        );

      const employeeIds =
        employees.map(
          (employee) =>
            employee._id
        );

      /*
      |--------------------------------------------------------------------------
      | Current Salary Profiles
      |--------------------------------------------------------------------------
      */

      const profiles =
        await SalaryProfile.find({
          companyId:
            req.user.companyId,

          employeeId: {
            $in:
              employeeIds,
          },
        });

      const profileMap =
        new Map(
          profiles.map(
            (profile) => [
              profile.employeeId.toString(),

              profile,
            ]
          )
        );

      /*
      |--------------------------------------------------------------------------
      | Compensation History
      |--------------------------------------------------------------------------
      |
      | Only revisions effective on/before payroll end
      | are relevant.
      |
      */

      const revisions =
        await CompensationRevision.find({
          companyId:
            req.user.companyId,

          employeeId: {
            $in:
              employeeIds,
          },

          effectiveFrom: {
            $lte:
              periodEnd,
          },
        }).sort({
          effectiveFrom:
            1,
        });

      const revisionMap =
        new Map();

      for (
        const revision of revisions
      ) {
        const key =
          revision.employeeId.toString();

        if (
          !revisionMap.has(
            key
          )
        ) {
          revisionMap.set(
            key,
            []
          );
        }

        revisionMap
          .get(key)
          .push(
            revision
          );
      }

      const entries =
        [];

      const skippedEmployees =
        [];

      /*
      |--------------------------------------------------------------------------
      | Employee Payroll
      |--------------------------------------------------------------------------
      */

      for (
        const employee of employees
      ) {
        const employeeKey =
          employee._id.toString();

        const fallbackSalary =
          profileMap.get(
            employeeKey
          );

        const salaryHistory =
          revisionMap.get(
            employeeKey
          ) ||
          [];

        if (
          !fallbackSalary &&
          salaryHistory.length ===
            0
        ) {
          skippedEmployees.push(
            {
              _id:
                employee._id,

              employeeCode:
                employee.employeeCode,

              name:
                `${employee.firstName} ${
                  employee.lastName ||
                  ""
                }`.trim(),

              reason:
                "Salary is not configured.",
            }
          );

          continue;
        }

        const entry =
          await buildEntry({
            company,

            employee,

            salaryHistory,

            fallbackSalary,

            periodStart,

            periodEnd,

            periodCalendarDays,

            totalWorkingDays:
              calendarSummary
                .workingDays,

            calendarMap,
          });

        if (
          entry?.error
        ) {
          skippedEmployees.push(
            {
              _id:
                employee._id,

              employeeCode:
                employee.employeeCode,

              name:
                `${employee.firstName} ${
                  employee.lastName ||
                  ""
                }`.trim(),

              reason:
                entry.error,
            }
          );

          continue;
        }

        if (entry) {
          entries.push({
            ...entry,

            payrollRunId:
              run._id,
          });
        }
      }

      if (
        entries.length
      ) {
        await PayrollEntry.insertMany(
          entries
        );
      }

      const saved =
        await PayrollEntry.find({
          payrollRunId:
            run._id,
        });

      run.employeeCount =
        saved.length;

      run.grossTotal =
        roundMoney(
          saved.reduce(
            (
              sum,
              entry
            ) =>
              sum +
              entry.grossPay,
            0
          )
        );

      run.deductionTotal =
        roundMoney(
          saved.reduce(
            (
              sum,
              entry
            ) =>
              sum +
              entry.totalDeductions,
            0
          )
        );

      run.netTotal =
        roundMoney(
          saved.reduce(
            (
              sum,
              entry
            ) =>
              sum +
              entry.netPay +
              entry.manualAdjustment,
            0
          )
        );

      await run.save();

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "payroll.generated",

        entity:
          "PayrollRun",

        entityId:
          run._id,

        description:
          `Draft payroll for ${run.month} was generated using period ${dateKeyUTC(
            periodStart
          )} to ${dateKeyUTC(
            periodEnd
          )}.`,
      });

      res.json({
        run,

        entries:
          await PayrollEntry.find(
            {
              payrollRunId:
                run._id,
            }
          ).sort({
            "employeeSnapshot.name":
              1,
          }),

        skippedEmployees,
      });
    } catch (error) {
      console.error(
        "Generate payroll error:",
        error
      );

      res.status(500).json({
        message:
          "Unable to generate payroll.",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| Get One Payroll
|--------------------------------------------------------------------------
*/

export const getPayrollRun =
  async (req, res) => {
    try {
      const run =
        await PayrollRun.findOne({
          _id:
            req.params.id,

          companyId:
            req.user.companyId,
        });

      if (!run) {
        return res
          .status(404)
          .json({
            message:
              "Payroll run not found.",
          });
      }

      const entries =
        await PayrollEntry.find({
          companyId:
            req.user.companyId,

          payrollRunId:
            run._id,
        }).sort({
          "employeeSnapshot.name":
            1,
        });

      res.json({
        run,
        entries,
      });
    } catch (error) {
      res.status(500).json({
        message:
          "Unable to load payroll details.",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| Adjustment
|--------------------------------------------------------------------------
*/

export const adjustPayrollEntry =
  async (req, res) => {
    try {
      const entry =
        await PayrollEntry.findOne({
          _id:
            req.params.id,

          companyId:
            req.user.companyId,
        });

      if (!entry) {
        return res
          .status(404)
          .json({
            message:
              "Payroll entry not found.",
          });
      }

      const run =
        await PayrollRun.findById(
          entry.payrollRunId
        );

      if (
        !run ||
        run.status !==
          "draft"
      ) {
        return res
          .status(409)
          .json({
            message:
              "Only draft payroll can be adjusted.",
          });
      }

      entry.manualAdjustment =
        roundMoney(
          Number(
            req.body
              .manualAdjustment ||
              0
          )
        );

      entry.adjustmentNote =
        String(
          req.body
            .adjustmentNote ||
            ""
        );

      await entry.save();

      const entries =
        await PayrollEntry.find({
          payrollRunId:
            run._id,
        });

      run.netTotal =
        roundMoney(
          entries.reduce(
            (
              sum,
              item
            ) =>
              sum +
              item.netPay +
              item.manualAdjustment,
            0
          )
        );

      await run.save();

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "payroll.entry_adjusted",

        entity:
          "PayrollEntry",

        entityId:
          entry._id,

        description:
          `Manual payroll adjustment was updated for ${entry.employeeSnapshot.name}.`,
      });

      res.json(entry);
    } catch (error) {
      res.status(500).json({
        message:
          "Unable to adjust payroll entry.",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| Finalize
|--------------------------------------------------------------------------
*/

export const finalizePayroll =
  async (req, res) => {
    try {
      const run =
        await PayrollRun.findOne({
          _id:
            req.params.id,

          companyId:
            req.user.companyId,
        });

      if (!run) {
        return res
          .status(404)
          .json({
            message:
              "Payroll run not found.",
          });
      }

      if (
        run.status !==
        "draft"
      ) {
        return res
          .status(409)
          .json({
            message:
              "Only draft payroll can be finalized.",
          });
      }

      if (
        !run.employeeCount
      ) {
        return res
          .status(400)
          .json({
            message:
              "Generate payroll entries before finalizing this run.",
          });
      }

      run.status =
        "finalized";

      run.finalizedByUserId =
        req.user._id;

      run.finalizedAt =
        new Date();

      await run.save();

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "payroll.finalized",

        entity:
          "PayrollRun",

        entityId:
          run._id,

        description:
          `Payroll for ${run.month} was finalized and locked.`,
      });

      res.json(run);
    } catch (error) {
      res.status(500).json({
        message:
          "Unable to finalize payroll.",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| Paid
|--------------------------------------------------------------------------
*/

export const markPayrollPaid =
  async (req, res) => {
    try {
      const run =
        await PayrollRun.findOne({
          _id:
            req.params.id,

          companyId:
            req.user.companyId,
        });

      if (!run) {
        return res
          .status(404)
          .json({
            message:
              "Payroll run not found.",
          });
      }

      if (
        run.status !==
        "finalized"
      ) {
        return res
          .status(409)
          .json({
            message:
              "Payroll must be finalized before it can be marked paid.",
          });
      }

      run.status =
        "paid";

      run.paidByUserId =
        req.user._id;

      run.paidAt =
        new Date();

      await run.save();

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "payroll.paid",

        entity:
          "PayrollRun",

        entityId:
          run._id,

        description:
          `Payroll for ${run.month} was marked as paid.`,
      });

      res.json(run);
    } catch (error) {
      res.status(500).json({
        message:
          "Unable to mark payroll as paid.",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| Employee Payslips
|--------------------------------------------------------------------------
*/

export const getMyPayslips =
  async (req, res) => {
    try {
      const employee =
        await getEmployeeForUser(
          req.user
        );

      if (!employee) {
        return res.json([]);
      }

      const runs =
        await PayrollRun.find({
          companyId:
            req.user.companyId,

          status: {
            $in: [
              "finalized",
              "paid",
            ],
          },
        }).select(
          "_id month status periodStart periodEnd paidAt finalizedAt calculationSnapshot calendarSummary"
        );

      const runMap =
        new Map(
          runs.map(
            (run) => [
              run._id.toString(),
              run,
            ]
          )
        );

      const entries =
        await PayrollEntry.find({
          companyId:
            req.user.companyId,

          employeeId:
            employee._id,

          payrollRunId: {
            $in:
              runs.map(
                (run) =>
                  run._id
              ),
          },
        }).sort({
          createdAt:
            -1,
        });

      res.json(
        entries.map(
          (entry) => ({
            ...entry.toObject(),

            run:
              runMap.get(
                entry.payrollRunId.toString()
              ),
          })
        )
      );
    } catch (error) {
      res.status(500).json({
        message:
          "Unable to load payslips.",
      });
    }
  };