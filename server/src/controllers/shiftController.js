import Shift from "../models/Shift.js";
import ShiftAssignment from "../models/ShiftAssignment.js";
import ShiftChangeRequest from "../models/ShiftChangeRequest.js";
import Employee from "../models/Employees.js";

import {
  getEmployeeForUser,
  getScopedEmployeeIds,
} from "../utils/scope.js";

import {
  assignShiftToEmployee,
  ensureDefaultShifts,
  getShiftAssignmentForDate,
  dateOnly,
} from "../utils/shifts.js";

import {
  writeAudit,
} from "../utils/audit.js";

import {
  notifyEmployee,
  notifyUsersWithPermission,
} from "../utils/notifications.js";

/*
|--------------------------------------------------------------------------
| Populate Helpers
|--------------------------------------------------------------------------
*/

const populateAssignment = (
  query
) =>
  query
    .populate(
      "employeeId",
      "firstName lastName employeeCode designation departmentId"
    )
    .populate(
      "shiftId",
      "name code startTime endTime breakMinutes graceMinutes workingDays isActive"
    )
    .populate(
      "assignedByUserId",
      "firstName lastName role"
    );

const populateRequest = (
  query
) =>
  query
    .populate(
      "employeeId",
      "firstName lastName employeeCode designation departmentId"
    )
    .populate(
      "currentShiftId",
      "name code startTime endTime"
    )
    .populate(
      "requestedShiftId",
      "name code startTime endTime"
    )
    .populate(
      "reviewedByUserId",
      "firstName lastName role"
    );

/*
|--------------------------------------------------------------------------
| Get Shifts
|--------------------------------------------------------------------------
*/

export const getShifts =
  async (
    req,
    res
  ) => {
    try {
      await ensureDefaultShifts(
        req.user.companyId
      );

      const shifts =
        await Shift.find({
          companyId:
            req.user.companyId,
        }).sort({
          isDefault:
            -1,

          startTime:
            1,
        });

      if (
        req.user.permissions.includes(
          "shift.manage"
        )
      ) {
        const defaultShift =
          shifts.find(
            (
              shift
            ) =>
              shift.isDefault &&
              shift.isActive
          ) ||
          shifts.find(
            (
              shift
            ) =>
              shift.isActive
          );

        if (
          defaultShift
        ) {
          const employees =
            await Employee.find({
              companyId:
                req.user.companyId,
            }).select(
              "_id joiningDate"
            );

          const assignedIds =
            new Set(
              (
                await ShiftAssignment.distinct(
                  "employeeId",
                  {
                    companyId:
                      req.user.companyId,
                  }
                )
              ).map(
                (
                  id
                ) =>
                  id.toString()
              )
            );

          for (
            const employee of
            employees
          ) {
            if (
              !assignedIds.has(
                employee._id.toString()
              )
            ) {
              await assignShiftToEmployee({
                companyId:
                  req.user.companyId,

                employeeId:
                  employee._id,

                shift:
                  defaultShift,

                effectiveFrom:
                  employee.joiningDate ||
                  new Date(),

                assignedByUserId:
                  req.user._id,

                source:
                  "employee-create",

                reason:
                  "Initial shift migration",
              });
            }
          }
        }
      }

      res.json(
        shifts
      );
    } catch (error) {
      res
        .status(500)
        .json({
          message:
            "Unable to load shifts.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Create Shift
|--------------------------------------------------------------------------
*/

export const createShift =
  async (
    req,
    res
  ) => {
    try {
      const {
        name,
        code,
        startTime,
        endTime,

        breakMinutes =
          30,

        graceMinutes =
          15,

        workingDays = [
          1,
          2,
          3,
          4,
          5,
        ],

        isDefault =
          false,

        isActive =
          true,
      } =
        req.body;

      if (
        !name ||
        !code ||
        !startTime ||
        !endTime
      ) {
        return res
          .status(400)
          .json({
            message:
              "Shift name, code, start time and end time are required.",
          });
      }

      if (
        isDefault
      ) {
        await Shift.updateMany(
          {
            companyId:
              req.user.companyId,
          },

          {
            $set: {
              isDefault:
                false,
            },
          }
        );
      }

      const shift =
        await Shift.create({
          companyId:
            req.user.companyId,

          name,
          code,
          startTime,
          endTime,
          breakMinutes,
          graceMinutes,
          workingDays,
          isDefault,
          isActive,
        });

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "shift.created",

        entity:
          "Shift",

        entityId:
          shift._id,

        description:
          `Shift ${shift.name} was created.`,
      });

      res
        .status(201)
        .json(
          shift
        );
    } catch (error) {
      res
        .status(
          error.code ===
            11000
            ? 409
            : 500
        )
        .json({
          message:
            error.code ===
            11000
              ? "A shift with this code already exists."
              : "Unable to create shift.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Update Shift
|--------------------------------------------------------------------------
*/

export const updateShift =
  async (
    req,
    res
  ) => {
    try {
      const allowed = [
        "name",
        "code",
        "startTime",
        "endTime",
        "breakMinutes",
        "graceMinutes",
        "workingDays",
        "isDefault",
        "isActive",
      ];

      const updates =
        Object.fromEntries(
          Object.entries(
            req.body
          ).filter(
            ([
              key,
            ]) =>
              allowed.includes(
                key
              )
          )
        );

      if (
        updates.isDefault
      ) {
        await Shift.updateMany(
          {
            companyId:
              req.user.companyId,

            _id: {
              $ne:
                req.params.id,
            },
          },

          {
            $set: {
              isDefault:
                false,
            },
          }
        );
      }

      const shift =
        await Shift.findOneAndUpdate(
          {
            _id:
              req.params.id,

            companyId:
              req.user.companyId,
          },

          updates,

          {
            returnDocument:
              "after",

            runValidators:
              true,
          }
        );

      if (
        !shift
      ) {
        return res
          .status(404)
          .json({
            message:
              "Shift not found.",
          });
      }

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "shift.updated",

        entity:
          "Shift",

        entityId:
          shift._id,

        description:
          `Shift ${shift.name} was updated. Existing employee assignment history keeps its original schedule snapshot.`,
      });

      res.json(
        shift
      );
    } catch (error) {
      res
        .status(
          error.code ===
            11000
            ? 409
            : 500
        )
        .json({
          message:
            error.code ===
            11000
              ? "A shift with this code already exists."
              : "Unable to update shift.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Get Assignments
|--------------------------------------------------------------------------
*/

export const getAssignments =
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

      if (
        req.query.employeeId
      ) {
        if (
          scopedIds &&
          !scopedIds.some(
            (
              id
            ) =>
              id.toString() ===
              req.query.employeeId
          )
        ) {
          return res
            .status(403)
            .json({
              message:
                "You do not have access to this employee's shift history.",
            });
        }

        query.employeeId =
          req.query.employeeId;
      } else if (
        scopedIds
      ) {
        query.employeeId = {
          $in:
            scopedIds,
        };
      }

      const assignments =
        await populateAssignment(
          ShiftAssignment.find(
            query
          )
        ).sort({
          effectiveFrom:
            -1,
        });

      res.json(
        assignments
      );
    } catch (error) {
      res
        .status(500)
        .json({
          message:
            "Unable to load shift assignments.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| My Shift
|--------------------------------------------------------------------------
*/

export const getMyShift =
  async (
    req,
    res
  ) => {
    try {
      await ensureDefaultShifts(
        req.user.companyId
      );

      const employee =
        await getEmployeeForUser(
          req.user
        );

      if (
        !employee
      ) {
        return res.json({
          current:
            null,

          history:
            [],
        });
      }

      const [
        current,
        history,
      ] =
        await Promise.all([
          getShiftAssignmentForDate(
            req.user.companyId,
            employee._id,
            new Date()
          ),

          populateAssignment(
            ShiftAssignment.find({
              companyId:
                req.user.companyId,

              employeeId:
                employee._id,
            })
          )
            .sort({
              effectiveFrom:
                -1,
            })
            .limit(
              20
            ),
        ]);

      res.json({
        current,
        history,
      });
    } catch (error) {
      res
        .status(500)
        .json({
          message:
            "Unable to load your shift.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Assign Shift
|--------------------------------------------------------------------------
*/

export const assignShift =
  async (
    req,
    res
  ) => {
    try {
      const {
        employeeId,
        shiftId,
        effectiveFrom,

        reason =
          "",
      } =
        req.body;

      if (
        !employeeId ||
        !shiftId ||
        !effectiveFrom
      ) {
        return res
          .status(400)
          .json({
            message:
              "Employee, shift and effective date are required.",
          });
      }

      const employee =
        await Employee.findOne({
          _id:
            employeeId,

          companyId:
            req.user.companyId,
        });

      if (
        !employee
      ) {
        return res
          .status(404)
          .json({
            message:
              "Employee not found.",
          });
      }

      const shift =
        await Shift.findOne({
          _id:
            shiftId,

          companyId:
            req.user.companyId,

          isActive:
            true,
        });

      if (
        !shift
      ) {
        return res
          .status(400)
          .json({
            message:
              "Selected shift is not available.",
          });
      }

      const assignment =
        await assignShiftToEmployee({
          companyId:
            req.user.companyId,

          employeeId,

          shift,

          effectiveFrom,

          assignedByUserId:
            req.user._id,

          source:
            "manual",

          reason,
        });

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "shift.assigned",

        entity:
          "ShiftAssignment",

        entityId:
          assignment._id,

        description:
          `${shift.name} was assigned to ${employee.firstName} ${
            employee.lastName ||
            ""
          }`
            .trim() +
          ` effective ${dateOnly(
            effectiveFrom
          )
            .toISOString()
            .slice(
              0,
              10
            )}.`,
      });

      await notifyEmployee({
        companyId:
          req.user.companyId,

        employeeId,

        type:
          "shift",

        title:
          "Shift assigned",

        message:
          `${shift.name} is assigned effective ${dateOnly(
            effectiveFrom
          )
            .toISOString()
            .slice(
              0,
              10
            )}.`,

        link:
          "/shifts",

        metadata: {
          shiftAssignmentId:
            assignment._id,
        },
      });

      res
        .status(201)
        .json(
          await populateAssignment(
            ShiftAssignment.findById(
              assignment._id
            )
          )
        );
    } catch (error) {
      res
        .status(500)
        .json({
          message:
            "Unable to assign shift.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Create Shift Change Request
|--------------------------------------------------------------------------
*/

export const createShiftChangeRequest =
  async (
    req,
    res
  ) => {
    try {
      const employee =
        await getEmployeeForUser(
          req.user
        );

      if (
        !employee
      ) {
        return res
          .status(404)
          .json({
            message:
              "Employee profile is not linked to this account.",
          });
      }

      const {
        requestedShiftId,
        requestedEffectiveFrom,
        reason,
      } =
        req.body;

      if (
        !requestedShiftId ||
        !requestedEffectiveFrom ||
        !reason?.trim()
      ) {
        return res
          .status(400)
          .json({
            message:
              "Requested shift, effective date and reason are required.",
          });
      }

      if (
        dateOnly(
          requestedEffectiveFrom
        ) <
        dateOnly(
          new Date()
        )
      ) {
        return res
          .status(400)
          .json({
            message:
              "A shift change request cannot use a past effective date. HR can make historical corrections directly if required.",
          });
      }

      const requestedShift =
        await Shift.findOne({
          _id:
            requestedShiftId,

          companyId:
            req.user.companyId,

          isActive:
            true,
        });

      if (
        !requestedShift
      ) {
        return res
          .status(400)
          .json({
            message:
              "Selected shift is not available.",
          });
      }

      const pending =
        await ShiftChangeRequest.exists({
          companyId:
            req.user.companyId,

          employeeId:
            employee._id,

          status:
            "pending",
        });

      if (
        pending
      ) {
        return res
          .status(409)
          .json({
            message:
              "You already have a pending shift change request. Please wait for HR to review it.",
          });
      }

      const currentAssignment =
        await getShiftAssignmentForDate(
          req.user.companyId,
          employee._id,
          new Date()
        );

      if (
        currentAssignment?.shiftId?.toString() ===
        requestedShift._id.toString()
      ) {
        return res
          .status(400)
          .json({
            message:
              "You are already assigned to this shift.",
          });
      }

      const request =
        await ShiftChangeRequest.create({
          companyId:
            req.user.companyId,

          employeeId:
            employee._id,

          currentShiftId:
            currentAssignment?.shiftId ||
            null,

          requestedShiftId:
            requestedShift._id,

          requestedEffectiveFrom:
            dateOnly(
              requestedEffectiveFrom
            ),

          reason:
            reason.trim(),
        });

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "shift_change.requested",

        entity:
          "ShiftChangeRequest",

        entityId:
          request._id,

        description:
          "Employee submitted a shift change request for HR review.",
      });

      await notifyUsersWithPermission({
        companyId:
          req.user.companyId,

        permission:
          "shift.manage",

        excludeUserId:
          req.user._id,

        type:
          "shift",

        title:
          "Shift change request",

        message:
          `${employee.firstName} ${
            employee.lastName ||
            ""
          }`
            .trim() +
          " submitted a shift change request.",

        link:
          "/shifts",

        metadata: {
          shiftChangeRequestId:
            request._id,
        },
      });

      res
        .status(201)
        .json(
          await populateRequest(
            ShiftChangeRequest.findById(
              request._id
            )
          )
        );
    } catch (error) {
      res
        .status(500)
        .json({
          message:
            "Unable to submit shift change request.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Get Shift Change Requests
|--------------------------------------------------------------------------
*/

export const getShiftChangeRequests =
  async (
    req,
    res
  ) => {
    try {
      const actorEmployee =
        await getEmployeeForUser(
          req.user
        );

      const scopedIds =
        await getScopedEmployeeIds(
          req.user,
          true
        );

      const query = {
        companyId:
          req.user.companyId,
      };

      if (
        req.user.permissions.includes(
          "shift.manage"
        )
      ) {
        // HR/Admin can see company queue.
      } else if (
        req.user.permissions.includes(
          "shift.team"
        ) &&
        scopedIds
      ) {
        query.employeeId = {
          $in:
            scopedIds,
        };
      } else if (
        actorEmployee
      ) {
        query.employeeId =
          actorEmployee._id;
      } else {
        return res.json(
          []
        );
      }

      if (
        req.query.status
      ) {
        query.status =
          req.query.status;
      }

      const requests =
        await populateRequest(
          ShiftChangeRequest.find(
            query
          )
        ).sort({
          createdAt:
            -1,
        });

      res.json(
        requests
      );
    } catch (error) {
      res
        .status(500)
        .json({
          message:
            "Unable to load shift change requests.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Review Shift Change Request
|--------------------------------------------------------------------------
*/

export const reviewShiftChangeRequest =
  async (
    req,
    res
  ) => {
    try {
      const {
        status,

        reviewNote =
          "",

        effectiveFrom,
      } =
        req.body;

      if (
        ![
          "approved",
          "rejected",
        ].includes(
          status
        )
      ) {
        return res
          .status(400)
          .json({
            message:
              "Review status must be approved or rejected.",
          });
      }

      const request =
        await ShiftChangeRequest.findOne({
          _id:
            req.params.id,

          companyId:
            req.user.companyId,
        });

      if (
        !request
      ) {
        return res
          .status(404)
          .json({
            message:
              "Shift change request not found.",
          });
      }

      if (
        request.status !==
        "pending"
      ) {
        return res
          .status(409)
          .json({
            message:
              "Only pending shift change requests can be reviewed.",
          });
      }

      if (
        status ===
        "approved"
      ) {
        const shift =
          await Shift.findOne({
            _id:
              request.requestedShiftId,

            companyId:
              req.user.companyId,

            isActive:
              true,
          });

        if (
          !shift
        ) {
          return res
            .status(400)
            .json({
              message:
                "The requested shift is no longer active.",
            });
        }

        const assignment =
          await assignShiftToEmployee({
            companyId:
              req.user.companyId,

            employeeId:
              request.employeeId,

            shift,

            effectiveFrom:
              effectiveFrom ||
              request.requestedEffectiveFrom,

            assignedByUserId:
              req.user._id,

            source:
              "request",

            reason:
              request.reason,
          });

        await writeAudit({
          companyId:
            req.user.companyId,

          actorUserId:
            req.user._id,

          action:
            "shift_change.approved",

          entity:
            "ShiftAssignment",

          entityId:
            assignment._id,

          description:
            `Shift change request was approved effective ${dateOnly(
              effectiveFrom ||
              request.requestedEffectiveFrom
            )
              .toISOString()
              .slice(
                0,
                10
              )}.`,
        });
      } else {
        await writeAudit({
          companyId:
            req.user.companyId,

          actorUserId:
            req.user._id,

          action:
            "shift_change.rejected",

          entity:
            "ShiftChangeRequest",

          entityId:
            request._id,

          description:
            "Shift change request was rejected.",
        });
      }

      request.status =
        status;

      request.reviewNote =
        reviewNote;

      request.reviewedByUserId =
        req.user._id;

      request.reviewedAt =
        new Date();

      if (
        status ===
          "approved" &&
        effectiveFrom
      ) {
        request.requestedEffectiveFrom =
          dateOnly(
            effectiveFrom
          );
      }

      await request.save();

      await notifyEmployee({
        companyId:
          req.user.companyId,

        employeeId:
          request.employeeId,

        type:
          "shift",

        title:
          `Shift change ${status}`,

        message:
          reviewNote ||
          `Your shift change request was ${status}.`,

        link:
          "/shifts",

        metadata: {
          shiftChangeRequestId:
            request._id,

          status,
        },
      });

      res.json(
        await populateRequest(
          ShiftChangeRequest.findById(
            request._id
          )
        )
      );
    } catch (error) {
      res
        .status(500)
        .json({
          message:
            "Unable to review shift change request.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Cancel Shift Change Request
|--------------------------------------------------------------------------
*/

export const cancelShiftChangeRequest =
  async (
    req,
    res
  ) => {
    try {
      const employee =
        await getEmployeeForUser(
          req.user
        );

      const request =
        await ShiftChangeRequest.findOne({
          _id:
            req.params.id,

          companyId:
            req.user.companyId,
        });

      if (
        !request
      ) {
        return res
          .status(404)
          .json({
            message:
              "Shift change request not found.",
          });
      }

      if (
        !employee ||
        request.employeeId.toString() !==
          employee._id.toString()
      ) {
        return res
          .status(403)
          .json({
            message:
              "You can only cancel your own shift change request.",
          });
      }

      if (
        request.status !==
        "pending"
      ) {
        return res
          .status(409)
          .json({
            message:
              "Only pending requests can be cancelled.",
          });
      }

      request.status =
        "cancelled";

      await request.save();

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "shift_change.cancelled",

        entity:
          "ShiftChangeRequest",

        entityId:
          request._id,

        description:
          "Employee cancelled a pending shift change request.",
      });

      res.json(
        await populateRequest(
          ShiftChangeRequest.findById(
            request._id
          )
        )
      );
    } catch (error) {
      res
        .status(500)
        .json({
          message:
            "Unable to cancel shift change request.",
        });
    }
  };