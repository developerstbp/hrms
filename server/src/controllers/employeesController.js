import bcrypt from "bcryptjs";

import User from "../models/User.js";
import Employee from "../models/Employees.js";
import Department from "../models/Department.js";
import MasterData from "../models/MasterData.js";
import Shift from "../models/Shift.js";
import ShiftAssignment from "../models/ShiftAssignment.js";
import EmployeeJobAssignment from "../models/EmployeeJobAssignment.js";
import {
  notifyEmployee,
} from "../utils/notifications.js";

import {
  getDefaultPermissions,
} from "../constants/permissions.js";

import {
  getScopedEmployeeIds,
} from "../utils/scope.js";

import {
  writeAudit,
} from "../utils/audit.js";

import {
  assignShiftToEmployee,
  ensureDefaultShifts,
} from "../utils/shifts.js";

/*
|--------------------------------------------------------------------------
| Employee Population
|--------------------------------------------------------------------------
*/

const populateEmployee = (
  query
) =>
  query
    .populate(
      "departmentId",
      "name code"
    )
    .populate(
      "managerId",
      "firstName lastName employeeCode designation"
    )
    .populate(
      "designationId",
      "name code type departmentId isActive"
    )
    .populate(
      "locationId",
      "name code type isActive"
    )
    .populate(
      "employmentTypeId",
      "name code type isActive"
    )
    .populate(
      "gradeId",
      "name code type isActive"
    )
    .populate(
      "userId",
      "email role isActive permissions mustChangePassword"
    );

/*
|--------------------------------------------------------------------------
| Small Helpers
|--------------------------------------------------------------------------
*/

const normalize = (
  value = ""
) =>
  String(
    value ?? ""
  )
    .trim()
    .toLowerCase();

const normalizeCode = (
  value = ""
) =>
  String(
    value ?? ""
  )
    .trim()
    .toUpperCase();

const hasValue = (
  value
) =>
  value !== undefined &&
  value !== null &&
  String(value).trim() !== "";

const idOf = (
  value
) =>
  value?._id ||
  value ||
  null;

const sameId = (
  a,
  b
) =>
  String(
    idOf(a) || ""
  ) ===
  String(
    idOf(b) || ""
  );

/*
|--------------------------------------------------------------------------
| Date Parsing
|--------------------------------------------------------------------------
*/

const parseDateInput = (
  value,
  fieldName = "date"
) => {
  if (!hasValue(value)) {
    return null;
  }

  if (
    value instanceof Date &&
    !Number.isNaN(
      value.getTime()
    )
  ) {
    return value;
  }

  const raw =
    String(value).trim();

  const date =
    /^\d{4}-\d{2}-\d{2}$/.test(
      raw
    )
      ? new Date(
          `${raw}T00:00:00.000Z`
        )
      : new Date(raw);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw Object.assign(
      new Error(
        `Invalid ${fieldName}. Use YYYY-MM-DD format.`
      ),
      {
        statusCode: 400,
      }
    );
  }

  return date;
};

const startOfUtcDay = (
  value
) => {
  const date =
    parseDateInput(
      value,
      "effective date"
    ) ||
    new Date();

  date.setUTCHours(
    0,
    0,
    0,
    0
  );

  return date;
};

const dayBefore = (
  value
) => {
  const date =
    new Date(value);

  date.setUTCDate(
    date.getUTCDate() -
      1
  );

  date.setUTCHours(
    23,
    59,
    59,
    999
  );

  return date;
};

/*
|--------------------------------------------------------------------------
| Master Data Validation
|--------------------------------------------------------------------------
*/

const getMasterItem =
  async ({
    id,
    type,
    companyId,
    required = false,
    activeOnly = true,
  }) => {
    if (!id) {
      if (required) {
        throw Object.assign(
          new Error(
            `A ${type.replace(
              "-",
              " "
            )} must be selected.`
          ),
          {
            statusCode: 400,
          }
        );
      }

      return null;
    }

    const item =
      await MasterData.findOne({
        _id: id,

        companyId,

        type,

        ...(activeOnly && {
          isActive: true,
        }),
      });

    if (!item) {
      throw Object.assign(
        new Error(
          `Selected ${type.replace(
            "-",
            " "
          )} is invalid or inactive.`
        ),
        {
          statusCode: 400,
        }
      );
    }

    return item;
  };

/*
|--------------------------------------------------------------------------
| Manager Validation
|--------------------------------------------------------------------------
*/

const validateManager =
  async (
    managerId,
    companyId,
    employeeId = null
  ) => {
    if (!managerId) {
      return null;
    }

    if (
      employeeId &&
      managerId.toString() ===
        employeeId.toString()
    ) {
      throw Object.assign(
        new Error(
          "An employee cannot report to themselves."
        ),
        {
          statusCode: 400,
        }
      );
    }

    const manager =
      await Employee.findOne({
        _id: managerId,

        companyId,

        status: {
          $ne: "inactive",
        },
      });

    if (!manager) {
      throw Object.assign(
        new Error(
          "Selected reporting manager is invalid."
        ),
        {
          statusCode: 400,
        }
      );
    }

    return manager._id;
  };

/*
|--------------------------------------------------------------------------
| Current Shift
|--------------------------------------------------------------------------
*/

const getCurrentShiftMap =
  async (
    companyId,
    employeeIds
  ) => {
    if (
      !employeeIds.length
    ) {
      return new Map();
    }

    const today =
      startOfUtcDay(
        new Date()
      );

    const assignments =
      await ShiftAssignment.find({
        companyId,

        employeeId: {
          $in:
            employeeIds,
        },

        effectiveFrom: {
          $lte:
            today,
        },

        $or: [
          {
            effectiveTo:
              null,
          },

          {
            effectiveTo: {
              $gte:
                today,
            },
          },
        ],
      }).sort({
        effectiveFrom:
          -1,
      });

    const map =
      new Map();

    for (
      const assignment of assignments
    ) {
      const key =
        assignment.employeeId.toString();

      if (
        !map.has(key)
      ) {
        map.set(
          key,
          assignment
        );
      }
    }

    return map;
  };

const attachCurrentShift =
  async (
    companyId,
    employees
  ) => {
    const list =
      Array.isArray(
        employees
      )
        ? employees
        : [employees];

    const ids =
      list
        .filter(Boolean)
        .map(
          (employee) =>
            employee._id
        );

    const shiftMap =
      await getCurrentShiftMap(
        companyId,
        ids
      );

    return list.map(
      (employee) => {
        if (!employee) {
          return employee;
        }

        const plain =
          employee.toObject
            ? employee.toObject()
            : employee;

        const assignment =
          shiftMap.get(
            employee._id.toString()
          );

        return {
          ...plain,

          currentShift:
            assignment
              ? {
                  assignmentId:
                    assignment._id,

                  shiftId:
                    assignment.shiftId,

                  ...assignment.snapshot,

                  effectiveFrom:
                    assignment.effectiveFrom,

                  effectiveTo:
                    assignment.effectiveTo,
                }
              : null,
        };
      }
    );
  };

/*
|--------------------------------------------------------------------------
| Capture Employee Job State
|--------------------------------------------------------------------------
*/

const captureJobState =
  async (
    employee
  ) => {
    const [
      department,
      designation,
      manager,
      employmentType,
      location,
      grade,
    ] =
      await Promise.all([
        Department.findOne({
          _id:
            idOf(
              employee.departmentId
            ),

          companyId:
            employee.companyId,
        }).select(
          "name code"
        ),

        idOf(
          employee.designationId
        )
          ? MasterData.findOne({
              _id:
                idOf(
                  employee.designationId
                ),

              companyId:
                employee.companyId,
            }).select(
              "name code"
            )
          : null,

        idOf(
          employee.managerId
        )
          ? Employee.findOne({
              _id:
                idOf(
                  employee.managerId
                ),

              companyId:
                employee.companyId,
            }).select(
              "firstName lastName employeeCode"
            )
          : null,

        idOf(
          employee.employmentTypeId
        )
          ? MasterData.findOne({
              _id:
                idOf(
                  employee.employmentTypeId
                ),

              companyId:
                employee.companyId,
            }).select(
              "name code"
            )
          : null,

        idOf(
          employee.locationId
        )
          ? MasterData.findOne({
              _id:
                idOf(
                  employee.locationId
                ),

              companyId:
                employee.companyId,
            }).select(
              "name code"
            )
          : null,

        idOf(
          employee.gradeId
        )
          ? MasterData.findOne({
              _id:
                idOf(
                  employee.gradeId
                ),

              companyId:
                employee.companyId,
            }).select(
              "name code"
            )
          : null,
      ]);

    return {
      companyId:
        employee.companyId,

      employeeId:
        employee._id,

      departmentId:
        idOf(
          employee.departmentId
        ),

      designationId:
        idOf(
          employee.designationId
        ),

      managerId:
        idOf(
          employee.managerId
        ),

      employmentTypeId:
        idOf(
          employee.employmentTypeId
        ),

      locationId:
        idOf(
          employee.locationId
        ),

      gradeId:
        idOf(
          employee.gradeId
        ),

      status:
        employee.status,

      snapshot: {
        department:
          department?.name ||
          "",

        designation:
          designation?.name ||
          employee.designation ||
          "",

        manager:
          manager
            ? `${manager.firstName} ${
                manager.lastName ||
                ""
              }`.trim()
            : "",

        employmentType:
          employmentType?.name ||
          employee.employmentType ||
          "",

        location:
          location?.name ||
          "",

        grade:
          grade?.name ||
          "",

        status:
          employee.status,
      },
    };
  };

/*
|--------------------------------------------------------------------------
| Job Assignment History
|--------------------------------------------------------------------------
*/

const upsertJobAssignment =
  async ({
    state,
    effectiveFrom,
    actorUserId,
    source,
    reason,
  }) => {
    const effective =
      startOfUtcDay(
        effectiveFrom
      );

    let assignment =
      await EmployeeJobAssignment.findOne({
        companyId:
          state.companyId,

        employeeId:
          state.employeeId,

        effectiveFrom:
          effective,
      });

    if (!assignment) {
      assignment =
        new EmployeeJobAssignment({
          ...state,

          effectiveFrom:
            effective,

          changedByUserId:
            actorUserId,

          source,

          reason,
        });
    } else {
      assignment.departmentId =
        state.departmentId;

      assignment.designationId =
        state.designationId;

      assignment.managerId =
        state.managerId;

      assignment.employmentTypeId =
        state.employmentTypeId;

      assignment.locationId =
        state.locationId;

      assignment.gradeId =
        state.gradeId;

      assignment.status =
        state.status;

      assignment.snapshot =
        state.snapshot;

      assignment.changedByUserId =
        actorUserId;

      assignment.source =
        source;

      assignment.reason =
        reason;
    }

    await assignment.save();

    const history =
      await EmployeeJobAssignment.find(
        {
          companyId:
            state.companyId,

          employeeId:
            state.employeeId,
        }
      ).sort({
        effectiveFrom:
          1,
      });

    for (
      let index = 0;
      index <
      history.length;
      index += 1
    ) {
      const next =
        history[
          index + 1
        ];

      history[
        index
      ].effectiveTo =
        next
          ? dayBefore(
              next.effectiveFrom
            )
          : null;

      await history[
        index
      ].save();
    }
  };

const ensureBaselineJobHistory =
  async ({
    employee,
    beforeState,
    effectiveFrom,
    actorUserId,
  }) => {
    const count =
      await EmployeeJobAssignment.countDocuments(
        {
          companyId:
            employee.companyId,

          employeeId:
            employee._id,
        }
      );

    if (count) {
      return;
    }

    const baselineDate =
      startOfUtcDay(
        employee.joiningDate ||
          employee.createdAt ||
          new Date()
      );

    const changeDate =
      startOfUtcDay(
        effectiveFrom
      );

    if (
      baselineDate.getTime() >=
      changeDate.getTime()
    ) {
      return;
    }

    await upsertJobAssignment({
      state:
        beforeState,

      effectiveFrom:
        baselineDate,

      actorUserId,

      source:
        "employee-edit",

      reason:
        "Opening employment assignment created before the first tracked change.",
    });
  };

const recordJobChange =
  async ({
    employee,
    beforeState,
    effectiveFrom,
    actorUserId,
    source,
    reason,
  }) => {
    await ensureBaselineJobHistory({
      employee,
      beforeState,
      effectiveFrom,
      actorUserId,
    });

    const afterState =
      await captureJobState(
        employee
      );

    await upsertJobAssignment({
      state:
        afterState,

      effectiveFrom,

      actorUserId,

      source,

      reason,
    });
  };

const createInitialJobHistory =
  async ({
    employee,
    actorUserId,
    source =
      "employee-create",
  }) => {
    const state =
      await captureJobState(
        employee
      );

    await upsertJobAssignment({
      state,

      effectiveFrom:
        employee.joiningDate ||
        new Date(),

      actorUserId,

      source,

      reason:
        "Initial employment assignment",
    });
  };

const jobStateChanged = (
  before,
  employee
) =>
  !sameId(
    before.departmentId,
    employee.departmentId
  ) ||
  !sameId(
    before.designationId,
    employee.designationId
  ) ||
  !sameId(
    before.managerId,
    employee.managerId
  ) ||
  !sameId(
    before.employmentTypeId,
    employee.employmentTypeId
  ) ||
  !sameId(
    before.locationId,
    employee.locationId
  ) ||
  !sameId(
    before.gradeId,
    employee.gradeId
  ) ||
  before.status !==
    employee.status;

const buildBeforeState =
  async (
    employee
  ) =>
    captureJobState(
      employee
    );

/*
|--------------------------------------------------------------------------
| Shared Employee Creation
|--------------------------------------------------------------------------
*/

const createEmployeeRecord =
  async ({
    companyId,
    actorUserId,
    data,
    source =
      "employee-create",
  }) => {
    const {
      employeeCode,
      biometricUserId = "",
      firstName,
      lastName = "",
      email,
      phone = "",
      departmentId,
      managerId = null,
      designationId,
      locationId = null,
      employmentTypeId,
      gradeId = null,
      joiningDate,
      status = "active",
      initialPassword,
      dateOfBirth = null,
      gender = "",
      address = "",
      shiftId = "",
      lastWorkingDate = null,
    } = data;

    if (
      !employeeCode ||
      !firstName ||
      !email ||
      !departmentId ||
      !designationId ||
      !employmentTypeId ||
      !initialPassword
    ) {
      throw Object.assign(
        new Error(
          "Employee code, name, email, department, designation, employment type and initial password are required."
        ),
        {
          statusCode: 400,
        }
      );
    }

    if (
      initialPassword.length <
      8
    ) {
      throw Object.assign(
        new Error(
          "Initial password must be at least 8 characters long."
        ),
        {
          statusCode: 400,
        }
      );
    }

    const department =
      await Department.findOne({
        _id:
          departmentId,

        companyId,

        isActive:
          true,
      });

    if (!department) {
      throw Object.assign(
        new Error(
          "Selected department is invalid or inactive."
        ),
        {
          statusCode: 400,
        }
      );
    }

    const designation =
      await getMasterItem({
        id:
          designationId,

        type:
          "designation",

        companyId,

        required:
          true,
      });

    if (
      designation.departmentId &&
      designation.departmentId.toString() !==
        departmentId.toString()
    ) {
      throw Object.assign(
        new Error(
          "Selected designation is not available for this department."
        ),
        {
          statusCode: 400,
        }
      );
    }

    const employmentType =
      await getMasterItem({
        id:
          employmentTypeId,

        type:
          "employment-type",

        companyId,

        required:
          true,
      });

    const location =
      await getMasterItem({
        id:
          locationId,

        type:
          "location",

        companyId,
      });

    const grade =
      await getMasterItem({
        id:
          gradeId,

        type:
          "grade",

        companyId,
      });

    const validManagerId =
      await validateManager(
        managerId,
        companyId
      );

    if (
      await User.exists({
        email:
          email
            .toLowerCase()
            .trim(),
      })
    ) {
      throw Object.assign(
        new Error(
          "An account with this email already exists."
        ),
        {
          statusCode: 409,
        }
      );
    }

    if (
      await Employee.exists({
        companyId,

        employeeCode:
          employeeCode.toUpperCase(),
      })
    ) {
      throw Object.assign(
        new Error(
          "Employee code is already in use."
        ),
        {
          statusCode: 409,
        }
      );
    }

    const normalizedBiometricUserId =
      String(
        biometricUserId || ""
      ).trim();

    if (
      normalizedBiometricUserId &&
      await Employee.exists({
        companyId:
          req.user.companyId,

        biometricUserId:
          normalizedBiometricUserId,
      })
    ) {
      return res.status(409).json({
        message:
          "This biometric user ID is already assigned to another employee.",
      });
    }

    await ensureDefaultShifts(
      companyId
    );

    const initialShift =
      shiftId
        ? await Shift.findOne({
            _id:
              shiftId,

            companyId,

            isActive:
              true,
          })
        : await Shift.findOne({
            companyId,

            isDefault:
              true,

            isActive:
              true,
          }).sort({
            createdAt:
              1,
          });

    if (!initialShift) {
      throw Object.assign(
        new Error(
          "Select a valid active shift for this employee."
        ),
        {
          statusCode: 400,
        }
      );
    }

    const user =
      await User.create({
        companyId,

        firstName,

        lastName,

        email:
          email
            .toLowerCase()
            .trim(),

        password:
          await bcrypt.hash(
            initialPassword,
            12
          ),

        role:
          "employee",

        permissions:
          getDefaultPermissions(
            "employee"
          ),

        mustChangePassword:
          true,

        isActive:
          status !==
          "inactive",
      });

    try {
      const employee =
        await Employee.create({
          userId:
            user._id,

          companyId,

          departmentId,

          managerId:
            validManagerId,

          designationId:
            designation._id,

          locationId:
            location?._id ||
            null,

          employmentTypeId:
            employmentType._id,

          gradeId:
            grade?._id ||
            null,

          employeeCode,

          biometricUserId:
          normalizedBiometricUserId ||
          undefined,

          firstName,

          lastName,

          workEmail:
            email,

          phone,

          designation:
            designation.name,

          employmentType:
            employmentType.name,

          joiningDate:
            joiningDate ||
            undefined,

          status,

          dateOfBirth:
            dateOfBirth ||
            null,

          gender,

          address,

          lastWorkingDate:
            lastWorkingDate ||
            null,
        });

      await assignShiftToEmployee({
        companyId,

        employeeId:
          employee._id,

        shift:
          initialShift,

        effectiveFrom:
          joiningDate ||
          new Date(),

        assignedByUserId:
          actorUserId,

        source:
          source ===
          "excel-import"
            ? "manual"
            : "employee-create",

        reason:
          source ===
          "excel-import"
            ? "Initial shift assigned through employee import"
            : "Initial shift assignment",
      });

      await createInitialJobHistory({
        employee,

        actorUserId:
          req.user._id,

        source:
          "employee-create",
      });

      await createInitialJobHistory({
        employee,
        actorUserId,
        source,
      });

      await writeAudit({
        companyId,

        actorUserId,

        action:
          source ===
          "excel-import"
            ? "employee.import_created"
            : "employee.created",

        entity:
          "Employee",

        entityId:
          employee._id,

        description:
          `${firstName} ${lastName}`.trim() +
          (
            source ===
            "excel-import"
              ? " was created through employee import."
              : " was added."
          ),
      });

      return employee;
    } catch (error) {
      const employee =
        await Employee.findOne({
          userId:
            user._id,
        });

      if (employee) {
        await Promise.all([
          ShiftAssignment.deleteMany({
            companyId,

            employeeId:
              employee._id,
          }),

          EmployeeJobAssignment.deleteMany(
            {
              companyId,

              employeeId:
                employee._id,
            }
          ),

          Employee.findByIdAndDelete(
            employee._id
          ),
        ]);
      }

      await User.findByIdAndDelete(
        user._id
      );

      throw error;
    }
  };

/*
|--------------------------------------------------------------------------
| Create Employee
|--------------------------------------------------------------------------
*/

export const createEmployee = async (req, res) => {
  let createdNewUser = false;
  let accountUser = null;

  try {
    const {
      employeeCode,
      biometricUserId = "",
      firstName,
      lastName = "",
      email,
      phone = "",
      departmentId,
      managerId = null,
      designationId,
      locationId = null,
      employmentTypeId,
      gradeId = null,
      joiningDate,
      status = "active",
      initialPassword = "",
      dateOfBirth = null,
      gender = "",
      address = "",
      shiftId = "",
      lastWorkingDate = null,
    } = req.body;

    if (
      !employeeCode ||
      !firstName ||
      !email ||
      !departmentId ||
      !designationId ||
      !employmentTypeId
    ) {
      return res.status(400).json({
        message:
          "Employee code, name, email, department, designation and employment type are required.",
      });
    }

    const normalizedEmail =
      email.toLowerCase().trim();

    /*
    |--------------------------------------------------------------------------
    | Validate organization data
    |--------------------------------------------------------------------------
    */

    const department =
      await Department.findOne({
        _id: departmentId,
        companyId:
          req.user.companyId,
        isActive: true,
      });

    if (!department) {
      return res.status(400).json({
        message:
          "Selected department is invalid or inactive.",
      });
    }

    const designation =
      await getMasterItem({
        id: designationId,
        type: "designation",
        companyId:
          req.user.companyId,
        required: true,
      });

    if (
      designation.departmentId &&
      designation.departmentId.toString() !==
        departmentId.toString()
    ) {
      return res.status(400).json({
        message:
          "Selected designation is not available for this department.",
      });
    }

    const employmentType =
      await getMasterItem({
        id: employmentTypeId,
        type: "employment-type",
        companyId:
          req.user.companyId,
        required: true,
      });

    const location =
      await getMasterItem({
        id: locationId,
        type: "location",
        companyId:
          req.user.companyId,
      });

    const grade =
      await getMasterItem({
        id: gradeId,
        type: "grade",
        companyId:
          req.user.companyId,
      });

    const validManagerId =
      await validateManager(
        managerId,
        req.user.companyId
      );

    /*
    |--------------------------------------------------------------------------
    | Employee Code
    |--------------------------------------------------------------------------
    */

    if (
      await Employee.exists({
        companyId:
          req.user.companyId,
        employeeCode:
          employeeCode.toUpperCase(),
      })
    ) {
      return res.status(409).json({
        message:
          "Employee code is already in use.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Existing login OR new login
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    | Admin / HR / HOD / Manager may already have a User account.
    | In that case DO NOT create another account.
    | Link that User with this Employee profile.
    |--------------------------------------------------------------------------
    */

    accountUser =
      await User.findOne({
        email: normalizedEmail,
      });

    if (accountUser) {
      if (
        accountUser.companyId.toString() !==
        req.user.companyId.toString()
      ) {
        return res.status(409).json({
          message:
            "This email belongs to another company account.",
        });
      }

      const alreadyLinked =
        await Employee.exists({
          userId:
            accountUser._id,
        });

      if (alreadyLinked) {
        return res.status(409).json({
          message:
            "This login account is already linked to an employee profile.",
        });
      }

      /*
      | Preserve role + permissions.
      | Example:
      | role = admin stays admin.
      */

      accountUser.firstName =
        firstName;

      accountUser.lastName =
        lastName;

      accountUser.isActive =
        status !== "inactive";

      await accountUser.save();
    } else {
      /*
      |--------------------------------------------------------------------------
      | Brand-new employee -> create login
      |--------------------------------------------------------------------------
      */

      if (
        !initialPassword ||
        initialPassword.length < 8
      ) {
        return res.status(400).json({
          message:
            "A temporary password of at least 8 characters is required for a new employee account.",
        });
      }

      accountUser =
        await User.create({
          companyId:
            req.user.companyId,

          firstName,

          lastName,

          email:
            normalizedEmail,

          password:
            await bcrypt.hash(
              initialPassword,
              12
            ),

          role:
            "employee",

          permissions:
            getDefaultPermissions(
              "employee"
            ),

          mustChangePassword:
            true,

          isActive:
            status !== "inactive",
        });

      createdNewUser =
        true;
    }

    /*
    |--------------------------------------------------------------------------
    | Shift
    |--------------------------------------------------------------------------
    */

    await ensureDefaultShifts(
      req.user.companyId
    );

    const initialShift =
      shiftId
        ? await Shift.findOne({
            _id: shiftId,
            companyId:
              req.user.companyId,
            isActive: true,
          })
        : await Shift.findOne({
            companyId:
              req.user.companyId,
            isDefault: true,
            isActive: true,
          }).sort({
            createdAt: 1,
          });

    if (!initialShift) {
      if (createdNewUser) {
        await User.findByIdAndDelete(
          accountUser._id
        );
      }

      return res.status(400).json({
        message:
          "Select a valid active shift for this employee.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Employee Profile
    |--------------------------------------------------------------------------
    */

    const employee =
      await Employee.create({
        userId:
          accountUser._id,

        companyId:
          req.user.companyId,

        departmentId,

        managerId:
          validManagerId,

        designationId:
          designation._id,

        locationId:
          location?._id ||
          null,

        employmentTypeId:
          employmentType._id,

        gradeId:
          grade?._id ||
          null,

        employeeCode,

        biometricUserId:
          biometricUserId
            ? String(
                biometricUserId
              ).trim()
            : undefined,

        firstName,

        lastName,

        workEmail:
          normalizedEmail,

        phone,

        designation:
          designation.name,

        employmentType:
          employmentType.name,

        joiningDate:
          joiningDate ||
          undefined,

        status,

        dateOfBirth:
          dateOfBirth ||
          null,

        gender,

        address,

        lastWorkingDate:
          lastWorkingDate ||
          null,
      });

    /*
    |--------------------------------------------------------------------------
    | Initial Shift Assignment
    |--------------------------------------------------------------------------
    */

    await assignShiftToEmployee({
      companyId:
        req.user.companyId,

      employeeId:
        employee._id,

      shift:
        initialShift,

      effectiveFrom:
        joiningDate ||
        new Date(),

      assignedByUserId:
        req.user._id,

      source:
        "employee-create",

      reason:
        "Initial shift assignment",
    });

    await writeAudit({
      companyId:
        req.user.companyId,

      actorUserId:
        req.user._id,

      action:
        "employee.created",

      entity:
        "Employee",

      entityId:
        employee._id,

      description:
        `Employee ${firstName} ${lastName}`.trim() +
        " was added.",
    });

    res.status(201).json(
      await populateEmployee(
        Employee.findById(
          employee._id
        )
      )
    );
  } catch (error) {
    /*
    |--------------------------------------------------------------------------
    | Roll back ONLY if we created the User ourselves.
    | Never delete an existing Admin / HR account.
    |--------------------------------------------------------------------------
    */

    if (
      createdNewUser &&
      accountUser?._id
    ) {
      const linkedEmployee =
        await Employee.findOne({
          userId:
            accountUser._id,
        });

      if (linkedEmployee) {
        await ShiftAssignment.deleteMany({
          companyId:
            req.user.companyId,

          employeeId:
            linkedEmployee._id,
        });

        await Employee.findByIdAndDelete(
          linkedEmployee._id
        );
      }

      await User.findByIdAndDelete(
        accountUser._id
      );
    }

    console.error(
      "createEmployee:",
      error
    );

    const responseStatus =
      error.statusCode ||
      (
        error.code === 11000
          ? 409
          : 500
      );

    res
      .status(responseStatus)
      .json({
        message:
          error.statusCode
            ? error.message
            : error.code ===
                11000
              ? "Employee code or email is already in use."
              : "Unable to create employee.",
      });
  }
};

/*
|--------------------------------------------------------------------------
| Get Employees
|--------------------------------------------------------------------------
*/

export const getEmployees =
  async (
    req,
    res
  ) => {
    try {
      const scopedIds =
        await getScopedEmployeeIds(
          req.user,
          true
        );

      const query = {
        companyId:
          req.user.companyId,
      };

      if (scopedIds) {
        query._id = {
          $in:
            scopedIds,
        };
      }

      const employees =
        await populateEmployee(
          Employee.find(
            query
          )
        ).sort({
          firstName:
            1,

          lastName:
            1,
        });

      res.json(
        await attachCurrentShift(
          req.user.companyId,
          employees
        )
      );
    } catch (error) {
      res.status(500).json({
        message:
          "Unable to load employees.",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| Get Employee
|--------------------------------------------------------------------------
*/

export const getEmployee =
  async (
    req,
    res
  ) => {
    try {
      const scopedIds =
        await getScopedEmployeeIds(
          req.user,
          true
        );

      if (
        scopedIds &&
        !scopedIds.some(
          (id) =>
            id.toString() ===
            req.params.id
        )
      ) {
        return res
          .status(403)
          .json({
            message:
              "You do not have access to this employee.",
          });
      }

      const employee =
        await populateEmployee(
          Employee.findOne({
            _id:
              req.params.id,

            companyId:
              req.user.companyId,
          })
        );

      if (!employee) {
        return res
          .status(404)
          .json({
            message:
              "Employee not found.",
          });
      }

      const [
        withShift,
      ] =
        await attachCurrentShift(
          req.user.companyId,
          [employee]
        );

      res.json(
        withShift
      );
    } catch (error) {
      res.status(500).json({
        message:
          "Unable to load employee.",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| Update Employee
|--------------------------------------------------------------------------
*/

export const updateEmployee =
  async (
    req,
    res
  ) => {
    try {
      const employee =
        await Employee.findOne({
          _id:
            req.params.id,

          companyId:
            req.user.companyId,
        });

      if (!employee) {
        return res
          .status(404)
          .json({
            message:
              "Employee not found.",
          });
      }

      const before = {
        departmentId:
          employee.departmentId?.toString() || "",

        designationId:
          employee.designationId?.toString() || "",

        managerId:
          employee.managerId?.toString() || "",

        employmentTypeId:
          employee.employmentTypeId?.toString() || "",

        locationId:
          employee.locationId?.toString() || "",

        gradeId:
          employee.gradeId?.toString() || "",

        status:
          employee.status || "",

        lastWorkingDate:
          employee.lastWorkingDate
            ? new Date(employee.lastWorkingDate)
                .toISOString()
                .slice(0, 10)
            : "",
      };

      // if (!employee) {
      //   return res
      //     .status(404)
      //     .json({
      //       message:
      //         "Employee not found.",
      //     });
      // }

      const beforeState =
        await buildBeforeState(
          employee
        );

      const allowed = [
        "employeeCode",
        "biometricUserId",
        "firstName",
        "lastName",
        "phone",
        "departmentId",
        "managerId",
        "joiningDate",
        "lastWorkingDate",
        "status",
        "dateOfBirth",
        "gender",
        "address",
        "emergencyContact",
      ];

      const updates =
        Object.fromEntries(
          Object.entries(
            req.body
          ).filter(
            ([key]) =>
              allowed.includes(
                key
              )
          )
        );

        if (
          req.body.biometricUserId !==
          undefined
        ) {
          const biometricUserId =
            String(
              req.body.biometricUserId ||
              ""
            ).trim();

          if (biometricUserId) {
            const duplicate =
              await Employee.exists({
                companyId:
                  req.user.companyId,

                biometricUserId,

                _id: {
                  $ne:
                    employee._id,
                },
              });

            if (duplicate) {
              return res
                .status(409)
                .json({
                  message:
                    "This biometric user ID is already assigned to another employee.",
                });
            }

            updates.biometricUserId =
              biometricUserId;
          } else {
            updates.biometricUserId =
              undefined;
          }
        } 

      const nextDepartmentId =
        updates.departmentId ||
        employee.departmentId;

      if (
        updates.departmentId
      ) {
        const department =
          await Department.findOne(
            {
              _id:
                updates.departmentId,

              companyId:
                req.user.companyId,

              isActive:
                true,
            }
          );

        if (!department) {
          return res
            .status(400)
            .json({
              message:
                "Selected department is invalid or inactive.",
            });
        }
      }

      if (
        updates.managerId ===
        ""
      ) {
        updates.managerId =
          null;
      }

      if (
        updates.managerId
      ) {
        updates.managerId =
          await validateManager(
            updates.managerId,
            req.user.companyId,
            employee._id
          );
      }

      if (
        req.body.designationId !==
        undefined
      ) {
        const designation =
          await getMasterItem({
            id:
              req.body
                .designationId,

            type:
              "designation",

            companyId:
              req.user.companyId,

            required:
              true,
          });

        if (
          designation.departmentId &&
          designation.departmentId.toString() !==
            nextDepartmentId.toString()
        ) {
          return res
            .status(400)
            .json({
              message:
                "Selected designation is not available for this department.",
            });
        }

        updates.designationId =
          designation._id;

        updates.designation =
          designation.name;
      }

      if (
        req.body.employmentTypeId !==
        undefined
      ) {
        const employmentType =
          await getMasterItem({
            id:
              req.body
                .employmentTypeId,

            type:
              "employment-type",

            companyId:
              req.user.companyId,

            required:
              true,
          });

        updates.employmentTypeId =
          employmentType._id;

        updates.employmentType =
          employmentType.name;
      }

      if (
        req.body.locationId !==
        undefined
      ) {
        const location =
          await getMasterItem({
            id:
              req.body
                .locationId,

            type:
              "location",

            companyId:
              req.user.companyId,
          });

        updates.locationId =
          location?._id ||
          null;
      }

      if (
        req.body.gradeId !==
        undefined
      ) {
        const grade =
          await getMasterItem({
            id:
              req.body.gradeId,

            type:
              "grade",

            companyId:
              req.user.companyId,
          });

        updates.gradeId =
          grade?._id ||
          null;
      }

      if (
        updates.departmentId &&
        req.body.designationId ===
          undefined &&
        employee.designationId
      ) {
        const currentDesignation =
          await MasterData.findById(
            employee.designationId
          );

        if (
          currentDesignation?.departmentId &&
          currentDesignation.departmentId.toString() !==
            updates.departmentId.toString()
        ) {
          return res
            .status(400)
            .json({
              message:
                "Select a designation that belongs to the new department before saving.",
            });
        }
      }

      Object.assign(
        employee,
        updates
      );

      await employee.save();

      await User.findByIdAndUpdate(
        employee.userId,
        {
          firstName:
            employee.firstName,

          lastName:
            employee.lastName,

          isActive:
            employee.status !==
            "inactive",
        },
        {
          returnDocument:
            "after",
        }
      );

      if (
        jobStateChanged(
          beforeState,
          employee
        )
      ) {
        await recordJobChange({
          employee,

          beforeState,

          effectiveFrom:
            req.body
              .effectiveFrom ||
            new Date(),

          actorUserId:
            req.user._id,

          source:
            "employee-edit",

          reason:
            req.body
              .changeReason ||
            "Employee profile employment assignment updated",
        });
      }

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "employee.updated",

        entity:
          "Employee",

        entityId:
          employee._id,

        description:
          `${employee.firstName} ${
            employee.lastName ||
            ""
          }`.trim() +
          " was updated.",
      });

      const after = {
        departmentId:
          employee.departmentId?.toString() || "",

        designationId:
          employee.designationId?.toString() || "",

        managerId:
          employee.managerId?.toString() || "",

        employmentTypeId:
          employee.employmentTypeId?.toString() || "",

        locationId:
          employee.locationId?.toString() || "",

        gradeId:
          employee.gradeId?.toString() || "",

        status:
          employee.status || "",

        lastWorkingDate:
          employee.lastWorkingDate
            ? new Date(employee.lastWorkingDate)
                .toISOString()
                .slice(0, 10)
            : "",
      };

      const lifecycleChanges = [];

      if (
        before.departmentId !==
        after.departmentId
      ) {
        lifecycleChanges.push(
          "department"
        );
      }

      if (
        before.designationId !==
        after.designationId
      ) {
        lifecycleChanges.push(
          "designation"
        );
      }

      if (
        before.managerId !==
        after.managerId
      ) {
        lifecycleChanges.push(
          "reporting manager"
        );
      }

      if (
        before.employmentTypeId !==
        after.employmentTypeId
      ) {
        lifecycleChanges.push(
          "employment type"
        );
      }

      if (
        before.locationId !==
        after.locationId
      ) {
        lifecycleChanges.push(
          "location"
        );
      }

      if (
        before.gradeId !==
        after.gradeId
      ) {
        lifecycleChanges.push(
          "grade"
        );
      }

      if (
        before.status !==
        after.status
      ) {
        lifecycleChanges.push(
          "employment status"
        );
      }

      if (
        before.lastWorkingDate !==
        after.lastWorkingDate
      ) {
        lifecycleChanges.push(
          "last working date"
        );
      }

      if (
        lifecycleChanges.length
      ) {
        await notifyEmployee({
          companyId:
            req.user.companyId,

          employeeId:
            employee._id,

          type:
            "lifecycle",

          title:
            "Employment details updated",

          message:
            `Your ${lifecycleChanges.join(", ")} ${
              lifecycleChanges.length === 1
                ? "has"
                : "have"
            } been updated.`,

          link:
            "/profile",

          metadata: {
            employeeId:
              employee._id,

            changes:
              lifecycleChanges,
          },
        });
      }

      const populated =
        await populateEmployee(
          Employee.findById(
            employee._id
          )
        );

      const [
        withShift,
      ] =
        await attachCurrentShift(
          req.user.companyId,
          [populated]
        );

      res.json(
        withShift
      );
    } catch (error) {
      const status =
        error.statusCode ||
        (
          error.code ===
          11000
            ? 409
            : 500
        );

      res
        .status(status)
        .json({
          message:
            error.statusCode
              ? error.message
              : error.code ===
                11000
                ? "Employee code is already in use."
                : "Unable to update employee.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Bulk Master Resolution
|--------------------------------------------------------------------------
*/

const resolveBulkMaster =
  async ({
    value,
    type,
    companyId,
    allowClear = false,
  }) => {
    if (
      value ===
        undefined ||
      value === null ||
      value === ""
    ) {
      return {
        changed:
          false,
      };
    }

    if (
      value ===
      "__clear__"
    ) {
      if (!allowClear) {
        throw Object.assign(
          new Error(
            `${type.replace(
              "-",
              " "
            )} cannot be cleared.`
          ),
          {
            statusCode:
              400,
          }
        );
      }

      return {
        changed:
          true,

        item:
          null,
      };
    }

    const item =
      await getMasterItem({
        id:
          value,

        type,

        companyId,

        required:
          true,
      });

    return {
      changed:
        true,

      item,
    };
  };

/*
|--------------------------------------------------------------------------
| Bulk Update
|--------------------------------------------------------------------------
*/

export const bulkUpdateEmployees =
  async (
    req,
    res
  ) => {
    try {
      const {
        employeeIds = [],
        updates = {},
        effectiveFrom,
        reason = "",
      } = req.body;

      if (
        !Array.isArray(
          employeeIds
        ) ||
        !employeeIds.length
      ) {
        return res
          .status(400)
          .json({
            message:
              "Select at least one employee.",
          });
      }

      if (
        !effectiveFrom
      ) {
        return res
          .status(400)
          .json({
            message:
              "Effective date is required for bulk changes.",
          });
      }

      if (
        !reason.trim()
      ) {
        return res
          .status(400)
          .json({
            message:
              "A reason is required for bulk changes.",
          });
      }

      const allowedEmployeeIds =
        await getScopedEmployeeIds(
          req.user,
          true
        );

      if (
        allowedEmployeeIds
      ) {
        const allowed =
          new Set(
            allowedEmployeeIds.map(
              (id) =>
                id.toString()
            )
          );

        if (
          employeeIds.some(
            (id) =>
              !allowed.has(
                id.toString()
              )
          )
        ) {
          return res
            .status(403)
            .json({
              message:
                "One or more selected employees are outside your allowed scope.",
            });
        }
      }

      const hasAnyChange =
        Object.values(
          updates
        ).some(
          (value) =>
            value !==
              undefined &&
            value !== null &&
            value !== ""
        );

      if (!hasAnyChange) {
        return res
          .status(400)
          .json({
            message:
              "Choose at least one field to update.",
          });
      }

      const effectiveDate =
        startOfUtcDay(
          effectiveFrom
        );

      const results = [];

      for (
        const employeeId of employeeIds
      ) {
        try {
          const employee =
            await Employee.findOne(
              {
                _id:
                  employeeId,

                companyId:
                  req.user.companyId,
              }
            );

          if (!employee) {
            throw Object.assign(
              new Error(
                "Employee not found."
              ),
              {
                statusCode:
                  404,
              }
            );
          }

          const beforeState =
            await buildBeforeState(
              employee
            );

          /*
          |--------------------------------------------------------------------------
          | Department
          |--------------------------------------------------------------------------
          */

          if (
            updates.departmentId
          ) {
            const department =
              await Department.findOne(
                {
                  _id:
                    updates.departmentId,

                  companyId:
                    req.user.companyId,

                  isActive:
                    true,
                }
              );

            if (!department) {
              throw Object.assign(
                new Error(
                  "Selected department is invalid or inactive."
                ),
                {
                  statusCode:
                    400,
                }
              );
            }

            employee.departmentId =
              department._id;
          }

          /*
          |--------------------------------------------------------------------------
          | Designation
          |--------------------------------------------------------------------------
          */

          const designationResult =
            await resolveBulkMaster(
              {
                value:
                  updates.designationId,

                type:
                  "designation",

                companyId:
                  req.user.companyId,
              }
            );

          if (
            designationResult.changed
          ) {
            const designation =
              designationResult.item;

            if (
              designation.departmentId &&
              designation.departmentId.toString() !==
                employee.departmentId.toString()
            ) {
              throw Object.assign(
                new Error(
                  "Selected designation is not available for this employee's department."
                ),
                {
                  statusCode:
                    400,
                }
              );
            }

            employee.designationId =
              designation._id;

            employee.designation =
              designation.name;
          } else if (
            updates.departmentId &&
            employee.designationId
          ) {
            const currentDesignation =
              await MasterData.findById(
                employee.designationId
              );

            if (
              currentDesignation?.departmentId &&
              currentDesignation.departmentId.toString() !==
                employee.departmentId.toString()
            ) {
              throw Object.assign(
                new Error(
                  "The employee's current designation does not belong to the selected department. Select a designation in the same bulk update."
                ),
                {
                  statusCode:
                    400,
                }
              );
            }
          }

          /*
          |--------------------------------------------------------------------------
          | Manager
          |--------------------------------------------------------------------------
          */

          if (
            updates.managerId !==
              undefined &&
            updates.managerId !==
              ""
          ) {
            employee.managerId =
              updates.managerId ===
              "__clear__"
                ? null
                : await validateManager(
                    updates.managerId,
                    req.user.companyId,
                    employee._id
                  );
          }

          /*
          |--------------------------------------------------------------------------
          | Employment Type
          |--------------------------------------------------------------------------
          */

          const employmentTypeResult =
            await resolveBulkMaster(
              {
                value:
                  updates.employmentTypeId,

                type:
                  "employment-type",

                companyId:
                  req.user.companyId,
              }
            );

          if (
            employmentTypeResult.changed
          ) {
            employee.employmentTypeId =
              employmentTypeResult
                .item._id;

            employee.employmentType =
              employmentTypeResult
                .item.name;
          }

          /*
          |--------------------------------------------------------------------------
          | Location
          |--------------------------------------------------------------------------
          */

          const locationResult =
            await resolveBulkMaster(
              {
                value:
                  updates.locationId,

                type:
                  "location",

                companyId:
                  req.user.companyId,

                allowClear:
                  true,
              }
            );

          if (
            locationResult.changed
          ) {
            employee.locationId =
              locationResult
                .item?._id ||
              null;
          }

          /*
          |--------------------------------------------------------------------------
          | Grade
          |--------------------------------------------------------------------------
          */

          const gradeResult =
            await resolveBulkMaster(
              {
                value:
                  updates.gradeId,

                type:
                  "grade",

                companyId:
                  req.user.companyId,

                allowClear:
                  true,
              }
            );

          if (
            gradeResult.changed
          ) {
            employee.gradeId =
              gradeResult
                .item?._id ||
              null;
          }

          /*
          |--------------------------------------------------------------------------
          | Status
          |--------------------------------------------------------------------------
          */

          if (
            updates.status
          ) {
            if (
              ![
                "active",
                "inactive",
                "on-notice",
              ].includes(
                updates.status
              )
            ) {
              throw Object.assign(
                new Error(
                  "Invalid employee status."
                ),
                {
                  statusCode:
                    400,
                }
              );
            }

            employee.status =
              updates.status;
          }

          await employee.save();

          await User.findByIdAndUpdate(
            employee.userId,
            {
              isActive:
                employee.status !==
                "inactive",
            },
            {
              returnDocument:
                "after",
            }
          );

          /*
          |--------------------------------------------------------------------------
          | Job History
          |--------------------------------------------------------------------------
          */

          if (
            jobStateChanged(
              beforeState,
              employee
            )
          ) {
            await recordJobChange({
              employee,

              beforeState,

              effectiveFrom:
                effectiveDate,

              actorUserId:
                req.user._id,

              source:
                "bulk-update",

              reason:
                reason.trim(),
            });
          }

          /*
          |--------------------------------------------------------------------------
          | Shift History
          |--------------------------------------------------------------------------
          */

          if (
            updates.shiftId
          ) {
            const shift =
              await Shift.findOne({
                _id:
                  updates.shiftId,

                companyId:
                  req.user.companyId,

                isActive:
                  true,
              });

            if (!shift) {
              throw Object.assign(
                new Error(
                  "Selected shift is invalid or inactive."
                ),
                {
                  statusCode:
                    400,
                }
              );
            }

            await assignShiftToEmployee({
              companyId:
                req.user.companyId,

              employeeId:
                employee._id,

              shift,

              effectiveFrom:
                effectiveDate,

              assignedByUserId:
                req.user._id,

              source:
                "manual",

              reason:
                reason.trim(),
            });
          }

          await writeAudit({
            companyId:
              req.user.companyId,

            actorUserId:
              req.user._id,

            action:
              "employee.bulk_updated",

            entity:
              "Employee",

            entityId:
              employee._id,

            description:
              `${employee.firstName} ${
                employee.lastName ||
                ""
              }`.trim() +
              ` was updated through bulk employee management. Reason: ${reason.trim()}`,
          });

          results.push({
            employeeId:
              employee._id,

            employeeCode:
              employee.employeeCode,

            success:
              true,
          });
        } catch (error) {
          results.push({
            employeeId,

            success:
              false,

            message:
              error.message ||
              "Unable to update employee.",
          });
        }
      }

      res.json({
        updated:
          results.filter(
            (item) =>
              item.success
          ).length,

        failed:
          results.filter(
            (item) =>
              !item.success
          ).length,

        results,
      });
    } catch (error) {
      res
        .status(
          error.statusCode ||
          500
        )
        .json({
          message:
            error.message ||
            "Unable to complete bulk employee update.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Import Context
|--------------------------------------------------------------------------
*/

const buildImportContext =
  async (
    companyId
  ) => {
    await ensureDefaultShifts(
      companyId
    );

    const [
      departments,
      masterData,
      shifts,
      employees,
      users,
    ] =
      await Promise.all([
        Department.find({
          companyId,
          isActive: true,
        }),

        MasterData.find({
          companyId,
          isActive: true,
        }),

        Shift.find({
          companyId,
          isActive: true,
        }),

        Employee.find({
          companyId,
        }),

        User.find({
          companyId,
        }).select(
          "email"
        ),
      ]);

    const currentShiftMap =
      await getCurrentShiftMap(
        companyId,
        employees.map(
          (employee) =>
            employee._id
        )
      );

    return {
      departments,
      masterData,
      shifts,
      employees,
      users,
      currentShiftMap,
    };
  };

const findByNameOrCode = (
  items,
  value
) => {
  if (!hasValue(value)) {
    return null;
  }

  const needle =
    normalize(value);

  return (
    items.find(
      (item) =>
        normalize(
          item.name
        ) ===
          needle ||
        normalize(
          item.code
        ) ===
          needle
    ) ||
    null
  );
};

/*
|--------------------------------------------------------------------------
| Analyse Excel Rows
|--------------------------------------------------------------------------
*/

const analyzeImportRows =
  async ({
    companyId,
    rows,
    defaultInitialPassword = "",
  }) => {
    if (
      !Array.isArray(
        rows
      ) ||
      !rows.length
    ) {
      throw Object.assign(
        new Error(
          "The import file does not contain employee rows."
        ),
        {
          statusCode: 400,
        }
      );
    }

    if (
      rows.length >
      1000
    ) {
      throw Object.assign(
        new Error(
          "Employee import is limited to 1,000 rows per batch."
        ),
        {
          statusCode: 400,
        }
      );
    }

    const context =
      await buildImportContext(
        companyId
      );

    const employeeByCode =
      new Map(
        context.employees.map(
          (employee) => [
            normalizeCode(
              employee.employeeCode
            ),

            employee,
          ]
        )
      );

    const userEmails =
      new Set(
        context.users.map(
          (user) =>
            normalize(
              user.email
            )
        )
      );

    const seenCodes =
      new Set();

    const seenEmails =
      new Set();

    const designations =
      context.masterData.filter(
        (item) =>
          item.type ===
          "designation"
      );

    const employmentTypes =
      context.masterData.filter(
        (item) =>
          item.type ===
          "employment-type"
      );

    const locations =
      context.masterData.filter(
        (item) =>
          item.type ===
          "location"
      );

    const grades =
      context.masterData.filter(
        (item) =>
          item.type ===
          "grade"
      );

    const preview = [];

    for (
      let index = 0;
      index < rows.length;
      index += 1
    ) {
      const row =
        rows[index] ||
        {};

      const rowNumber =
        Number(
          row.__rowNumber ||
          index + 2
        );

      const errors = [];
      const warnings = [];

      const employeeCode =
        normalizeCode(
          row.employeeCode
        );

      const existing =
        employeeCode
          ? employeeByCode.get(
              employeeCode
            )
          : null;

      const action =
        existing
          ? "update"
          : "create";

      /*
      |--------------------------------------------------------------------------
      | Employee Code
      |--------------------------------------------------------------------------
      */

      if (!employeeCode) {
        errors.push(
          "Employee Code is required."
        );
      }

      if (
        employeeCode &&
        seenCodes.has(
          employeeCode
        )
      ) {
        errors.push(
          "Employee Code is duplicated inside the import file."
        );
      }

      if (employeeCode) {
        seenCodes.add(
          employeeCode
        );
      }

      /*
      |--------------------------------------------------------------------------
      | Required New Employee Fields
      |--------------------------------------------------------------------------
      */

      if (
        action ===
        "create"
      ) {
        if (
          !hasValue(
            row.firstName
          )
        ) {
          errors.push(
            "First Name is required for new employees."
          );
        }

        if (
          !hasValue(
            row.workEmail
          )
        ) {
          errors.push(
            "Work Email is required for new employees."
          );
        }

        if (
          !hasValue(
            row.department
          )
        ) {
          errors.push(
            "Department is required for new employees."
          );
        }

        if (
          !hasValue(
            row.designation
          )
        ) {
          errors.push(
            "Designation is required for new employees."
          );
        }

        if (
          !hasValue(
            row.employmentType
          )
        ) {
          errors.push(
            "Employment Type is required for new employees."
          );
        }

        if (
          !hasValue(
            row.shift
          )
        ) {
          errors.push(
            "Shift is required for new employees."
          );
        }

        if (
          String(
            defaultInitialPassword ||
            ""
          ).length <
          8
        ) {
          errors.push(
            "A default initial password of at least 8 characters is required for new employees."
          );
        }
      }

      /*
      |--------------------------------------------------------------------------
      | Email
      |--------------------------------------------------------------------------
      */

      const email =
        normalize(
          row.workEmail
        );

      if (email) {
        if (
          seenEmails.has(
            email
          )
        ) {
          errors.push(
            "Work Email is duplicated inside the import file."
          );
        }

        seenEmails.add(
          email
        );

        if (
          action ===
            "create" &&
          userEmails.has(
            email
          )
        ) {
          errors.push(
            "An account with this Work Email already exists."
          );
        }

        if (
          action ===
            "update" &&
          existing.workEmail &&
          normalize(
            existing.workEmail
          ) !== email
        ) {
          errors.push(
            "Work Email cannot be changed through Excel import. Update the employee account separately."
          );
        }
      }

      /*
      |--------------------------------------------------------------------------
      | Department
      |--------------------------------------------------------------------------
      */

      const department =
        hasValue(
          row.department
        )
          ? findByNameOrCode(
              context.departments,
              row.department
            )
          : existing
            ? context.departments.find(
                (item) =>
                  sameId(
                    item._id,
                    existing.departmentId
                  )
              )
            : null;

      if (
        hasValue(
          row.department
        ) &&
        !department
      ) {
        errors.push(
          `Department "${row.department}" was not found.`
        );
      }

      /*
      |--------------------------------------------------------------------------
      | Designation
      |--------------------------------------------------------------------------
      */

      const designation =
        hasValue(
          row.designation
        )
          ? findByNameOrCode(
              designations,
              row.designation
            )
          : existing
            ? designations.find(
                (item) =>
                  sameId(
                    item._id,
                    existing.designationId
                  )
              )
            : null;

      if (
        hasValue(
          row.designation
        ) &&
        !designation
      ) {
        errors.push(
          `Designation "${row.designation}" was not found.`
        );
      }

      if (
        designation?.departmentId &&
        department &&
        designation.departmentId.toString() !==
          department._id.toString()
      ) {
        errors.push(
          `Designation "${designation.name}" does not belong to department "${department.name}".`
        );
      }

      /*
      |--------------------------------------------------------------------------
      | Employment Type
      |--------------------------------------------------------------------------
      */

      const employmentType =
        hasValue(
          row.employmentType
        )
          ? findByNameOrCode(
              employmentTypes,
              row.employmentType
            )
          : existing
            ? employmentTypes.find(
                (item) =>
                  sameId(
                    item._id,
                    existing.employmentTypeId
                  )
              )
            : null;

      if (
        hasValue(
          row.employmentType
        ) &&
        !employmentType
      ) {
        errors.push(
          `Employment Type "${row.employmentType}" was not found.`
        );
      }

      /*
      |--------------------------------------------------------------------------
      | Optional Master Data
      |--------------------------------------------------------------------------
      */

      const location =
        hasValue(
          row.location
        )
          ? findByNameOrCode(
              locations,
              row.location
            )
          : null;

      if (
        hasValue(
          row.location
        ) &&
        !location
      ) {
        errors.push(
          `Location "${row.location}" was not found.`
        );
      }

      const grade =
        hasValue(
          row.grade
        )
          ? findByNameOrCode(
              grades,
              row.grade
            )
          : null;

      if (
        hasValue(
          row.grade
        ) &&
        !grade
      ) {
        errors.push(
          `Grade "${row.grade}" was not found.`
        );
      }

      /*
      |--------------------------------------------------------------------------
      | Manager
      |--------------------------------------------------------------------------
      */

      const manager =
        hasValue(
          row.reportingManagerCode
        )
          ? employeeByCode.get(
              normalizeCode(
                row.reportingManagerCode
              )
            )
          : null;

      if (
        hasValue(
          row.reportingManagerCode
        ) &&
        !manager
      ) {
        errors.push(
          `Reporting Manager Code "${row.reportingManagerCode}" was not found.`
        );
      }

      if (
        manager &&
        existing &&
        manager._id.toString() ===
          existing._id.toString()
      ) {
        errors.push(
          "An employee cannot report to themselves."
        );
      }

      /*
      |--------------------------------------------------------------------------
      | Shift
      |--------------------------------------------------------------------------
      */

      const shift =
        hasValue(
          row.shift
        )
          ? findByNameOrCode(
              context.shifts,
              row.shift
            )
          : null;

      if (
        hasValue(
          row.shift
        ) &&
        !shift
      ) {
        errors.push(
          `Shift "${row.shift}" was not found.`
        );
      }

      /*
      |--------------------------------------------------------------------------
      | Status
      |--------------------------------------------------------------------------
      */

      const status =
        hasValue(
          row.status
        )
          ? normalize(
              row.status
            ).replace(
              /\s+/g,
              "-"
            )
          : existing?.status ||
            "active";

      if (
        ![
          "active",
          "inactive",
          "on-notice",
        ].includes(
          status
        )
      ) {
        errors.push(
          "Status must be Active, Inactive or On Notice."
        );
      }

      /*
      |--------------------------------------------------------------------------
      | Gender
      |--------------------------------------------------------------------------
      */

      const gender =
        hasValue(
          row.gender
        )
          ? normalize(
              row.gender
            ).replace(
              /\s+/g,
              "-"
            )
          : existing?.gender ||
            "";

      if (
        ![
          "",
          "male",
          "female",
          "other",
          "prefer-not-to-say",
        ].includes(
          gender
        )
      ) {
        errors.push(
          "Gender value is invalid."
        );
      }

      /*
      |--------------------------------------------------------------------------
      | Dates
      |--------------------------------------------------------------------------
      */

      try {
        if (
          hasValue(
            row.joiningDate
          )
        ) {
          parseDateInput(
            row.joiningDate,
            "Joining Date"
          );
        }

        if (
          hasValue(
            row.dateOfBirth
          )
        ) {
          parseDateInput(
            row.dateOfBirth,
            "Date of Birth"
          );
        }

        if (
          hasValue(
            row.lastWorkingDate
          )
        ) {
          parseDateInput(
            row.lastWorkingDate,
            "Last Working Date"
          );
        }
      } catch (error) {
        errors.push(
          error.message
        );
      }

      if (
        action ===
          "update" &&
        !hasValue(
          row.shift
        ) &&
        context.currentShiftMap.get(
          existing._id.toString()
        ) == null
      ) {
        warnings.push(
          "This employee currently has no active shift assignment."
        );
      }

      preview.push({
        rowNumber,

        action,

        employeeId:
          existing?._id ||
          null,

        employeeCode,

        employeeName:
          `${
            row.firstName ||
            existing?.firstName ||
            ""
          } ${
            row.lastName ||
            existing?.lastName ||
            ""
          }`.trim(),

        department:
          department?.name ||
          "",

        designation:
          designation?.name ||
          "",

        shift:
          shift?.name ||
          context.currentShiftMap.get(
            existing?._id?.toString()
          )?.snapshot?.name ||
          "",

        status,

        errors,

        warnings,

        canImport:
          errors.length ===
          0,

        resolved: {
          departmentId:
            department?._id ||
            null,

          designationId:
            designation?._id ||
            null,

          employmentTypeId:
            employmentType?._id ||
            null,

          locationId:
            location?._id ||
            null,

          gradeId:
            grade?._id ||
            null,

          managerId:
            manager?._id ||
            null,

          shiftId:
            shift?._id ||
            null,
        },

        sourceRow:
          row,
      });
    }

    return preview;
  };

/*
|--------------------------------------------------------------------------
| Preview Employee Import
|--------------------------------------------------------------------------
*/

export const previewEmployeeImport =
  async (
    req,
    res
  ) => {
    try {
      const preview =
        await analyzeImportRows(
          {
            companyId:
              req.user.companyId,

            rows:
              req.body.rows,

            defaultInitialPassword:
              req.body
                .defaultInitialPassword,
          }
        );

      res.json({
        total:
          preview.length,

        creates:
          preview.filter(
            (row) =>
              row.action ===
              "create"
          ).length,

        updates:
          preview.filter(
            (row) =>
              row.action ===
              "update"
          ).length,

        errors:
          preview.filter(
            (row) =>
              !row.canImport
          ).length,

        rows:
          preview,
      });
    } catch (error) {
      res
        .status(
          error.statusCode ||
          500
        )
        .json({
          message:
            error.message ||
            "Unable to preview employee import.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Commit Employee Import
|--------------------------------------------------------------------------
*/

export const commitEmployeeImport =
  async (
    req,
    res
  ) => {
    try {
      const {
        rows = [],
        defaultInitialPassword = "",
        effectiveFrom,
        reason =
          "Employee Excel import",
      } = req.body;

      const preview =
        await analyzeImportRows(
          {
            companyId:
              req.user.companyId,

            rows,

            defaultInitialPassword,
          }
        );

      const invalid =
        preview.filter(
          (row) =>
            !row.canImport
        );

      if (
        invalid.length
      ) {
        return res
          .status(400)
          .json({
            message:
              `Import cannot continue because ${invalid.length} row(s) still contain validation errors.`,

            rows:
              preview,
          });
      }

      const effectiveDate =
        effectiveFrom
          ? startOfUtcDay(
              effectiveFrom
            )
          : startOfUtcDay(
              new Date()
            );

      const results = [];

      for (
        const item of preview
      ) {
        const row =
          item.sourceRow;

        try {
          /*
          |--------------------------------------------------------------------------
          | Create
          |--------------------------------------------------------------------------
          */

          if (
            item.action ===
            "create"
          ) {
            const employee =
              await createEmployeeRecord(
                {
                  companyId:
                    req.user.companyId,

                  actorUserId:
                    req.user._id,

                  source:
                    "excel-import",

                  data: {
                    employeeCode:
                      item.employeeCode,

                    firstName:
                      String(
                        row.firstName ||
                        ""
                      ).trim(),

                    lastName:
                      String(
                        row.lastName ||
                        ""
                      ).trim(),

                    email:
                      String(
                        row.workEmail ||
                        ""
                      ).trim(),

                    phone:
                      String(
                        row.phone ||
                        ""
                      ).trim(),

                    departmentId:
                      item.resolved
                        .departmentId,

                    managerId:
                      item.resolved
                        .managerId,

                    designationId:
                      item.resolved
                        .designationId,

                    locationId:
                      item.resolved
                        .locationId,

                    employmentTypeId:
                      item.resolved
                        .employmentTypeId,

                    gradeId:
                      item.resolved
                        .gradeId,

                    joiningDate:
                      hasValue(
                        row.joiningDate
                      )
                        ? parseDateInput(
                            row.joiningDate,
                            "Joining Date"
                          )
                        : new Date(),

                    status:
                      item.status,

                    initialPassword:
                      defaultInitialPassword,

                    dateOfBirth:
                      hasValue(
                        row.dateOfBirth
                      )
                        ? parseDateInput(
                            row.dateOfBirth,
                            "Date of Birth"
                          )
                        : null,

                    gender:
                      hasValue(
                        row.gender
                      )
                        ? normalize(
                            row.gender
                          ).replace(
                            /\s+/g,
                            "-"
                          )
                        : "",

                    address:
                      String(
                        row.address ||
                        ""
                      ).trim(),

                    shiftId:
                      item.resolved
                        .shiftId,

                    lastWorkingDate:
                      hasValue(
                        row.lastWorkingDate
                      )
                        ? parseDateInput(
                            row.lastWorkingDate,
                            "Last Working Date"
                          )
                        : null,
                  },
                }
              );

            results.push({
              rowNumber:
                item.rowNumber,

              action:
                "create",

              success:
                true,

              employeeId:
                employee._id,

              employeeCode:
                employee.employeeCode,
            });

            continue;
          }

          /*
          |--------------------------------------------------------------------------
          | Update
          |--------------------------------------------------------------------------
          */

          const employee =
            await Employee.findOne(
              {
                _id:
                  item.employeeId,

                companyId:
                  req.user.companyId,
              }
            );

          if (!employee) {
            throw new Error(
              "Employee no longer exists."
            );
          }

          const beforeState =
            await buildBeforeState(
              employee
            );

          if (
            hasValue(
              row.firstName
            )
          ) {
            employee.firstName =
              String(
                row.firstName
              ).trim();
          }

          if (
            hasValue(
              row.lastName
            )
          ) {
            employee.lastName =
              String(
                row.lastName
              ).trim();
          }

          if (
            hasValue(
              row.phone
            )
          ) {
            employee.phone =
              String(
                row.phone
              ).trim();
          }

          if (
            hasValue(
              row.department
            )
          ) {
            employee.departmentId =
              item.resolved
                .departmentId;
          }

          if (
            hasValue(
              row.designation
            )
          ) {
            employee.designationId =
              item.resolved
                .designationId;

            employee.designation =
              item.designation;
          }

          if (
            hasValue(
              row.employmentType
            )
          ) {
            employee.employmentTypeId =
              item.resolved
                .employmentTypeId;

            const type =
              await MasterData.findById(
                item.resolved
                  .employmentTypeId
              );

            employee.employmentType =
              type?.name ||
              employee.employmentType;
          }

          if (
            hasValue(
              row.location
            )
          ) {
            employee.locationId =
              item.resolved
                .locationId;
          }

          if (
            hasValue(
              row.grade
            )
          ) {
            employee.gradeId =
              item.resolved
                .gradeId;
          }

          if (
            hasValue(
              row.reportingManagerCode
            )
          ) {
            employee.managerId =
              item.resolved
                .managerId;
          }

          if (
            hasValue(
              row.joiningDate
            )
          ) {
            employee.joiningDate =
              parseDateInput(
                row.joiningDate,
                "Joining Date"
              );
          }

          if (
            hasValue(
              row.status
            )
          ) {
            employee.status =
              item.status;
          }

          if (
            hasValue(
              row.dateOfBirth
            )
          ) {
            employee.dateOfBirth =
              parseDateInput(
                row.dateOfBirth,
                "Date of Birth"
              );
          }

          if (
            hasValue(
              row.gender
            )
          ) {
            employee.gender =
              normalize(
                row.gender
              ).replace(
                /\s+/g,
                "-"
              );
          }

          if (
            hasValue(
              row.address
            )
          ) {
            employee.address =
              String(
                row.address
              ).trim();
          }

          if (
            hasValue(
              row.lastWorkingDate
            )
          ) {
            employee.lastWorkingDate =
              parseDateInput(
                row.lastWorkingDate,
                "Last Working Date"
              );
          }

          await employee.save();

          await User.findByIdAndUpdate(
            employee.userId,
            {
              firstName:
                employee.firstName,

              lastName:
                employee.lastName,

              isActive:
                employee.status !==
                "inactive",
            },
            {
              returnDocument:
                "after",
            }
          );

          if (
            jobStateChanged(
              beforeState,
              employee
            )
          ) {
            await recordJobChange({
              employee,

              beforeState,

              effectiveFrom:
                effectiveDate,

              actorUserId:
                req.user._id,

              source:
                "excel-import",

              reason,
            });
          }

          if (
            hasValue(
              row.shift
            )
          ) {
            const shift =
              await Shift.findOne({
                _id:
                  item.resolved
                    .shiftId,

                companyId:
                  req.user.companyId,

                isActive:
                  true,
              });

            await assignShiftToEmployee({
              companyId:
                req.user.companyId,

              employeeId:
                employee._id,

              shift,

              effectiveFrom:
                effectiveDate,

              assignedByUserId:
                req.user._id,

              source:
                "manual",

              reason,
            });
          }

          await writeAudit({
            companyId:
              req.user.companyId,

            actorUserId:
              req.user._id,

            action:
              "employee.import_updated",

            entity:
              "Employee",

            entityId:
              employee._id,

            description:
              `${employee.firstName} ${
                employee.lastName ||
                ""
              }`.trim() +
              " was updated through employee Excel import.",
          });

          results.push({
            rowNumber:
              item.rowNumber,

            action:
              "update",

            success:
              true,

            employeeId:
              employee._id,

            employeeCode:
              employee.employeeCode,
          });
        } catch (error) {
          results.push({
            rowNumber:
              item.rowNumber,

            action:
              item.action,

            success:
              false,

            employeeCode:
              item.employeeCode,

            message:
              error.message ||
              "Import failed for this row.",
          });
        }
      }

      res.json({
        created:
          results.filter(
            (item) =>
              item.success &&
              item.action ===
                "create"
          ).length,

        updated:
          results.filter(
            (item) =>
              item.success &&
              item.action ===
                "update"
          ).length,

        failed:
          results.filter(
            (item) =>
              !item.success
          ).length,

        results,
      });
    } catch (error) {
      res
        .status(
          error.statusCode ||
          500
        )
        .json({
          message:
            error.message ||
            "Unable to import employees.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Employee Job History
|--------------------------------------------------------------------------
*/

export const getEmployeeJobHistory =
  async (
    req,
    res
  ) => {
    try {
      const scopedIds =
        await getScopedEmployeeIds(
          req.user,
          true
        );

      if (
        scopedIds &&
        !scopedIds.some(
          (id) =>
            id.toString() ===
            req.params.id
        )
      ) {
        return res
          .status(403)
          .json({
            message:
              "You do not have access to this employee.",
          });
      }

      const history =
        await EmployeeJobAssignment.find(
          {
            companyId:
              req.user.companyId,

            employeeId:
              req.params.id,
          }
        )
          .populate(
            "changedByUserId",
            "firstName lastName email role"
          )
          .sort({
            effectiveFrom:
              -1,
          });

      res.json(history);
    } catch (error) {
      res.status(500).json({
        message:
          "Unable to load employee job history.",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| My Profile
|--------------------------------------------------------------------------
*/

export const getMyProfile =
  async (
    req,
    res
  ) => {
    const employee =
      await populateEmployee(
        Employee.findOne({
          companyId:
            req.user.companyId,

          userId:
            req.user._id,
        })
      );

    if (!employee) {
      return res
        .status(404)
        .json({
          message:
            "Employee profile is not linked to this account.",
        });
    }

    res.json(employee);
  };

export const updateMyProfile =
  async (
    req,
    res
  ) => {
    const allowed = [
      "phone",
      "address",
      "emergencyContact",
    ];

    const updates =
      Object.fromEntries(
        Object.entries(
          req.body
        ).filter(
          ([key]) =>
            allowed.includes(
              key
            )
        )
      );

    const employee =
      await Employee.findOneAndUpdate(
        {
          companyId:
            req.user.companyId,

          userId:
            req.user._id,
        },

        updates,

        {
          returnDocument:
            "after",

          runValidators:
            true,
        }
      );

    if (!employee) {
      return res
        .status(404)
        .json({
          message:
            "Employee profile is not linked to this account.",
        });
    }

    await writeAudit({
      companyId:
        req.user.companyId,

      actorUserId:
        req.user._id,

      action:
        "profile.updated",

      entity:
        "Employee",

      entityId:
        employee._id,

      description:
        "Personal contact details were updated.",
    });

    res.json(
      await populateEmployee(
        Employee.findById(
          employee._id
        )
      )
    );
  };