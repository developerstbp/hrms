import Employee from "../models/Employees.js";
import Department from "../models/Department.js";
import LeaveRequest from "../models/LeaveRequest.js";
import Attendance from "../models/Attendance.js";
import Holiday from "../models/Holiday.js";
import Company from "../models/Company.js";
import Notification from "../models/Notification.js";
import EmployeeLifecycleEvent from "../models/EmployeeLifecycleEvent.js";
import ShiftAssignment from "../models/ShiftAssignment.js";

import {
  getEmployeeForUser,
  getScopedEmployeeIds,
} from "../utils/scope.js";

import {
  resolveCalendarDay,
} from "../utils/workCalendar.js";

import {
  getShiftAssignmentForDate,
} from "../utils/shifts.js";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const graphDateKey = (date) =>
  new Date(date)
    .toISOString()
    .slice(0, 10);

const graphDayStart = (date) => {
  const value =
    new Date(date);

  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate()
    )
  );
};

const graphDayEnd = (date) =>
  new Date(
    `${graphDateKey(
      date
    )}T23:59:59.999Z`
  );

const getWeekStart = (
  date
) => {
  const result =
    graphDayStart(
      date
    );

  const day =
    result.getUTCDay();

  const difference =
    day === 0
      ? -6
      : 1 - day;

  result.setUTCDate(
    result.getUTCDate() +
      difference
  );

  return result;
};

const getMonthStart = (
  date
) =>
  new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      1
    )
  );

const timeToMinutes = (
  value
) => {
  if (!value) {
    return 0;
  }

  const [
    hours,
    minutes,
  ] = String(
    value
  )
    .split(":")
    .map(Number);

  return (
    Number(hours || 0) *
      60 +
    Number(minutes || 0)
  );
};

const getExpectedShiftMinutes = (
  assignment
) => {
  const shift =
    assignment?.snapshot;

  if (
    !shift?.startTime ||
    !shift?.endTime
  ) {
    return 0;
  }

  const start =
    timeToMinutes(
      shift.startTime
    );

  let end =
    timeToMinutes(
      shift.endTime
    );

  // Overnight shift support
  if (
    end <= start
  ) {
    end +=
      24 * 60;
  }

  return Math.max(
    0,
    end - start
  );
};

const getAssignmentForGraphDate = (
  assignments,
  date
) => {
  const target =
    graphDayStart(
      date
    );

  return assignments.find(
    (
      assignment
    ) => {
      const from =
        graphDayStart(
          assignment.effectiveFrom
        );

      const to =
        assignment.effectiveTo
          ? graphDayEnd(
              assignment.effectiveTo
            )
          : null;

      return (
        target >= from &&
        (!to ||
          target <= to)
      );
    }
  );
};

const buildGraphSeries = ({
  startDate,
  endDate,
  attendanceMap,
  assignments,
  company,
  overrides,
}) => {
  const rows = [];

  const cursor =
    new Date(
      startDate
    );

  while (
    cursor <= endDate
  ) {
    const current =
      new Date(
        cursor
      );

    const key =
      graphDateKey(
        current
      );

    const record =
      attendanceMap.get(
        key
      );

    const assignment =
      getAssignmentForGraphDate(
        assignments,
        current
      );

    const calendar =
      resolveCalendarDay(
        company,
        overrides,
        current
      );

    const isLeave =
      record?.status ===
      "on-leave";

    const expectedMinutes =
      calendar.isWorkingDay &&
      !isLeave
        ? getExpectedShiftMinutes(
            assignment
          )
        : 0;

    const workedMinutes =
      Number(
        record?.workedMinutes ||
          0
      );

    let comparisonStatus =
      "off";

    if (isLeave) {
      comparisonStatus =
        "leave";
    } else if (
      calendar.isWorkingDay
    ) {
      comparisonStatus =
        workedMinutes >=
          expectedMinutes &&
        expectedMinutes >
          0
          ? "complete"
          : "short";
    }

    rows.push({
      date:
        key,

      day:
        current.toLocaleDateString(
          "en",
          {
            weekday:
              "short",
            timeZone:
              "UTC",
          }
        ),

      dateLabel:
        current.toLocaleDateString(
          "en",
          {
            day:
              "2-digit",
            month:
              "short",
            timeZone:
              "UTC",
          }
        ),

      workedMinutes,

      expectedMinutes,

      workedHours:
        Number(
          (
            workedMinutes /
            60
          ).toFixed(
            2
          )
        ),

      expectedHours:
        Number(
          (
            expectedMinutes /
            60
          ).toFixed(
            2
          )
        ),

      attendanceStatus:
        record?.status ||
        "",

      comparisonStatus,

      workMode:
        calendar.workMode ||
        "",

      dayType:
        calendar.dayType,

      calendarLabel:
        calendar.label,

      shiftName:
        assignment?.snapshot
          ?.name ||
        "",

      shiftStart:
        assignment?.snapshot
          ?.startTime ||
        "",

      shiftEnd:
        assignment?.snapshot
          ?.endTime ||
        "",
    });

    cursor.setUTCDate(
      cursor.getUTCDate() +
        1
    );
  }

  return rows;
};

const localDateKey = (
  timeZone = "Asia/Karachi",
  value = new Date()
) => {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(
      value
    );

  const map =
    Object.fromEntries(
      parts
        .filter(
          (part) =>
            part.type !==
            "literal"
        )
        .map(
          (part) => [
            part.type,
            part.value,
          ]
        )
    );

  return `${map.year}-${map.month}-${map.day}`;
};

const startOfDateKey = (
  key
) =>
  new Date(
    `${key}T00:00:00.000Z`
  );

const endOfDateKey = (
  key
) =>
  new Date(
    `${key}T23:59:59.999Z`
  );

const nextSaturday = (
  date
) => {
  const result =
    new Date(
      date
    );

  const diff =
    (
      6 -
      result.getUTCDay() +
      7
    ) %
      7 ||
    7;

  result.setUTCDate(
    result.getUTCDate() +
      diff
  );

  return result;
};

/*
|--------------------------------------------------------------------------
| Dashboard
|--------------------------------------------------------------------------
*/

export const getDashboard =
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

      const actorEmployee =
        await getEmployeeForUser(
          req.user
        );

      const scopedIds =
        await getScopedEmployeeIds(
          req.user,
          true
        );

      let dashboardEmployee =
        actorEmployee;

      if (
        req.query.employeeId
      ) {
        if (
          req.user.role !==
          "admin"
        ) {
          return res
            .status(403)
            .json({
              message:
                "Only an administrator can open another employee's dashboard.",
            });
        }

        dashboardEmployee =
          await Employee.findOne({
            _id:
              req.query.employeeId,

            companyId:
              req.user.companyId,
          })
            .populate(
              "departmentId",
              "name code"
            )
            .populate(
              "managerId",
              "firstName lastName employeeCode"
            )
            .populate(
              "designationId",
              "name"
            );

        if (
          !dashboardEmployee
        ) {
          return res
            .status(404)
            .json({
              message:
                "Employee not found.",
            });
        }
      } else if (
        actorEmployee
      ) {
        dashboardEmployee =
          await Employee.findById(
            actorEmployee._id
          )
            .populate(
              "departmentId",
              "name code"
            )
            .populate(
              "managerId",
              "firstName lastName employeeCode"
            )
            .populate(
              "designationId",
              "name"
            );
      }

      const todayKey =
        localDateKey(
          company.timezone ||
          "Asia/Karachi"
        );

      const today =
        startOfDateKey(
          todayKey
        );

      const todayEnd =
        endOfDateKey(
          todayKey
        );

      /*
      |--------------------------------------------------------------------------
      | Scope
      |--------------------------------------------------------------------------
      */

      const employeeScope = {
        companyId:
          req.user.companyId,
      };

      const leaveScope = {
        companyId:
          req.user.companyId,
      };

      const attendanceScope = {
        companyId:
          req.user.companyId,

        dateKey:
          todayKey,
      };

      if (
        scopedIds
      ) {
        employeeScope._id = {
          $in:
            scopedIds,
        };

        leaveScope.employeeId = {
          $in:
            scopedIds,
        };

        attendanceScope.employeeId = {
          $in:
            scopedIds,
        };
      }

      /*
      |--------------------------------------------------------------------------
      | Department Scope
      |--------------------------------------------------------------------------
      */

      let departmentQuery = {
        companyId:
          req.user.companyId,

        isActive:
          true,
      };

      if (
        ![
          "admin",
          "hr",
        ].includes(
          req.user.role
        )
      ) {
        if (
          req.user.role ===
            "hod" &&
          actorEmployee
        ) {
          const headed =
            await Department.distinct(
              "_id",
              {
                companyId:
                  req.user
                    .companyId,

                hodId:
                  actorEmployee
                    ._id,
              }
            );

          departmentQuery =
            headed.length
              ? {
                  companyId:
                    req.user
                      .companyId,

                  isActive:
                    true,

                  _id: {
                    $in:
                      headed,
                  },
                }
              : {
                  companyId:
                    req.user
                      .companyId,

                  isActive:
                    true,

                  _id:
                    actorEmployee
                      .departmentId,
                };
        } else if (
          actorEmployee
        ) {
          departmentQuery = {
            companyId:
              req.user.companyId,

            isActive:
              true,

            _id:
              actorEmployee
                .departmentId,
          };
        } else {
          departmentQuery = {
            companyId:
              req.user.companyId,

            _id:
              null,
          };
        }
      }

      /*
      |--------------------------------------------------------------------------
      | Date Windows
      |--------------------------------------------------------------------------
      */

      const next30 =
        new Date(
          today
        );

      next30.setUTCDate(
        next30.getUTCDate() +
          30
      );

      const saturday =
        nextSaturday(
          today
        );

      const calendarEnd =
        saturday >
        next30
          ? saturday
          : next30;

      /*
      |--------------------------------------------------------------------------
      | Dashboard Data
      |--------------------------------------------------------------------------
      */

      const [
        employeeCount,
        activeEmployeeCount,
        departmentCount,
        pendingLeaves,
        employeesOnLeave,
        employeesOnNotice,
        attendanceRecords,
        openAttendanceExceptions,
        upcomingHolidays,
        recentLeaves,
        calendarOverrides,
        unreadNotifications,
        recentMovements,
      ] =
        await Promise.all([
          Employee.countDocuments(
            employeeScope
          ),

          Employee.countDocuments({
            ...employeeScope,

            status:
              "active",
          }),

          Department.countDocuments(
            departmentQuery
          ),

          LeaveRequest.countDocuments({
            ...leaveScope,

            status: {
              $in: [
                "pending",
                "pending_hr",
                "under_review",
                "more_info_required",
                "on_hold",
              ],
            },
          }),

          LeaveRequest.countDocuments({
            ...leaveScope,

            status:
              "approved",

            startDate: {
              $lte:
                todayEnd,
            },

            endDate: {
              $gte:
                today,
            },
          }),

          Employee.countDocuments({
            ...employeeScope,

            status:
              "on-notice",
          }),

          Attendance.find(
            attendanceScope
          ).select(
            [
              "employeeId",
              "status",
              "checkIn",
              "checkOut",
              "isException",
              "exceptionResolved",
              "lateMinutes",
              "workMode",
              "calendarLabel",
            ].join(" ")
          ),

          Attendance.countDocuments({
            ...attendanceScope,

            isException:
              true,

            exceptionResolved:
              false,
          }),

          Holiday.find({
            companyId:
              req.user
                .companyId,

            date: {
              $gte:
                today,

              $lte:
                next30,
            },

            type: {
              $in: [
                "public",
                "company",
                "optional",
              ],
            },
          })
            .sort({
              date:
                1,
            })
            .limit(
              8
            ),

          LeaveRequest.find(
            leaveScope
          )
            .populate(
              "employeeId",
              "firstName lastName employeeCode"
            )
            .populate(
              "leaveTypeId",
              "name"
            )
            .sort({
              createdAt:
                -1,
            })
            .limit(
              6
            ),

          Holiday.find({
            companyId:
              req.user
                .companyId,

            date: {
              $lte:
                calendarEnd,
            },

            $or: [
              {
                endDate:
                  null,
              },

              {
                endDate: {
                  $gte:
                    today,
                },
              },
            ],
          }).sort({
            createdAt:
              1,
          }),

          Notification.countDocuments({
            companyId:
              req.user
                .companyId,

            userId:
              req.user
                ._id,

            isRead:
              false,
          }),

          EmployeeLifecycleEvent.find({
            companyId:
              req.user
                .companyId,

            ...(
              scopedIds
                ? {
                    employeeId: {
                      $in:
                        scopedIds,
                    },
                  }
                : {}
            ),
          })
            .populate(
              "employeeId",
              "firstName lastName employeeCode"
            )
            .sort({
              effectiveDate:
                -1,

              createdAt:
                -1,
            })
            .limit(
              5
            ),
        ]);

      /*
      |--------------------------------------------------------------------------
      | Attendance Summary
      |--------------------------------------------------------------------------
      */

      const attendanceBreakdown =
        attendanceRecords.reduce(
          (
            accumulator,
            record
          ) => {
            accumulator[
              record.status
            ] =
              (
                accumulator[
                  record.status
                ] ||
                0
              ) +
              1;

            return accumulator;
          },
          {}
        );

      /*
      |--------------------------------------------------------------------------
      | Work Calendar Summary
      |--------------------------------------------------------------------------
      */

      const todayCalendar =
        resolveCalendarDay(
          company,
          calendarOverrides,
          today
        );

      const nextSaturdayCalendar =
        resolveCalendarDay(
          company,
          calendarOverrides,
          saturday
        );

      /*
      |--------------------------------------------------------------------------
      | Logged-in Employee Summary
      |--------------------------------------------------------------------------
      */

      const myTodayAttendance =
        dashboardEmployee
          ? await Attendance.findOne(
              {
                companyId:
                  req.user
                    .companyId,

                employeeId:
                  dashboardEmployee
                    ._id,

                dateKey:
                  todayKey,
              }
            )
          : null;

      const myShift =
        dashboardEmployee
          ? await getShiftAssignmentForDate(
              req.user
                .companyId,

              dashboardEmployee
                ._id,

              today
            )
          : null;

      let attendanceGraph = {
        weekly: [],
        monthly: [],
      };

      if (dashboardEmployee) {
        const now =
          new Date();

        const today =
          graphDayStart(
            now
          );

        const weekStart =
          getWeekStart(
            now
          );

        const monthStart =
          getMonthStart(
            now
          );

        const rangeStart =
          weekStart <
          monthStart
            ? weekStart
            : monthStart;

        const rangeEnd =
          graphDayEnd(
            today
          );

        const [
          graphAttendance,
          graphAssignments,
          graphOverrides,
        ] =
          await Promise.all([
            Attendance.find({
              companyId:
                req.user.companyId,

              employeeId:
                dashboardEmployee._id,

              date: {
                $gte:
                  rangeStart,

                $lte:
                  rangeEnd,
              },
            }).lean(),

            ShiftAssignment.find({
              companyId:
                req.user.companyId,

              employeeId:
                actorEmployee._id,

              effectiveFrom: {
                $lte:
                  rangeEnd,
              },

              $or: [
                {
                  effectiveTo:
                    null,
                },

                {
                  effectiveTo: {
                    $gte:
                      rangeStart,
                  },
                },
              ],
            })
              .sort({
                effectiveFrom:
                  -1,
              })
              .lean(),

            Holiday.find({
              companyId:
                req.user.companyId,

              date: {
                $lte:
                  rangeEnd,
              },

              $or: [
                {
                  endDate: {
                    $gte:
                      rangeStart,
                  },
                },

                {
                  endDate:
                    null,
                },
              ],
            }).lean(),
          ]);

        const attendanceMap =
          new Map(
            graphAttendance.map(
              (
                record
              ) => [
                record.dateKey ||
                  graphDateKey(
                    record.date
                  ),

                record,
              ]
            )
          );

        attendanceGraph = {
          weekly:
            buildGraphSeries({
              startDate:
                weekStart,

              endDate:
                today,

              attendanceMap,

              assignments:
                graphAssignments,

              company,

              overrides:
                graphOverrides,
            }),

          monthly:
            buildGraphSeries({
              startDate:
                monthStart,

              endDate:
                today,

              attendanceMap,

              assignments:
                graphAssignments,

              company,

              overrides:
                graphOverrides,
            }),
        };
      }

      const viewedEmployeeRecentLeaves =
        dashboardEmployee
          ? await LeaveRequest.find({
              companyId:
                req.user.companyId,

              employeeId:
                dashboardEmployee._id,
            })
              .populate(
                "leaveTypeId",
                "name code"
              )
              .sort({
                createdAt:
                  -1,
              })
              .limit(
                5
              )
          : [];

      /*
      |--------------------------------------------------------------------------
      | Response
      |--------------------------------------------------------------------------
      */

      res.json({
        dateKey:
          todayKey,
          viewedEmployee:
          dashboardEmployee,

        viewedEmployeeRecentLeaves,

        stats: {
          employeeCount,

          activeEmployeeCount,

          departmentCount,

          pendingLeaves,

          employeesOnLeave,

          employeesOnNotice,

          todayAttendance:
            attendanceRecords.length,

          openAttendanceExceptions,

          unreadNotifications,

          attendanceBreakdown,
        },

        attendanceGraph,

        workCalendar: {
          today:
            todayCalendar,

          nextSaturday: {
            ...nextSaturdayCalendar,

            date:
              saturday,
          },
        },

        upcomingHolidays,

        recentLeaves,

        recentMovements,

        myTodayAttendance,

        myShift,
      });
    } catch (error) {
      console.error(
        "Dashboard error:",
        error
      );

      res
        .status(500)
        .json({
          message:
            "Unable to load dashboard.",
        });
    }
  };