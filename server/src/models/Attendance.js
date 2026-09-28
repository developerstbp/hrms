import mongoose from "mongoose";

/*
|--------------------------------------------------------------------------
| Attendance
|--------------------------------------------------------------------------
|
| This collection stores the FINAL / PROCESSED attendance result
| for one employee on one date.
|
| Raw Excel / biometric punches will be handled separately.
|
*/

const attendanceSchema =
  new mongoose.Schema(
    {
      companyId: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref:
          "Company",

        required:
          true,

        index:
          true,
      },

      employeeId: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref:
          "Employee",

        required:
          true,

        index:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Attendance Date
      |--------------------------------------------------------------------------
      */

      date: {
        type: Date,
        required:
          true,

        index:
          true,
      },

      dateKey: {
        type: String,
        required:
          true,

        index:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Actual Time
      |--------------------------------------------------------------------------
      */

      checkIn: {
        type: String,
        default:
          null,
      },

      checkOut: {
        type: String,
        default:
          null,
      },

      workedMinutes: {
        type: Number,
        default:
          0,
        min:
          0,
      },

      /*
      |--------------------------------------------------------------------------
      | Shift Snapshot
      |--------------------------------------------------------------------------
      |
      | Keeps historical attendance correct even if shift changes later.
      |
      */

      shiftAssignmentId: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref:
          "ShiftAssignment",

        default:
          null,
      },

      shiftName: {
        type: String,
        default:
          "",
      },

      scheduledStart: {
        type: String,
        default:
          "",
      },

      scheduledEnd: {
        type: String,
        default:
          "",
      },

      scheduledMinutes: {
        type: Number,
        default:
          0,
        min:
          0,
      },

      breakMinutes: {
        type: Number,
        default:
          0,
        min:
          0,
      },

      /*
      |--------------------------------------------------------------------------
      | Calendar Context
      |--------------------------------------------------------------------------
      */

      workMode: {
        type: String,

        enum: [
          "",
          "office",
          "wfh",
        ],

        default:
          "",
      },

      calendarLabel: {
        type: String,
        default:
          "",
      },

      /*
      |--------------------------------------------------------------------------
      | Status
      |--------------------------------------------------------------------------
      */

      status: {
        type: String,

        enum: [
          "present",
          "late",
          "half-day",
          "absent",
          "on-leave",
          "off",
          "holiday",
          "incomplete",
        ],

        default:
          "present",

        index:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Exceptions
      |--------------------------------------------------------------------------
      |
      | Examples:
      | Missing check-out
      | Missing check-in
      | Short hours
      | Invalid punch
      |
      */

      isException: {
        type: Boolean,
        default:
          false,

        index:
          true,
      },

      exceptionType: {
        type: String,

        enum: [
          "",
          "missing-check-in",
          "missing-check-out",
          "short-hours",
          "invalid-time",
          "duplicate-punch",
          "other",
        ],

        default:
          "",
      },

      exceptionReason: {
        type: String,
        default:
          "",
        trim:
          true,
      },

      exceptionResolved: {
        type: Boolean,
        default:
          false,

        index:
          true,
      },

      exceptionResolvedAt: {
        type: Date,
        default:
          null,
      },

      exceptionResolvedByUserId: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref:
          "User",

        default:
          null,
      },

      resolutionNote: {
        type: String,
        default:
          "",
        trim:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Source
      |--------------------------------------------------------------------------
      */

      source: {
        type: String,

        enum: [
          "self",
          "manual",
          "excel",
          "biometric",
          "system",
        ],

        default:
          "manual",

        index:
          true,
      },

      importBatchId: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref:
          "AttendanceImportBatch",

        default:
          null,
      },

      /*
      |--------------------------------------------------------------------------
      | Processing
      |--------------------------------------------------------------------------
      */

      processedAt: {
        type: Date,
        default:
          null,
      },

      processedByUserId: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref:
          "User",

        default:
          null,
      },

      /*
      |--------------------------------------------------------------------------
      | Notes
      |--------------------------------------------------------------------------
      */

      notes: {
        type: String,
        default:
          "",
        trim:
          true,
      },
    },

    {
      timestamps:
        true,
    }
  );

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

attendanceSchema.index(
  {
    companyId:
      1,

    employeeId:
      1,

    dateKey:
      1,
  },

  {
    unique:
      true,
  }
);

attendanceSchema.index({
  companyId:
    1,

  date:
    -1,

  status:
    1,
});

attendanceSchema.index({
  companyId:
    1,

  isException:
    1,

  exceptionResolved:
    1,

  date:
    -1,
});

const Attendance =
  mongoose.models
    .Attendance ||
  mongoose.model(
    "Attendance",
    attendanceSchema
  );

export default Attendance;