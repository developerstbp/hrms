import mongoose from "mongoose";

const employeeJobAssignmentSchema =
  new mongoose.Schema(
    {
      companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
        required: true,
        index: true,
      },

      employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        required: true,
        index: true,
      },

      departmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Department",
        default: null,
      },

      designationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MasterData",
        default: null,
      },

      managerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        default: null,
      },

      employmentTypeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MasterData",
        default: null,
      },

      locationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MasterData",
        default: null,
      },

      gradeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MasterData",
        default: null,
      },

      status: {
        type: String,
        enum: [
          "active",
          "inactive",
          "on-notice",
        ],
        default: "active",
      },

      snapshot: {
        department: {
          type: String,
          default: "",
        },

        designation: {
          type: String,
          default: "",
        },

        manager: {
          type: String,
          default: "",
        },

        employmentType: {
          type: String,
          default: "",
        },

        location: {
          type: String,
          default: "",
        },

        grade: {
          type: String,
          default: "",
        },

        status: {
          type: String,
          default: "",
        },
      },

      effectiveFrom: {
        type: Date,
        required: true,
        index: true,
      },

      effectiveTo: {
        type: Date,
        default: null,
        index: true,
      },

      changedByUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      source: {
        type: String,

        enum: [
          "employee-create",
          "employee-edit",
          "bulk-update",
          "excel-import",
          "manual",
        ],

        default: "manual",
      },

      reason: {
        type: String,
        default: "",
        trim: true,
      },
    },
    {
      timestamps: true,
    }
  );

employeeJobAssignmentSchema.index({
  companyId: 1,
  employeeId: 1,
  effectiveFrom: -1,
});

employeeJobAssignmentSchema.index(
  {
    companyId: 1,
    employeeId: 1,
    effectiveFrom: 1,
  },
  {
    unique: true,
  }
);

const EmployeeJobAssignment =
  mongoose.model(
    "EmployeeJobAssignment",
    employeeJobAssignmentSchema
  );

export default EmployeeJobAssignment;