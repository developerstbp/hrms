import mongoose from "mongoose";

const lifecycleSchema = new mongoose.Schema(
  {
    probationEndDate: {
      type: Date,
      default: null
    },

    confirmationDate: {
      type: Date,
      default: null
    },

    noticeStartDate: {
      type: Date,
      default: null
    },

    resignationDate: {
      type: Date,
      default: null
    },

    terminationDate: {
      type: Date,
      default: null
    },

    plannedLastWorkingDate: {
      type: Date,
      default: null
    },

    separationDate: {
      type: Date,
      default: null
    },

    separationType: {
      type: String,
      enum: [
        "",
        "resignation",
        "termination",
        "retirement",
        "contract-end",
        "other"
      ],
      default: ""
    },

    separationReason: {
      type: String,
      default: ""
    }
  },
  {
    _id: false
  }
);

const employeeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },

  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    index: true
  },

  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Department",
    required: true
  },

  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
    default: null
  },

  designationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MasterData",
    default: null
  },

  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MasterData",
    default: null
  },

  employmentTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MasterData",
    default: null
  },

  gradeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MasterData",
    default: null
  },

  employeeCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },

  biometricUserId: {
    type: String,
    trim: true,
    default: undefined,

    set(value) {
      const cleaned =
        String(value ?? "").trim();

      return cleaned || undefined;
    }
  },

  firstName: {
    type: String,
    required: true,
    trim: true
  },

  lastName: {
    type: String,
    default: "",
    trim: true
  },

  workEmail: {
    type: String,
    default: "",
    trim: true,
    lowercase: true
  },

  phone: {
    type: String,
    default: "",
    trim: true
  },

  designation: {
    type: String,
    required: true,
    trim: true
  },

  employmentType: {
    type: String,
    default: "Full Time",
    trim: true
  },

  joiningDate: {
    type: Date,
    default: Date.now
  },

  lastWorkingDate: {
    type: Date,
    default: null
  },

  status: {
    type: String,
    enum: [
      "active",
      "inactive",
      "on-notice"
    ],
    default: "active"
  },

  dateOfBirth: {
    type: Date,
    default: null
  },

  gender: {
    type: String,
    enum: [
      "",
      "male",
      "female",
      "other",
      "prefer-not-to-say"
    ],
    default: ""
  },

  address: {
    type: String,
    default: ""
  },

  emergencyContact: {
    name: {
      type: String,
      default: ""
    },

    relationship: {
      type: String,
      default: ""
    },

    phone: {
      type: String,
      default: ""
    }
  },

  lifecycle: {
    type: lifecycleSchema,
    default: () => ({})
  }
}, {
  timestamps: true
});

employeeSchema.index(
  {
    companyId: 1,
    employeeCode: 1
  },
  {
    unique: true
  }
);



employeeSchema.index(
  {
    companyId: 1,
    biometricUserId: 1
  },
  {
    unique: true,

    partialFilterExpression: {
      biometricUserId: {
        $type: "string"
      }
    }
  }
);

employeeSchema.index({
  companyId: 1,
  locationId: 1
});

employeeSchema.index({
  companyId: 1,
  status: 1
});

const Employee = mongoose.model(
  "Employee",
  employeeSchema
);

export default Employee;