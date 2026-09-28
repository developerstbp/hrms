import mongoose from "mongoose";

const payrollRunSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    /*
      Logical payroll month.

      Example:
      "2026-09"

      Actual period can still be:
      21 Aug 2026 -> 20 Sep 2026
    */
    month: {
      type: String,
      required: true,
    },

    periodStart: {
      type: Date,
      required: true,
    },

    periodEnd: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: [
        "draft",
        "finalized",
        "paid",
      ],
      default: "draft",
      index: true,
    },

    employeeCount: {
      type: Number,
      default: 0,
    },

    grossTotal: {
      type: Number,
      default: 0,
    },

    deductionTotal: {
      type: Number,
      default: 0,
    },

    netTotal: {
      type: Number,
      default: 0,
    },

    /*
    |--------------------------------------------------------------------------
    | Payroll Calculation Snapshot
    |--------------------------------------------------------------------------
    |
    | Payroll settings are copied here when payroll is generated.
    |
    | This is important because if HR later changes:
    |
    | 21 -> 20
    |
    | to
    |
    | 1 -> 30
    |
    | old finalized payroll still shows which policy was actually used.
    |
    */

    calculationSnapshot: {
      cycleType: {
        type: String,
        default: "calendar_month",
      },

      cycleWindow: {
        type: String,
        default: "same_month",
      },

      cycleStartDay: {
        type: Number,
        default: 1,
      },

      cycleEndDay: {
        type: Number,
        default: 31,
      },

      salaryCalculationBasis: {
        type: String,
        default: "fixed_30",
      },

      salaryDayDivisor: {
        type: Number,
        default: 30,
      },

      deductAbsence: {
        type: Boolean,
        default: true,
      },

      deductUnpaidLeave: {
        type: Boolean,
        default: true,
      },

      deductHalfDay: {
        type: Boolean,
        default: true,
      },

      overtimeEnabled: {
        type: Boolean,
        default: false,
      },

      latePenaltyAmount: {
        type: Number,
        default: 0,
      },

      payDay: {
        type: Number,
        default: 5,
      },
    },

    /*
    |--------------------------------------------------------------------------
    | Work Calendar Snapshot
    |--------------------------------------------------------------------------
    |
    | Summary of the calendar used for this payroll period.
    |
    */

    calendarSummary: {
      calendarDays: {
        type: Number,
        default: 0,
      },

      workingDays: {
        type: Number,
        default: 0,
      },

      officeDays: {
        type: Number,
        default: 0,
      },

      wfhDays: {
        type: Number,
        default: 0,
      },

      offDays: {
        type: Number,
        default: 0,
      },

      holidayDays: {
        type: Number,
        default: 0,
      },
    },

    generatedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    finalizedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    finalizedAt: {
      type: Date,
      default: null,
    },

    paidByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

payrollRunSchema.index(
  {
    companyId: 1,
    month: 1,
  },
  {
    unique: true,
  }
);

const PayrollRun = mongoose.model(
  "PayrollRun",
  payrollRunSchema
);

export default PayrollRun;