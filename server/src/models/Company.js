import mongoose from "mongoose";

/*
|--------------------------------------------------------------------------
| Work Calendar Policy
|--------------------------------------------------------------------------
*/

const weekdayModesSchema =
  new mongoose.Schema(
    {
      monday: {
        type: String,
        enum: [
          "office",
          "wfh",
          "off",
        ],
        default:
          "office",
      },

      tuesday: {
        type: String,
        enum: [
          "office",
          "wfh",
          "off",
        ],
        default:
          "office",
      },

      wednesday: {
        type: String,
        enum: [
          "office",
          "wfh",
          "off",
        ],
        default:
          "office",
      },

      thursday: {
        type: String,
        enum: [
          "office",
          "wfh",
          "off",
        ],
        default:
          "office",
      },

      friday: {
        type: String,
        enum: [
          "office",
          "wfh",
          "off",
        ],
        default:
          "office",
      },

      saturday: {
        type: String,
        enum: [
          "office",
          "wfh",
          "off",
        ],
        default:
          "off",
      },

      sunday: {
        type: String,
        enum: [
          "office",
          "wfh",
          "off",
        ],
        default:
          "off",
      },
    },
    {
      _id: false,
    }
  );

const saturdayPolicySchema =
  new mongoose.Schema(
    {
      pattern: {
        type: String,

        enum: [
          "standard",
          "alternate",
          "all_working",
          "all_off",
        ],

        default:
          "standard",
      },

      firstSaturdayWorking: {
        type: Boolean,
        default:
          true,
      },

      workingMode: {
        type: String,

        enum: [
          "office",
          "wfh",
        ],

        default:
          "wfh",
      },
    },
    {
      _id: false,
    }
  );

const workCalendarPolicySchema =
  new mongoose.Schema(
    {
      name: {
        type: String,
        required:
          true,
        trim:
          true,
      },

      effectiveFrom: {
        type: Date,
        required:
          true,
      },

      weekdayModes: {
        type:
          weekdayModesSchema,

        default: () => ({
          monday:
            "office",

          tuesday:
            "office",

          wednesday:
            "office",

          thursday:
            "office",

          friday:
            "office",

          saturday:
            "off",

          sunday:
            "off",
        }),
      },

      saturdayPolicy: {
        type:
          saturdayPolicySchema,

        default: () => ({
          pattern:
            "standard",

          firstSaturdayWorking:
            true,

          workingMode:
            "wfh",
        }),
      },

      notes: {
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
| Company
|--------------------------------------------------------------------------
*/

const companySchema =
  new mongoose.Schema(
    {
      name: {
        type: String,
        required:
          true,
        trim:
          true,
      },

      slug: {
        type: String,
        required:
          true,
        unique:
          true,
      },

      email: {
        type: String,
        required:
          true,
        unique:
          true,
        lowercase:
          true,
        trim:
          true,
      },

      phone: {
        type: String,
        default:
          "",
        trim:
          true,
      },

      address: {
        type: String,
        default:
          "",
        trim:
          true,
      },

      timezone: {
        type: String,
        default:
          "Asia/Karachi",
      },

      currency: {
        type: String,
        default:
          "PKR",
      },

      /*
      |--------------------------------------------------------------------------
      | Legacy Company Timings
      |--------------------------------------------------------------------------
      |
      | Keep these for backward compatibility.
      | Actual employee timings come from Shifts.
      |
      */

      workStartTime: {
        type: String,
        default:
          "09:00",
      },

      workEndTime: {
        type: String,
        default:
          "18:00",
      },

      graceMinutes: {
        type: Number,
        default:
          15,
        min:
          0,
      },

      /*
      |--------------------------------------------------------------------------
      | Work Calendar
      |--------------------------------------------------------------------------
      */

      workCalendarPolicies: {
        type: [
          workCalendarPolicySchema,
        ],

        default: [],
      },

      /*
      |--------------------------------------------------------------------------
      | Payroll
      |--------------------------------------------------------------------------
      */

      payrollSettings: {
        salaryDayDivisor: {
          type: Number,
          default:
            30,
          min:
            1,
        },

        deductAbsence: {
          type: Boolean,
          default:
            true,
        },

        deductUnpaidLeave: {
          type: Boolean,
          default:
            true,
        },

        deductHalfDay: {
          type: Boolean,
          default:
            true,
        },

        overtimeEnabled: {
          type: Boolean,
          default:
            false,
        },

        latePenaltyAmount: {
          type: Number,
          default:
            0,
          min:
            0,
        },

        payDay: {
          type: Number,
          default:
            5,
          min:
            1,
          max:
            31,
        },
      },

      emailNotifications: {
        enabled: {
          type: Boolean,
          default: false,
        },

        leave: {
          type: Boolean,
          default: true,
        },

        shift: {
          type: Boolean,
          default: true,
        },

        attendance: {
          type: Boolean,
          default: true,
        },

        lifecycle: {
          type: Boolean,
          default: true,
        },

        system: {
          type: Boolean,
          default: true,
        },

        payroll: {
          type: Boolean,
          default: true,
        },
      },

      isActive: {
        type: Boolean,
        default:
          true,
      },
    },

    {
      timestamps:
        true,
    }
  );

const Company =
  mongoose.models
    .Company ||
  mongoose.model(
    "Company",
    companySchema
  );

export default Company;