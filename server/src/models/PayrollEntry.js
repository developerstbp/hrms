import mongoose from "mongoose";

const salarySegmentSchema = new mongoose.Schema(
  {
    effectiveFrom: {
      type: Date,
      required: true,
    },

    effectiveTo: {
      type: Date,
      default: null,
    },

    calendarDays: {
      type: Number,
      default: 0,
    },

    workingDays: {
      type: Number,
      default: 0,
    },

    basicSalary: {
      type: Number,
      default: 0,
    },

    fixedAllowance: {
      type: Number,
      default: 0,
    },

    otherAllowance: {
      type: Number,
      default: 0,
    },

    fixedDeduction: {
      type: Number,
      default: 0,
    },

    overtimeHourlyRate: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: false,
  }
);

const payrollEntrySchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    payrollRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayrollRun",
      required: true,
      index: true,
    },

    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    employeeSnapshot: {
      employeeCode: {
        type: String,
        required: true,
      },

      name: {
        type: String,
        required: true,
      },

      designation: {
        type: String,
        default: "",
      },

      department: {
        type: String,
        default: "",
      },
    },

    salarySnapshot: {
      basicSalary: {
        type: Number,
        required: true,
      },

      fixedAllowance: {
        type: Number,
        default: 0,
      },

      otherAllowance: {
        type: Number,
        default: 0,
      },

      fixedDeduction: {
        type: Number,
        default: 0,
      },

      overtimeHourlyRate: {
        type: Number,
        default: 0,
      },
    },

    salarySegments: {
      type: [salarySegmentSchema],
      default: [],
    },

    attendanceSummary: {
      scheduledDays: {
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

      holidayDays: {
        type: Number,
        default: 0,
      },

      offDays: {
        type: Number,
        default: 0,
      },

      presentDays: {
        type: Number,
        default: 0,
      },

      lateDays: {
        type: Number,
        default: 0,
      },

      halfDays: {
        type: Number,
        default: 0,
      },

      absentDays: {
        type: Number,
        default: 0,
      },

      paidLeaveDays: {
        type: Number,
        default: 0,
      },

      unpaidLeaveDays: {
        type: Number,
        default: 0,
      },

      unrecordedDays: {
        type: Number,
        default: 0,
      },

      overtimeMinutes: {
        type: Number,
        default: 0,
      },

      shiftSegments: {
        type: Number,
        default: 0,
      },
    },

    basePay: {
      type: Number,
      default: 0,
    },

    allowanceTotal: {
      type: Number,
      default: 0,
    },

    overtimeAmount: {
      type: Number,
      default: 0,
    },

    absenceDeduction: {
      type: Number,
      default: 0,
    },

    unpaidLeaveDeduction: {
      type: Number,
      default: 0,
    },

    halfDayDeduction: {
      type: Number,
      default: 0,
    },

    lateDeduction: {
      type: Number,
      default: 0,
    },

    fixedDeduction: {
      type: Number,
      default: 0,
    },

    grossPay: {
      type: Number,
      default: 0,
    },

    totalDeductions: {
      type: Number,
      default: 0,
    },

    netPay: {
      type: Number,
      default: 0,
    },

    manualAdjustment: {
      type: Number,
      default: 0,
    },

    adjustmentNote: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

payrollEntrySchema.index(
  {
    companyId: 1,
    payrollRunId: 1,
    employeeId: 1,
  },
  {
    unique: true,
  }
);

const PayrollEntry = mongoose.model(
  "PayrollEntry",
  payrollEntrySchema
);

export default PayrollEntry;