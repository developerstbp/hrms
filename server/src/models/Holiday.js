import mongoose from "mongoose";

/*
|--------------------------------------------------------------------------
| Work Calendar Day Override
|--------------------------------------------------------------------------
|
| UI mein user ko "override" wording dikhane ki zarurat nahi.
| User simply calendar date click karega -> Edit Day.
|
| Backend mein isi model se special date behavior save hoga.
|
*/

const holidaySchema =
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

      /*
      |--------------------------------------------------------------------------
      | Display Name
      |--------------------------------------------------------------------------
      |
      | Examples:
      | Eid Holiday
      | Work From Home
      | Special Working Day
      | Company Off
      |
      */

      name: {
        type: String,
        required:
          true,
        trim:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Date Range
      |--------------------------------------------------------------------------
      |
      | For one day:
      | date = 2026-09-25
      | endDate = null
      |
      | For multi-day holiday:
      | date = 2026-09-25
      | endDate = 2026-09-27
      |
      */

      date: {
        type: Date,
        required:
          true,
        index:
          true,
      },

      endDate: {
        type: Date,
        default:
          null,
      },

      /*
      |--------------------------------------------------------------------------
      | Day Type
      |--------------------------------------------------------------------------
      |
      | public   -> Public Holiday
      | company  -> Company Holiday
      | optional -> Optional Holiday
      | off      -> Special Off
      | wfh      -> Work From Home
      | working  -> Force Working Day
      |
      */

      type: {
        type: String,

        enum: [
          "public",
          "company",
          "optional",
          "off",
          "wfh",
          "working",
        ],

        default:
          "public",

        index:
          true,
      },

      /*
      |--------------------------------------------------------------------------
      | Work Mode
      |--------------------------------------------------------------------------
      |
      | Only relevant when type = working.
      |
      | Example:
      | type = working
      | workMode = office
      |
      | OR:
      | type = working
      | workMode = wfh
      |
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

      description: {
        type: String,
        default:
          "",
        trim:
          true,
      },

      createdByUserId: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref:
          "User",

        default:
          null,
      },
    },

    {
      timestamps:
        true,
    }
  );

/*
|--------------------------------------------------------------------------
| Validation
|--------------------------------------------------------------------------
*/

holidaySchema.pre(
  "validate",
  function (
    next
  ) {
    if (
      this.endDate &&
      new Date(
        this.endDate
      ) <
        new Date(
          this.date
        )
    ) {
      return next(
        new Error(
          "End date cannot be before start date."
        )
      );
    }

    if (
      this.type !==
      "working"
    ) {
      this.workMode =
        "";
    }

    if (
      this.type ===
        "working" &&
      !this.workMode
    ) {
      this.workMode =
        "office";
    }

    next();
  }
);

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

holidaySchema.index(
  {
    companyId:
      1,
    date:
      1,
    type:
      1,
    name:
      1,
  }
);

const Holiday =
  mongoose.models
    .Holiday ||
  mongoose.model(
    "Holiday",
    holidaySchema
  );

export default Holiday;