import Attendance from "../models/Attendance.js";
import RawAttendancePunch from "../models/RawAttendancePunch.js";
import LeaveRequest from "../models/LeaveRequest.js";
import Holiday from "../models/Holiday.js";

import {
  dateOnly,
  dateKeyUTC,
  getShiftAssignmentForDate,
  timeToMinutes,
  workedMinutes
} from "../utils/shifts.js";

import {
  resolveCalendarDay
} from "../utils/workCalendar.js";

const endOfDay = (value) => {
  const date = dateOnly(value);

  date.setUTCHours(
    23,
    59,
    59,
    999
  );

  return date;
};

const scheduledDuration = (
  start,
  end,
  breakMinutes = 0
) => {
  if (
    !start ||
    !end
  ) {
    return 0;
  }

  const startMinutes =
    timeToMinutes(start);

  let endMinutes =
    timeToMinutes(end);

  if (
    endMinutes <
    startMinutes
  ) {
    endMinutes +=
      24 * 60;
  }

  return Math.max(
    0,

    endMinutes -
      startMinutes -
      Number(
        breakMinutes ||
        0
      )
  );
};

const normalizeActualEnd = (
  checkIn,
  checkOut
) => {
  if (
    !checkIn ||
    !checkOut
  ) {
    return null;
  }

  const start =
    timeToMinutes(
      checkIn
    );

  let end =
    timeToMinutes(
      checkOut
    );

  if (
    end < start
  ) {
    end +=
      24 * 60;
  }

  return end;
};

const normalizeScheduledEnd = (
  startTime,
  endTime
) => {
  const start =
    timeToMinutes(
      startTime
    );

  let end =
    timeToMinutes(
      endTime
    );

  if (
    end < start
  ) {
    end +=
      24 * 60;
  }

  return end;
};

/*
|--------------------------------------------------------------------------
| Get Raw Punches
|--------------------------------------------------------------------------
*/

export const getPunchTimesForDate =
  async (
    companyId,
    employeeId,
    dateKey
  ) => {
    const punches =
      await RawAttendancePunch.find({
        companyId,
        employeeId,
        dateKey
      }).sort({
        time: 1,
        createdAt: 1
      });

    if (
      !punches.length
    ) {
      return {
        checkIn: null,
        checkOut: null,
        punches: []
      };
    }

    const ins =
      punches.filter(
        (punch) =>
          punch.punchType ===
          "in"
      );

    const outs =
      punches.filter(
        (punch) =>
          punch.punchType ===
          "out"
      );

    const unknown =
      punches.filter(
        (punch) =>
          punch.punchType ===
          "unknown"
      );

    const checkIn =
      ins[0]?.time ||
      unknown[0]?.time ||
      null;

    let checkOut =
      outs[
        outs.length - 1
      ]?.time ||
      null;

    if (
      !checkOut &&
      unknown.length > 1
    ) {
      checkOut =
        unknown[
          unknown.length - 1
        ].time;
    }

    return {
      checkIn,
      checkOut,
      punches
    };
  };

/*
|--------------------------------------------------------------------------
| Process One Employee Day
|--------------------------------------------------------------------------
*/

export const processAttendanceDay =
  async ({
    company,
    employeeId,
    date,
    actorUserId = null,
    source = "system",
    importBatchId = null,
    manualInput = null,
    force = false,
    allowOpenPunch = false
  }) => {
    const day =
      dateOnly(date);

    const dateKey =
      dateKeyUTC(day);

    const existing =
      await Attendance.findOne({
        companyId:
          company._id,

        employeeId,

        dateKey
      });

    /*
      HR manual corrections remain locked
      during normal imports and reprocessing.
    */

    if (
      existing?.manualOverride &&
      !force &&
      !manualInput
    ) {
      return {
        record:
          existing,

        skippedManualOverride:
          true
      };
    }

    const [
      assignment,
      overrides,
      leave
    ] =
      await Promise.all([
        getShiftAssignmentForDate(
          company._id,
          employeeId,
          day
        ),

        Holiday.find({
          companyId:
            company._id,

          $or: [
            {
              date: {
                $gte:
                  day,

                $lte:
                  endOfDay(
                    day
                  )
              }
            },

            {
              date: {
                $lte:
                  endOfDay(
                    day
                  )
              },

              endDate: {
                $gte:
                  day
              }
            }
          ]
        }).sort({
          createdAt:
            1
        }),

        LeaveRequest.findOne({
          companyId:
            company._id,

          employeeId,

          status:
            "approved",

          startDate: {
            $lte:
              endOfDay(
                day
              )
          },

          endDate: {
            $gte:
              day
          }
        }).populate(
          "leaveTypeId",
          "name code isPaid"
        )
      ]);

    /*
    |--------------------------------------------------------------------------
    | Work Calendar
    |--------------------------------------------------------------------------
    */

    const calendar =
      resolveCalendarDay(
        company,
        overrides,
        day
      );

    /*
    |--------------------------------------------------------------------------
    | Punches
    |--------------------------------------------------------------------------
    */

    const punchInfo =
      manualInput
        ? {
            checkIn:
              manualInput
                .checkIn ||
              null,

            checkOut:
              manualInput
                .checkOut ||
              null,

            punches:
              []
          }
        : await getPunchTimesForDate(
            company._id,
            employeeId,
            dateKey
          );

    const checkIn =
      punchInfo.checkIn ||
      null;

    const checkOut =
      punchInfo.checkOut ||
      null;

    /*
    |--------------------------------------------------------------------------
    | Shift
    |--------------------------------------------------------------------------
    */

    const scheduledStart =
      assignment?.snapshot
        ?.startTime ||
      company.workStartTime ||
      "09:00";

    const scheduledEnd =
      assignment?.snapshot
        ?.endTime ||
      company.workEndTime ||
      "18:00";

    const breakMinutes =
      Number(
        assignment?.snapshot
          ?.breakMinutes ||
        0
      );

    const graceMinutes =
      Number(
        assignment?.snapshot
          ?.graceMinutes ??
        company.graceMinutes ??
        0
      );

    const scheduledMinutes =
      scheduledDuration(
        scheduledStart,
        scheduledEnd,
        breakMinutes
      );

    /*
    |--------------------------------------------------------------------------
    | Worked Minutes
    |--------------------------------------------------------------------------
    */

    const grossWorked =
      checkIn &&
      checkOut
        ? workedMinutes(
            checkIn,
            checkOut
          )
        : 0;

    const effectiveWorked =
      checkIn &&
      checkOut
        ? Math.max(
            0,

            grossWorked -
              breakMinutes
          )
        : 0;

    /*
    |--------------------------------------------------------------------------
    | Late / Early / Overtime
    |--------------------------------------------------------------------------
    */

    let lateMinutes = 0;
    let earlyExitMinutes = 0;
    let overtimeMinutes = 0;

    if (
      calendar.isWorkingDay &&
      checkIn
    ) {
      lateMinutes =
        Math.max(
          0,

          timeToMinutes(
            checkIn
          ) -
            (
              timeToMinutes(
                scheduledStart
              ) +
              graceMinutes
            )
        );
    }

    if (
      calendar.isWorkingDay &&
      checkIn &&
      checkOut
    ) {
      const actualEnd =
        normalizeActualEnd(
          checkIn,
          checkOut
        );

      const expectedEnd =
        normalizeScheduledEnd(
          scheduledStart,
          scheduledEnd
        );

      earlyExitMinutes =
        Math.max(
          0,
          expectedEnd -
            actualEnd
        );

      overtimeMinutes =
        Math.max(
          0,
          actualEnd -
            expectedEnd
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Status Processing
    |--------------------------------------------------------------------------
    */

    const exceptions = [];

    const hasPunch =
      Boolean(
        checkIn ||
        checkOut
      );

    const hasCompletePunch =
      Boolean(
        checkIn &&
        checkOut
      );

    const halfDayThreshold =
      Math.max(
        1,

        Math.floor(
          scheduledMinutes *
            0.5
        )
      );

    let status;

    /*
      HR explicitly selected status.
    */

    if (
      manualInput?.status &&
      manualInput.status !==
        "auto"
    ) {
      status =
        manualInput.status;
    }

    /*
      Approved leave + no punches.
    */

    else if (
      leave &&
      !hasPunch
    ) {
      status =
        "on-leave";
    }

    /*
      Holiday / weekly off
      without punches.
    */

    else if (
      !calendar.isWorkingDay &&
      !hasPunch
    ) {
      status =
        [
          "holiday",
          "optional_holiday"
        ].includes(
          calendar.dayType
        )
          ? "holiday"
          : "off";
    }

    /*
      Employee worked on
      non-working date.
    */

    else if (
      !calendar.isWorkingDay &&
      hasPunch
    ) {
      status =
        "present";

      exceptions.push(
        [
          "holiday",
          "optional_holiday"
        ].includes(
          calendar.dayType
        )
          ? "worked_on_holiday"
          : "worked_on_non_working_day"
      );
    }

    /*
      Working day but
      no attendance.
    */

    else if (
      !checkIn &&
      !checkOut
    ) {
      status =
        "absent";

      exceptions.push(
        "absent"
      );
    }

    /*
      Missing one punch.
    */

    else if (
      !hasCompletePunch
    ) {
      /*
        Self check-in is allowed to
        remain open during the work day.
      */

      if (
        allowOpenPunch &&
        checkIn &&
        !checkOut
      ) {
        status =
          lateMinutes > 0
            ? "late"
            : "present";

        if (
          lateMinutes > 0
        ) {
          exceptions.push(
            "late_arrival"
          );
        }
      } else {
        status =
          "incomplete";

        if (!checkIn) {
          exceptions.push(
            "missing_check_in"
          );
        }

        if (!checkOut) {
          exceptions.push(
            "missing_check_out"
          );
        }
      }
    }

    /*
      Less than half
      expected working time.
    */

    else if (
      effectiveWorked <
      halfDayThreshold
    ) {
      status =
        "half-day";

      exceptions.push(
        "half_day_hours"
      );
    }

    /*
      Late arrival.
    */

    else if (
      lateMinutes > 0
    ) {
      status =
        "late";

      exceptions.push(
        "late_arrival"
      );
    }

    else {
      status =
        "present";
    }

    /*
    |--------------------------------------------------------------------------
    | Additional Exceptions
    |--------------------------------------------------------------------------
    */

    if (
      calendar.isWorkingDay &&
      !assignment
    ) {
      exceptions.push(
        "no_shift_assignment"
      );
    }

    if (
      calendar.isWorkingDay &&
      earlyExitMinutes > 0 &&
      hasCompletePunch
    ) {
      exceptions.push(
        "early_exit"
      );
    }

    if (
      leave &&
      hasPunch
    ) {
      exceptions.push(
        "attendance_during_approved_leave"
      );
    }

    const uniqueExceptions =
      [
        ...new Set(
          exceptions
        )
      ];

    const manualOverride =
      Boolean(
        manualInput
      );

    const resolved =
      manualInput
        ?.resolveException ===
      true
        ? true
        : uniqueExceptions.length ===
          0;

    /*
    |--------------------------------------------------------------------------
    | Save Processed Attendance
    |--------------------------------------------------------------------------
    */

    const payload = {
      companyId:
        company._id,

      employeeId,

      date:
        day,

      dateKey,

      checkIn,

      checkOut,

      shiftAssignmentId:
        assignment?._id ||
        null,

      shiftName:
        assignment?.snapshot
          ?.name ||
        "Company default",

      scheduledStart,

      scheduledEnd,

      scheduledMinutes,

      breakMinutes,

      graceMinutes,

      dayType:
        calendar.dayType,

      workMode:
        calendar.workMode ||
        "",

      calendarLabel:
        calendar.label ||
        "",

      isWorkingDay:
        Boolean(
          calendar.isWorkingDay
        ),

      workedMinutes:
        effectiveWorked,

      lateMinutes,

      earlyExitMinutes,

      overtimeMinutes,

      status,

      exceptionCodes:
        uniqueExceptions,

      isException:
        uniqueExceptions.length >
        0,

      exceptionResolved:
        resolved,

      resolutionNote:
        manualInput
          ?.resolutionNote ||
        (
          resolved
            ? existing
                ?.resolutionNote ||
              ""
            : ""
        ),

      notes:
        manualInput?.notes ??
        existing?.notes ??
        "",

      source:
        manualInput
          ? "manual"
          : importBatchId
            ? "excel"
            : existing?.source ||
              source,

      importBatchId:
        importBatchId ||
        existing?.importBatchId ||
        null,

      manualOverride,

      overrideReason:
        manualInput
          ?.overrideReason ||
        (
          manualOverride
            ? "Manual attendance correction"
            : ""
        ),

      processedAt:
        new Date(),

      processedByUserId:
        actorUserId ||
        null
    };

    const record =
      await Attendance.findOneAndUpdate(
        {
          companyId:
            company._id,

          employeeId,

          dateKey
        },

        payload,

        {
          upsert:
            true,

          returnDocument:
            "after",

          setDefaultsOnInsert:
            true,

          runValidators:
            true
        }
      );

    return {
      record,

      skippedManualOverride:
        false
    };
  };