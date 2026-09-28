import User from "../models/User.js";
import Employee from "../models/Employees.js";
import Department from "../models/Department.js";
import MasterData from "../models/MasterData.js";
import EmployeeJobAssignment from "../models/EmployeeJobAssignment.js";
import EmployeeLifecycleEvent, {
  EMPLOYEE_LIFECYCLE_ACTIONS
} from "../models/EmployeeLifecycleEvent.js";
import {
  notifyEmployee,
} from "../utils/notifications.js";

import {
  getScopedEmployeeIds
} from "../utils/scope.js";

import {
  writeAudit
} from "../utils/audit.js";

const idOf = (value) =>
  value?._id ||
  value ||
  null;

const sameId = (a, b) =>
  String(idOf(a) || "") ===
  String(idOf(b) || "");

const startOfDay = (value) => {
  const date =
    /^\d{4}-\d{2}-\d{2}$/.test(
      String(value || "")
    )
      ? new Date(
          `${value}T00:00:00.000Z`
        )
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw Object.assign(
      new Error(
        "A valid effective date is required."
      ),
      {
        statusCode: 400
      }
    );
  }

  date.setUTCHours(
    0,
    0,
    0,
    0
  );

  return date;
};

const endOfToday = () => {
  const date =
    new Date();

  date.setUTCHours(
    23,
    59,
    59,
    999
  );

  return date;
};

const dayBefore = (value) => {
  const date =
    new Date(value);

  date.setUTCDate(
    date.getUTCDate() - 1
  );

  date.setUTCHours(
    23,
    59,
    59,
    999
  );

  return date;
};

const getMaster = async ({
  companyId,
  id,
  type,
  required = true
}) => {
  if (!id) {
    if (!required) {
      return null;
    }

    throw Object.assign(
      new Error(
        `${type.replace("-", " ")} is required.`
      ),
      {
        statusCode: 400
      }
    );
  }

  const item =
    await MasterData.findOne({
      _id: id,
      companyId,
      type,
      isActive: true
    });

  if (!item) {
    throw Object.assign(
      new Error(
        `Selected ${type.replace("-", " ")} is invalid or inactive.`
      ),
      {
        statusCode: 400
      }
    );
  }

  return item;
};

const validateManager = async (
  companyId,
  managerId,
  employeeId
) => {
  if (!managerId) {
    return null;
  }

  if (
    String(managerId) ===
    String(employeeId)
  ) {
    throw Object.assign(
      new Error(
        "An employee cannot report to themselves."
      ),
      {
        statusCode: 400
      }
    );
  }

  const manager =
    await Employee.findOne({
      _id: managerId,
      companyId,
      status: {
        $ne: "inactive"
      }
    });

  if (!manager) {
    throw Object.assign(
      new Error(
        "Selected reporting manager is invalid."
      ),
      {
        statusCode: 400
      }
    );
  }

  return manager._id;
};

const getSnapshot = async (
  employee
) => {
  const [
    department,
    designation,
    manager,
    employmentType,
    location,
    grade
  ] =
    await Promise.all([
      Department.findOne({
        _id:
          idOf(
            employee.departmentId
          ),

        companyId:
          employee.companyId
      }).select(
        "name code"
      ),

      employee.designationId
        ? MasterData.findOne({
            _id:
              idOf(
                employee.designationId
              ),

            companyId:
              employee.companyId
          }).select(
            "name code"
          )
        : null,

      employee.managerId
        ? Employee.findOne({
            _id:
              idOf(
                employee.managerId
              ),

            companyId:
              employee.companyId
          }).select(
            "firstName lastName employeeCode"
          )
        : null,

      employee.employmentTypeId
        ? MasterData.findOne({
            _id:
              idOf(
                employee.employmentTypeId
              ),

            companyId:
              employee.companyId
          }).select(
            "name code"
          )
        : null,

      employee.locationId
        ? MasterData.findOne({
            _id:
              idOf(
                employee.locationId
              ),

            companyId:
              employee.companyId
          }).select(
            "name code"
          )
        : null,

      employee.gradeId
        ? MasterData.findOne({
            _id:
              idOf(
                employee.gradeId
              ),

            companyId:
              employee.companyId
          }).select(
            "name code"
          )
        : null
    ]);

  return {
    departmentId:
      idOf(
        employee.departmentId
      ),

    department:
      department?.name ||
      "",

    designationId:
      idOf(
        employee.designationId
      ),

    designation:
      designation?.name ||
      employee.designation ||
      "",

    managerId:
      idOf(
        employee.managerId
      ),

    manager:
      manager
        ? `${manager.firstName} ${
            manager.lastName ||
            ""
          }`.trim()
        : "",

    employmentTypeId:
      idOf(
        employee.employmentTypeId
      ),

    employmentType:
      employmentType?.name ||
      employee.employmentType ||
      "",

    locationId:
      idOf(
        employee.locationId
      ),

    location:
      location?.name ||
      "",

    gradeId:
      idOf(
        employee.gradeId
      ),

    grade:
      grade?.name ||
      "",

    status:
      employee.status,

    joiningDate:
      employee.joiningDate,

    lastWorkingDate:
      employee.lastWorkingDate,

    lifecycle: {
      probationEndDate:
        employee.lifecycle
          ?.probationEndDate ||
        null,

      confirmationDate:
        employee.lifecycle
          ?.confirmationDate ||
        null,

      noticeStartDate:
        employee.lifecycle
          ?.noticeStartDate ||
        null,

      resignationDate:
        employee.lifecycle
          ?.resignationDate ||
        null,

      terminationDate:
        employee.lifecycle
          ?.terminationDate ||
        null,

      plannedLastWorkingDate:
        employee.lifecycle
          ?.plannedLastWorkingDate ||
        null,

      separationDate:
        employee.lifecycle
          ?.separationDate ||
        null,

      separationType:
        employee.lifecycle
          ?.separationType ||
        ""
    }
  };
};

const jobStateFromSnapshot = (
  employee,
  snapshot
) => ({
  companyId:
    employee.companyId,

  employeeId:
    employee._id,

  departmentId:
    snapshot.departmentId,

  designationId:
    snapshot.designationId,

  managerId:
    snapshot.managerId,

  employmentTypeId:
    snapshot.employmentTypeId,

  locationId:
    snapshot.locationId,

  gradeId:
    snapshot.gradeId,

  status:
    snapshot.status,

  snapshot: {
    department:
      snapshot.department,

    designation:
      snapshot.designation,

    manager:
      snapshot.manager,

    employmentType:
      snapshot.employmentType,

    location:
      snapshot.location,

    grade:
      snapshot.grade,

    status:
      snapshot.status
  }
});

const saveJobHistoryState = async ({
  state,
  effectiveDate,
  actorUserId,
  reason
}) => {
  const effective =
    startOfDay(
      effectiveDate
    );

  await EmployeeJobAssignment.findOneAndUpdate(
    {
      companyId:
        state.companyId,

      employeeId:
        state.employeeId,

      effectiveFrom:
        effective
    },

    {
      ...state,

      effectiveFrom:
        effective,

      changedByUserId:
        actorUserId,

      source:
        "manual",

      reason
    },

    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true
    }
  );

  const history =
    await EmployeeJobAssignment.find({
      companyId:
        state.companyId,

      employeeId:
        state.employeeId
    }).sort({
      effectiveFrom: 1
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

const ensureBaselineHistory =
  async ({
    employee,
    beforeSnapshot,
    effectiveDate,
    actorUserId
  }) => {
    const count =
      await EmployeeJobAssignment.countDocuments(
        {
          companyId:
            employee.companyId,

          employeeId:
            employee._id
        }
      );

    if (count) {
      return;
    }

    const joiningDate =
      startOfDay(
        employee.joiningDate ||
        employee.createdAt ||
        new Date()
      );

    const changeDate =
      startOfDay(
        effectiveDate
      );

    if (
      joiningDate >=
      changeDate
    ) {
      return;
    }

    await saveJobHistoryState({
      state:
        jobStateFromSnapshot(
          employee,
          beforeSnapshot
        ),

      effectiveDate:
        joiningDate,

      actorUserId,

      reason:
        "Opening employment assignment"
    });
  };

const checkScope = async (
  req,
  employeeId
) => {
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
        employeeId.toString()
    )
  ) {
    return false;
  }

  return true;
};

export const getEmployeeLifecycle =
  async (
    req,
    res
  ) => {
    try {
      if (
        !(
          await checkScope(
            req,
            req.params.id
          )
        )
      ) {
        return res
          .status(403)
          .json({
            message:
              "You do not have access to this employee."
          });
      }

      const employee =
        await Employee.findOne({
          _id:
            req.params.id,

          companyId:
            req.user.companyId
        });

      if (!employee) {
        return res
          .status(404)
          .json({
            message:
              "Employee not found."
          });
      }

      const events =
        await EmployeeLifecycleEvent.find({
          companyId:
            req.user.companyId,

          employeeId:
            employee._id
        })
          .populate(
            "performedByUserId",
            "firstName lastName email role"
          )
          .sort({
            effectiveDate: -1,
            createdAt: -1
          });

      res.json({
        employee,
        events
      });
    } catch (error) {
      res.status(500).json({
        message:
          "Unable to load employee lifecycle."
      });
    }
  };

export const performLifecycleAction =
  async (
    req,
    res
  ) => {
    try {
      const {
        action,
        effectiveDate,
        reason,
        notes = ""
      } = req.body;

      if (
        !EMPLOYEE_LIFECYCLE_ACTIONS.includes(
          action
        )
      ) {
        return res
          .status(400)
          .json({
            message:
              "Invalid employee lifecycle action."
          });
      }

      if (
        !String(
          reason ||
          ""
        ).trim()
      ) {
        return res
          .status(400)
          .json({
            message:
              "A reason is required for this HR action."
          });
      }

      const effective =
        startOfDay(
          effectiveDate
        );

      if (
        effective >
        endOfToday()
      ) {
        return res
          .status(400)
          .json({
            message:
              "Lifecycle action effective date cannot be in the future. Future last-working dates can be entered separately."
          });
      }

      if (
        !(
          await checkScope(
            req,
            req.params.id
          )
        )
      ) {
        return res
          .status(403)
          .json({
            message:
              "You do not have access to this employee."
          });
      }

      const employee =
        await Employee.findOne({
          _id:
            req.params.id,

          companyId:
            req.user.companyId
        });

      if (!employee) {
        return res
          .status(404)
          .json({
            message:
              "Employee not found."
          });
      }

      const before =
        await getSnapshot(
          employee
        );

      let jobStateChanged =
        false;

      /*
      |--------------------------------------------------------------------------
      | Confirmation
      |--------------------------------------------------------------------------
      */

      if (
        action ===
        "confirmation"
      ) {
        employee.lifecycle.confirmationDate =
          effective;

        employee.lifecycle.probationEndDate =
          effective;
      }

      /*
      |--------------------------------------------------------------------------
      | Promotion
      |--------------------------------------------------------------------------
      */

      if (
        action ===
        "promotion"
      ) {
        const targetDepartment =
          req.body.departmentId
            ? await Department.findOne({
                _id:
                  req.body.departmentId,

                companyId:
                  req.user.companyId,

                isActive:
                  true
              })
            : await Department.findById(
                employee.departmentId
              );

        if (!targetDepartment) {
          return res
            .status(400)
            .json({
              message:
                "A valid department is required."
            });
        }

        const designation =
          await getMaster({
            companyId:
              req.user.companyId,

            id:
              req.body.designationId,

            type:
              "designation"
          });

        if (
          designation.departmentId &&
          designation.departmentId.toString() !==
            targetDepartment._id.toString()
        ) {
          return res
            .status(400)
            .json({
              message:
                "Selected designation does not belong to the selected department."
            });
        }

        employee.departmentId =
          targetDepartment._id;

        employee.designationId =
          designation._id;

        employee.designation =
          designation.name;

        if (
          req.body.gradeId
        ) {
          const grade =
            await getMaster({
              companyId:
                req.user.companyId,

              id:
                req.body.gradeId,

              type:
                "grade"
            });

          employee.gradeId =
            grade._id;
        }

        jobStateChanged =
          true;
      }

      /*
      |--------------------------------------------------------------------------
      | Transfer
      |--------------------------------------------------------------------------
      */

      if (
        action ===
        "transfer"
      ) {
        const department =
          await Department.findOne({
            _id:
              req.body.departmentId,

            companyId:
              req.user.companyId,

            isActive:
              true
          });

        if (!department) {
          return res
            .status(400)
            .json({
              message:
                "Select a valid destination department."
            });
        }

        const designation =
          await getMaster({
            companyId:
              req.user.companyId,

            id:
              req.body.designationId,

            type:
              "designation"
          });

        if (
          designation.departmentId &&
          designation.departmentId.toString() !==
            department._id.toString()
        ) {
          return res
            .status(400)
            .json({
              message:
                "Selected designation does not belong to the destination department."
            });
        }

        employee.departmentId =
          department._id;

        employee.designationId =
          designation._id;

        employee.designation =
          designation.name;

        if (
          req.body.locationId !==
          undefined
        ) {
          if (
            req.body.locationId
          ) {
            const location =
              await getMaster({
                companyId:
                  req.user.companyId,

                id:
                  req.body.locationId,

                type:
                  "location"
              });

            employee.locationId =
              location._id;
          } else {
            employee.locationId =
              null;
          }
        }

        if (
          req.body.managerId !==
          undefined
        ) {
          employee.managerId =
            await validateManager(
              req.user.companyId,
              req.body.managerId,
              employee._id
            );
        }

        jobStateChanged =
          true;
      }

      /*
      |--------------------------------------------------------------------------
      | Designation Change
      |--------------------------------------------------------------------------
      */

      if (
        action ===
        "designation-change"
      ) {
        const designation =
          await getMaster({
            companyId:
              req.user.companyId,

            id:
              req.body.designationId,

            type:
              "designation"
          });

        if (
          designation.departmentId &&
          designation.departmentId.toString() !==
            employee.departmentId.toString()
        ) {
          return res
            .status(400)
            .json({
              message:
                "Selected designation does not belong to the employee's current department."
            });
        }

        employee.designationId =
          designation._id;

        employee.designation =
          designation.name;

        jobStateChanged =
          true;
      }

      /*
      |--------------------------------------------------------------------------
      | Manager Change
      |--------------------------------------------------------------------------
      */

      if (
        action ===
        "manager-change"
      ) {
        if (
          req.body.managerId ===
          undefined
        ) {
          return res
            .status(400)
            .json({
              message:
                "Select a reporting manager or choose no manager."
            });
        }

        employee.managerId =
          await validateManager(
            req.user.companyId,
            req.body.managerId ||
              null,
            employee._id
          );

        jobStateChanged =
          true;
      }

      /*
      |--------------------------------------------------------------------------
      | Notice Period
      |--------------------------------------------------------------------------
      */

      if (
        action ===
        "notice-started"
      ) {
        employee.status =
          "on-notice";

        employee.lifecycle.noticeStartDate =
          effective;

        if (
          req.body.plannedLastWorkingDate
        ) {
          const planned =
            startOfDay(
              req.body
                .plannedLastWorkingDate
            );

          if (
            planned <
            effective
          ) {
            return res
              .status(400)
              .json({
                message:
                  "Planned last working date cannot be before the notice start date."
              });
          }

          employee.lifecycle.plannedLastWorkingDate =
            planned;
        }

        jobStateChanged =
          true;
      }

      /*
      |--------------------------------------------------------------------------
      | Resignation
      |--------------------------------------------------------------------------
      */

      if (
        action ===
        "resignation"
      ) {
        employee.status =
          "on-notice";

        employee.lifecycle.resignationDate =
          effective;

        employee.lifecycle.separationType =
          "resignation";

        if (
          !employee.lifecycle.noticeStartDate
        ) {
          employee.lifecycle.noticeStartDate =
            effective;
        }

        if (
          req.body.plannedLastWorkingDate
        ) {
          const planned =
            startOfDay(
              req.body
                .plannedLastWorkingDate
            );

          if (
            planned <
            effective
          ) {
            return res
              .status(400)
              .json({
                message:
                  "Planned last working date cannot be before resignation date."
              });
          }

          employee.lifecycle.plannedLastWorkingDate =
            planned;
        }

        jobStateChanged =
          true;
      }

      /*
      |--------------------------------------------------------------------------
      | Termination
      |--------------------------------------------------------------------------
      */

      if (
        action ===
        "termination"
      ) {
        employee.status =
          "inactive";

        employee.lastWorkingDate =
          effective;

        employee.lifecycle.terminationDate =
          effective;

        employee.lifecycle.separationDate =
          effective;

        employee.lifecycle.separationType =
          "termination";

        employee.lifecycle.separationReason =
          reason.trim();

        jobStateChanged =
          true;
      }

      /*
      |--------------------------------------------------------------------------
      | Complete Separation
      |--------------------------------------------------------------------------
      */

      if (
        action ===
        "separation-completed"
      ) {
        const lastWorkingDate =
          startOfDay(
            req.body.lastWorkingDate ||
            effective
          );

        if (
          lastWorkingDate >
          endOfToday()
        ) {
          return res
            .status(400)
            .json({
              message:
                "Last working date cannot be in the future when completing separation."
            });
        }

        const allowedTypes = [
          "resignation",
          "termination",
          "retirement",
          "contract-end",
          "other"
        ];

        const separationType =
          req.body.separationType ||
          employee.lifecycle
            .separationType ||
          "other";

        if (
          !allowedTypes.includes(
            separationType
          )
        ) {
          return res
            .status(400)
            .json({
              message:
                "Invalid separation type."
            });
        }

        employee.status =
          "inactive";

        employee.lastWorkingDate =
          lastWorkingDate;

        employee.lifecycle.separationDate =
          lastWorkingDate;

        employee.lifecycle.separationType =
          separationType;

        employee.lifecycle.separationReason =
          reason.trim();

        jobStateChanged =
          true;
      }

      await employee.save();

      await User.findByIdAndUpdate(
        employee.userId,
        {
          isActive:
            employee.status !==
            "inactive"
        },
        {
          returnDocument:
            "after"
        }
      );

      const after =
        await getSnapshot(
          employee
        );

      if (
        jobStateChanged
      ) {
        await ensureBaselineHistory({
          employee,

          beforeSnapshot:
            before,

          effectiveDate:
            effective,

          actorUserId:
            req.user._id
        });

        await saveJobHistoryState({
          state:
            jobStateFromSnapshot(
              employee,
              after
            ),

          effectiveDate:
            effective,

          actorUserId:
            req.user._id,

          reason:
            reason.trim()
        });
      }

      const event =
        await EmployeeLifecycleEvent.create({
          companyId:
            req.user.companyId,

          employeeId:
            employee._id,

          action,

          effectiveDate:
            effective,

          reason:
            reason.trim(),

          notes,

          before,

          after,

          performedByUserId:
            req.user._id
        });

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          `employee.lifecycle.${action}`,

        entity:
          "Employee",

        entityId:
          employee._id,

        description:
          `${employee.firstName} ${
            employee.lastName ||
            ""
          }`.trim() +
          ` — ${action.replaceAll(
            "-",
            " "
          )}. Reason: ${reason.trim()}`
      });

      await notifyEmployee({
        companyId:
          req.user.companyId,

        employeeId:
          employee._id,

        type:
          "lifecycle",

        title:
          `HR action: ${action
            .replaceAll("-", " ")
            .replace(/\b\w/g, (letter) =>
              letter.toUpperCase()
            )}`,

        message:
          reason?.trim() ||
          "Your employee profile has been updated by HR.",

        link:
          "/profile",

        metadata: {
          lifecycleEventId:
            event._id,

          action,
        },
      });

      res.json({
        employee,
        event
      });
    } catch (error) {
      console.error(
        "Employee lifecycle error:",
        error
      );

      res
        .status(
          error.statusCode ||
          500
        )
        .json({
          message:
            error.message ||
            "Unable to complete employee lifecycle action."
        });
    }
  };