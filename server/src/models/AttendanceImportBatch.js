import mongoose from "mongoose";

/*
|--------------------------------------------------------------------------
| Attendance Import Batch
|--------------------------------------------------------------------------
|
| One uploaded Excel file = one import batch.
|
| Example:
|
| File: September_Attendance.xlsx
| Rows: 240
| Valid: 232
| Invalid: 8
| Attendance Updated: 220
| Duplicates Skipped: 12
|
*/

const validationErrorSchema =
  new mongoose.Schema(
    {
      rowNumber: {
        type: Number,
        default: null,
      },

      employeeCode: {
        type: String,
        default: "",
        trim: true,
      },

      date: {
        type: String,
        default: "",
      },

      field: {
        type: String,
        default: "",
        trim: true,
      },

      message: {
        type: String,
        required: true,
        trim: true,
      },
    },
    {
      _id: false,
    }
  );

const attendanceImportBatchSchema =
  new mongoose.Schema(
    {
      companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
        required: true,
        index: true,
      },

      /*
      |--------------------------------------------------------------------------
      | File
      |--------------------------------------------------------------------------
      */

      fileName: {
        type: String,
        required: true,
        trim: true,
      },

      source: {
        type: String,

        enum: [
          "excel",
          "biometric",
        ],

        default: "excel",

        index: true,
      },

      /*
      |--------------------------------------------------------------------------
      | Batch Status
      |--------------------------------------------------------------------------
      */

      status: {
        type: String,

        enum: [
          "processing",
          "processed",
          "failed",
        ],

        default: "processing",

        index: true,
      },

      /*
      |--------------------------------------------------------------------------
      | Row Summary
      |--------------------------------------------------------------------------
      */

      totalRows: {
        type: Number,
        default: 0,
        min: 0,
      },

      validRows: {
        type: Number,
        default: 0,
        min: 0,
      },

      invalidRows: {
        type: Number,
        default: 0,
        min: 0,
      },

      /*
      |--------------------------------------------------------------------------
      | Processing Summary
      |--------------------------------------------------------------------------
      */

      punchesCreated: {
        type: Number,
        default: 0,
        min: 0,
      },

      attendanceUpdated: {
        type: Number,
        default: 0,
        min: 0,
      },

      duplicatesSkipped: {
        type: Number,
        default: 0,
        min: 0,
      },

      /*
      |--------------------------------------------------------------------------
      | Date Range
      |--------------------------------------------------------------------------
      */

      periodStart: {
        type: Date,
        default: null,
      },

      periodEnd: {
        type: Date,
        default: null,
      },

      /*
      |--------------------------------------------------------------------------
      | Validation
      |--------------------------------------------------------------------------
      */

      validationErrors: {
        type: [
          validationErrorSchema,
        ],

        default: [],
      },

      /*
      |--------------------------------------------------------------------------
      | Import User
      |--------------------------------------------------------------------------
      */

      importedByUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      importedAt: {
        type: Date,
        default: Date.now,
      },

      completedAt: {
        type: Date,
        default: null,
      },

      /*
      |--------------------------------------------------------------------------
      | Optional Failure Message
      |--------------------------------------------------------------------------
      */

      failureMessage: {
        type: String,
        default: "",
        trim: true,
      },
    },

    {
      timestamps: true,
    }
  );

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

attendanceImportBatchSchema.index({
  companyId: 1,
  createdAt: -1,
});

attendanceImportBatchSchema.index({
  companyId: 1,
  status: 1,
  createdAt: -1,
});

const AttendanceImportBatch =
  mongoose.models.AttendanceImportBatch ||
  mongoose.model(
    "AttendanceImportBatch",
    attendanceImportBatchSchema
  );

export default AttendanceImportBatch;