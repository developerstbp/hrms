import mongoose from "mongoose";

/*
|--------------------------------------------------------------------------
| Attendance Punch
|--------------------------------------------------------------------------
|
| Raw attendance event.
|
| Examples:
|
| 10:02 AM  -> Punch
| 01:15 PM  -> Punch
| 06:34 PM  -> Punch
|
| Processor later decides:
|
| First punch = Check In
| Last punch  = Check Out
|
| Final result is stored in Attendance.js
|
*/

const attendancePunchSchema =
  new mongoose.Schema(
    {
      companyId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          "Company",

        required:
          true,

        index:
          true,
      },

      employeeId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          "Employee",

        required:
          true,

        index:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Employee Snapshot
      |--------------------------------------------------------------------------
      |
      | Helpful for import history and debugging.
      |
      */

      employeeCode: {
        type: String,
        required:
          true,

        trim:
          true,

        index:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Punch Date / Time
      |--------------------------------------------------------------------------
      */

      punchTime: {
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
      | Punch Type
      |--------------------------------------------------------------------------
      |
      | Excel may explicitly provide IN / OUT.
      |
      | Biometric devices may only provide timestamps.
      | In that case type stays "unknown".
      |
      */

      punchType: {
        type: String,

        enum: [
          "in",
          "out",
          "unknown",
        ],

        default:
          "unknown",

        index:
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
          "excel",
          "biometric",
          "manual",
          "self",
        ],

        default:
          "excel",

        index:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Import Batch
      |--------------------------------------------------------------------------
      */

      importBatchId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          "AttendanceImportBatch",

        default:
          null,

        index:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Biometric Device
      |--------------------------------------------------------------------------
      |
      | Will be useful later for ZKTeco.
      |
      */

      deviceId: {
        type: String,
        default:
          "",

        trim:
          true,
      },

      deviceUserId: {
        type: String,
        default:
          "",

        trim:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Processing
      |--------------------------------------------------------------------------
      */

      processed: {
        type: Boolean,
        default:
          false,

        index:
          true,
      },

      processedAt: {
        type: Date,
        default:
          null,
      },

      attendanceId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          "Attendance",

        default:
          null,
      },

      /*
      |--------------------------------------------------------------------------
      | Duplicate Tracking
      |--------------------------------------------------------------------------
      */

      isDuplicate: {
        type: Boolean,
        default:
          false,
      },

      /*
      |--------------------------------------------------------------------------
      | Original Data
      |--------------------------------------------------------------------------
      |
      | Keeps source information without affecting normal HR UI.
      |
      */

      rawData: {
        type:
          mongoose.Schema.Types.Mixed,

        default: {},
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

attendancePunchSchema.index({
  companyId:
    1,

  employeeId:
    1,

  dateKey:
    1,

  punchTime:
    1,
});

/*
|--------------------------------------------------------------------------
| Duplicate Protection
|--------------------------------------------------------------------------
|
| Exact same employee + exact same punch timestamp should normally
| not be imported twice.
|
*/

attendancePunchSchema.index(
  {
    companyId:
      1,

    employeeId:
      1,

    punchTime:
      1,
  },

  {
    unique:
      true,
  }
);

attendancePunchSchema.index({
  companyId:
    1,

  processed:
    1,

  dateKey:
    1,
});

const AttendancePunch =
  mongoose.models.AttendancePunch ||
  mongoose.model(
    "AttendancePunch",
    attendancePunchSchema
  );

export default AttendancePunch;