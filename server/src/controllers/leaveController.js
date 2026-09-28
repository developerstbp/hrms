import LeaveType from "../models/LeaveType.js";
import LeaveRequest from "../models/LeaveRequest.js";
import Employee from "../models/Employees.js";
import Company from "../models/Company.js";
import Holiday from "../models/Holiday.js";
import {
  notifyEmployee,
  notifyUsersWithPermission,
} from "../utils/notifications.js";

import {
  buildWorkCalendar,
} from "../utils/workCalendar.js";

import {
  getEmployeeForUser,
  getScopedEmployeeIds,
  canActForEmployee,
} from "../utils/scope.js";

import {
  writeAudit,
} from "../utils/audit.js";

const LEGACY_PENDING_STATUSES = [
  "pending_hr",
  "under_review",
  "more_info_required",
  "on_hold",
];

const normalizeLegacyLeaveStatuses =
  async (
    companyId
  ) => {
    await LeaveRequest.updateMany(
      {
        companyId,

        status: {
          $in:
            LEGACY_PENDING_STATUSES,
        },
      },

      {
        $set: {
          status:
            "pending",
        },
      }
    );
  };

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const populateLeave = (
  query
) =>
  query
    .populate(
      "employeeId",
      "firstName lastName employeeCode designation departmentId"
    )
    .populate(
      "leaveTypeId",
      [
        "name",
        "code",
        "daysPerYear",
        "isPaid",
        "allowHalfDay",
        "requiresReason",
        "carryForwardAllowed",
        "maxCarryForward",
        "maxConsecutiveDays",
        "noticeDays",
      ].join(" ")
    )
    .populate(
      "requestedByUserId",
      "firstName lastName role"
    )
    .populate(
      "reviewedByUserId",
      "firstName lastName role"
    );

const yearBounds = (
  year
) => ({
  start:
    new Date(
      `${year}-01-01T00:00:00.000Z`
    ),

  end:
    new Date(
      `${year}-12-31T23:59:59.999Z`
    ),
});

const startOfDay = (
  value
) => {
  const date =
    new Date(
      value
    );

  date.setHours(
    0,
    0,
    0,
    0
  );

  return date;
};

const endOfDay = (
  value
) => {
  const date =
    new Date(
      value
    );

  date.setHours(
    23,
    59,
    59,
    999
  );

  return date;
};

const calculateLeaveDaysWithCalendar =
  async ({
    companyId,
    startDate,
    endDate,
    halfDay =
      false,
  }) => {
    const start =
      startOfDay(
        startDate
      );

    const end =
      startOfDay(
        endDate
      );

    if (
      Number.isNaN(
        start.getTime()
      ) ||
      Number.isNaN(
        end.getTime()
      ) ||
      end <
        start
    ) {
      return 0;
    }

    const [
      company,
      overrides,
    ] =
      await Promise.all([
        Company.findById(
          companyId
        ),

        Holiday.find({
          companyId,

          date: {
            $lte:
              endOfDay(
                end
              ),
          },

          $or: [
            {
              endDate:
                null,
            },

            {
              endDate: {
                $gte:
                  start,
              },
            },
          ],
        }).sort({
          createdAt:
            1,
        }),
      ]);

    if (
      !company
    ) {
      throw Object.assign(
        new Error(
          "Company not found."
        ),
        {
          statusCode:
            404,
        }
      );
    }

    const days =
      buildWorkCalendar(
        company,
        overrides,
        start,
        end
      );

    if (
      halfDay
    ) {
      return days[0]
        ?.isWorkingDay
        ? 0.5
        : 0;
    }

    return days.filter(
      (
        day
      ) =>
        day.isWorkingDay
    ).length;
  };

const getUsedLeaveDays =
  async ({
    companyId,
    employeeId,
    leaveTypeId,
    year,
    statuses = [
      "approved",
      "pending",
    ],
  }) => {
    const {
      start,
      end,
    } =
      yearBounds(
        year
      );

    const result =
      await LeaveRequest.aggregate([
        {
          $match: {
            companyId,

            employeeId,

            leaveTypeId,

            status: {
              $in:
                statuses,
            },

            startDate: {
              $gte:
                start,

              $lte:
                end,
            },
          },
        },

        {
          $group: {
            _id:
              null,

            total: {
              $sum:
                "$days",
            },
          },
        },
      ]);

    return Number(
      result[0]
        ?.total ||
        0
    );
  };

const getCarryForward =
  async ({
    companyId,
    employeeId,
    leaveType,
    year,
  }) => {
    if (
      !leaveType
        .carryForwardAllowed ||
      !leaveType
        .maxCarryForward ||
      !leaveType
        .daysPerYear
    ) {
      return 0;
    }

    const previousYear =
      year -
      1;

    const approvedUsed =
      await getUsedLeaveDays({
        companyId,

        employeeId,

        leaveTypeId:
          leaveType._id,

        year:
          previousYear,

        statuses: [
          "approved",
        ],
      });

    const unused =
      Math.max(
        0,

        Number(
          leaveType.daysPerYear ||
            0
        ) -
          approvedUsed
      );

    return Math.min(
      unused,

      Number(
        leaveType.maxCarryForward ||
          0
      )
    );
  };

const getEntitlement =
  async ({
    companyId,
    employeeId,
    leaveType,
    year,
  }) => {
    /*
    | 0 days means no fixed annual limit.
    | Useful for Unpaid Leave.
    */

    if (
      Number(
        leaveType.daysPerYear ||
          0
      ) ===
      0
    ) {
      return {
        unlimited:
          true,

        base:
          0,

        carryForward:
          0,

        total:
          null,
      };
    }

    const carryForward =
      await getCarryForward({
        companyId,

        employeeId,

        leaveType,

        year,
      });

    const base =
      Number(
        leaveType.daysPerYear ||
          0
      );

    return {
      unlimited:
        false,

      base,

      carryForward,

      total:
        base +
        carryForward,
    };
  };

/*
|--------------------------------------------------------------------------
| Leave Types
|--------------------------------------------------------------------------
*/

export const getLeaveTypes =
  async (
    req,
    res
  ) => {
    try {
      const types =
        await LeaveType.find({
          companyId:
            req.user.companyId,
        }).sort({
          name:
            1,
        });

      res.json(
        types
      );
    } catch (error) {
      res
        .status(
          500
        )
        .json({
          message:
            "Unable to load leave policies.",
        });
    }
  };

export const createLeaveType =
  async (
    req,
    res
  ) => {
    try {
      const {
        name,
        code,

        daysPerYear =
          0,

        isPaid =
          true,

        allowHalfDay =
          true,

        requiresReason =
          true,

        carryForwardAllowed =
          false,

        maxCarryForward =
          0,

        maxConsecutiveDays =
          0,

        noticeDays =
          0,

        isActive =
          true,
      } =
        req.body;

      if (
        !name ||
        !code
      ) {
        return res
          .status(
            400
          )
          .json({
            message:
              "Leave policy name and code are required.",
          });
      }

      const leaveType =
        await LeaveType.create({
          companyId:
            req.user.companyId,

          name:
            String(
              name
            ).trim(),

          code:
            String(
              code
            )
              .trim()
              .toUpperCase(),

          daysPerYear:
            Number(
              daysPerYear ||
                0
            ),

          isPaid:
            Boolean(
              isPaid
            ),

          allowHalfDay:
            Boolean(
              allowHalfDay
            ),

          requiresReason:
            Boolean(
              requiresReason
            ),

          carryForwardAllowed:
            Boolean(
              carryForwardAllowed
            ),

          maxCarryForward:
            carryForwardAllowed
              ? Number(
                  maxCarryForward ||
                    0
                )
              : 0,

          maxConsecutiveDays:
            Number(
              maxConsecutiveDays ||
                0
            ),

          noticeDays:
            Number(
              noticeDays ||
                0
            ),

          isActive:
            Boolean(
              isActive
            ),
        });

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "leave_type.created",

        entity:
          "LeaveType",

        entityId:
          leaveType._id,

        description:
          `Leave policy ${leaveType.name} was created.`,
      });

      res
        .status(
          201
        )
        .json(
          leaveType
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
              ? "A leave policy with this code already exists."
              : "Unable to create leave policy.",
        });
    }
  };

export const updateLeaveType =
  async (
    req,
    res
  ) => {
    try {
      const allowed = [
        "name",
        "code",
        "daysPerYear",
        "isPaid",
        "allowHalfDay",
        "requiresReason",
        "carryForwardAllowed",
        "maxCarryForward",
        "maxConsecutiveDays",
        "noticeDays",
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
        updates.code
      ) {
        updates.code =
          String(
            updates.code
          )
            .trim()
            .toUpperCase();
      }

      [
        "daysPerYear",
        "maxCarryForward",
        "maxConsecutiveDays",
        "noticeDays",
      ].forEach(
        (
          key
        ) => {
          if (
            updates[
              key
            ] !==
            undefined
          ) {
            updates[
              key
            ] =
              Number(
                updates[
                  key
                ] ||
                  0
              );
          }
        }
      );

      if (
        updates.carryForwardAllowed ===
        false
      ) {
        updates.maxCarryForward =
          0;
      }

      const leaveType =
        await LeaveType.findOneAndUpdate(
          {
            _id:
              req.params.id,

            companyId:
              req.user.companyId,
          },

          updates,

          {
            new:
              true,

            runValidators:
              true,
          }
        );

      if (
        !leaveType
      ) {
        return res
          .status(
            404
          )
          .json({
            message:
              "Leave policy not found.",
          });
      }

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "leave_type.updated",

        entity:
          "LeaveType",

        entityId:
          leaveType._id,

        description:
          `Leave policy ${leaveType.name} was updated.`,
      });

      res.json(
        leaveType
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
              ? "A leave policy with this code already exists."
              : "Unable to update leave policy.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Leave Requests
|--------------------------------------------------------------------------
*/

export const getLeaveRequests =
  async (
    req,
    res
  ) => {
    try {
      await normalizeLegacyLeaveStatuses(
        req.user.companyId
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

      if (scopedIds) {
        query.employeeId = {
          $in:
            scopedIds,
        };
      }

      if (
        req.query.status
      ) {
        query.status =
          req.query.status;
      }

      const requests =
        await populateLeave(
          LeaveRequest.find(
            query
          )
        ).sort({
          createdAt: -1,
        });

      res.json(
        requests
      );
    } catch (error) {
      console.error(
        "getLeaveRequests:",
        error
      );

      res.status(500).json({
        message:
          "Unable to load leave requests.",
      });
    }
  };

/*
|--------------------------------------------------------------------------
| Create Leave Request
|--------------------------------------------------------------------------
*/

export const createLeaveRequest =
  async (
    req,
    res
  ) => {
    try {
      const {
        employeeId:
          requestedEmployeeId,

        leaveTypeId,

        startDate,

        endDate,

        halfDay =
          false,

        halfDayPeriod =
          "",

        reason =
          "",
      } =
        req.body;

      if (
        !leaveTypeId ||
        !startDate ||
        !endDate
      ) {
        return res
          .status(
            400
          )
          .json({
            message:
              "Leave type, start date and end date are required.",
          });
      }

      const actorEmployee =
        await getEmployeeForUser(
          req.user
        );

      const targetEmployeeId =
        requestedEmployeeId ||
        actorEmployee?._id;

      if (
        !targetEmployeeId
      ) {
        return res
          .status(
            400
          )
          .json({
            message:
              "Select an employee for this leave request.",
          });
      }

      const targetEmployee =
        await Employee.findOne({
          _id:
            targetEmployeeId,

          companyId:
            req.user.companyId,
        });

      if (
        !targetEmployee
      ) {
        return res
          .status(
            404
          )
          .json({
            message:
              "Employee not found.",
          });
      }

      const isSelf =
        actorEmployee?._id?.toString() ===
        targetEmployee._id.toString();

      if (
        !isSelf &&
        !(
          await canActForEmployee(
            req.user,
            targetEmployee._id
          )
        )
      ) {
        return res
          .status(
            403
          )
          .json({
            message:
              "You cannot submit leave for this employee.",
          });
      }

      const leaveType =
        await LeaveType.findOne({
          _id:
            leaveTypeId,

          companyId:
            req.user.companyId,

          isActive:
            true,
        });

      if (
        !leaveType
      ) {
        return res
          .status(
            400
          )
          .json({
            message:
              "Selected leave type is not available.",
          });
      }

      if (
        halfDay &&
        !leaveType.allowHalfDay
      ) {
        return res
          .status(
            400
          )
          .json({
            message:
              "Half-day requests are not allowed for this leave type.",
          });
      }

      if (
        leaveType.requiresReason &&
        !String(
          reason
        ).trim()
      ) {
        return res
          .status(
            400
          )
          .json({
            message:
              "A reason is required for this leave type.",
          });
      }

      if (
        new Date(
          endDate
        ) <
        new Date(
          startDate
        )
      ) {
        return res
          .status(
            400
          )
          .json({
            message:
              "End date cannot be before start date.",
          });
      }

      if (
        halfDay &&
        new Date(
          startDate
        ).toDateString() !==
          new Date(
            endDate
          ).toDateString()
      ) {
        return res
          .status(
            400
          )
          .json({
            message:
              "A half-day request must be for one date.",
          });
      }

      const days =
        await calculateLeaveDaysWithCalendar({
          companyId:
            req.user.companyId,

          startDate,

          endDate,

          halfDay,
        });

      if (
        days <=
        0
      ) {
        return res
          .status(
            400
          )
          .json({
            message:
              "The selected dates do not contain a working day.",
          });
      }

      /*
      |--------------------------------------------------------------------------
      | Maximum Consecutive Days
      |--------------------------------------------------------------------------
      */

      if (
        leaveType.maxConsecutiveDays >
          0 &&
        days >
          leaveType.maxConsecutiveDays
      ) {
        return res
          .status(
            400
          )
          .json({
            message:
              `${leaveType.name} allows a maximum of ${leaveType.maxConsecutiveDays} consecutive day(s).`,
          });
      }

      /*
      |--------------------------------------------------------------------------
      | Minimum Notice
      |--------------------------------------------------------------------------
      */

      if (
        Number(
          leaveType.noticeDays ||
            0
        ) >
        0
      ) {
        const todayDate =
          new Date();

        todayDate.setHours(
          0,
          0,
          0,
          0
        );

        const leaveStart =
          new Date(
            startDate
          );

        leaveStart.setHours(
          0,
          0,
          0,
          0
        );

        const difference =
          Math.floor(
            (
              leaveStart -
              todayDate
            ) /
              86400000
          );

        if (
          difference <
          leaveType.noticeDays
        ) {
          return res
            .status(
              400
            )
            .json({
              message:
                `${leaveType.name} requires at least ${leaveType.noticeDays} day(s) advance notice.`,
            });
        }
      }

      /*
      |--------------------------------------------------------------------------
      | Overlap
      |--------------------------------------------------------------------------
      */

      const overlap =
        await LeaveRequest.findOne({
          companyId:
            req.user.companyId,

          employeeId:
            targetEmployee._id,

          status: {
            $in: [
              "pending",
              "approved",
            ],
          },

          startDate: {
            $lte:
              new Date(
                endDate
              ),
          },

          endDate: {
            $gte:
              new Date(
                startDate
              ),
          },
        });

      if (
        overlap
      ) {
        return res
          .status(
            409
          )
          .json({
            message:
              "This employee already has a leave request overlapping these dates.",
          });
      }

      /*
      |--------------------------------------------------------------------------
      | Entitlement
      |--------------------------------------------------------------------------
      */

      const year =
        new Date(
          startDate
        ).getFullYear();

      const entitlement =
        await getEntitlement({
          companyId:
            req.user.companyId,

          employeeId:
            targetEmployee._id,

          leaveType,

          year,
        });

      const allocated =
        await getUsedLeaveDays({
          companyId:
            req.user.companyId,

          employeeId:
            targetEmployee._id,

          leaveTypeId:
            leaveType._id,

          year,

          statuses: [
            "pending",
            "approved",
          ],
        });

      if (
        !entitlement.unlimited &&
        allocated +
          days >
          entitlement.total
      ) {
        const available =
          Math.max(
            0,

            entitlement.total -
              allocated
          );

        return res
          .status(
            400
          )
          .json({
            message:
              `Only ${available} day(s) of ${leaveType.name} are currently available.`,
          });
      }

      /*
      |--------------------------------------------------------------------------
      | Create
      |--------------------------------------------------------------------------
      */

      const leave =
        await LeaveRequest.create({
          companyId:
            req.user.companyId,

          employeeId:
            targetEmployee._id,

          leaveTypeId,

          requestedByUserId:
            req.user._id,

          requestedByRole:
            req.user.role,

          requestedOnBehalf:
            !isSelf,

          requestSource:
            isSelf
              ? "self"
              : "on-behalf",

          status:
            "pending",

          approvalHistory: [
            {
              status:
                "pending",

              note:
                isSelf
                  ? "Leave request submitted by employee."
                  : "Leave request submitted on behalf of employee.",

              byUserId:
                req.user._id,

              byRole:
                req.user.role,
            },
          ],

          startDate,

          endDate,

          halfDay,

          halfDayPeriod:
            halfDay
              ? halfDayPeriod
              : "",

          days,

          reason:
            String(
              reason ||
                ""
            ).trim(),
        });

        const submitterName =
          actorEmployee
            ? `${actorEmployee.firstName} ${actorEmployee.lastName || ""}`.trim()
            : `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() ||
              req.user.email;

        const targetName =
          `${targetEmployee.firstName} ${targetEmployee.lastName || ""}`.trim();

        const roleLabel =
          req.user.role ===
          "hr"
            ? "HR"
            : String(
                req.user.role ||
                  "User"
              )
                .replaceAll(
                  "-",
                  " "
                )
                .replace(
                  /\b\w/g,
                  (
                    character
                  ) =>
                    character.toUpperCase()
                );

        if (
          !isSelf
        ) {
          await notifyEmployee({
            companyId:
              req.user.companyId,

            employeeId:
              targetEmployee._id,

            type:
              "leave",

            title:
              "Leave submitted on your behalf",

            message:
              `${submitterName} (${roleLabel}) submitted ${leave.days} day(s) of ${leaveType.name} on your behalf.`,

            link:
              "/leaves",

            metadata: {
              leaveRequestId:
                leave._id,
            },
          });
        }

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "leave.requested",

        entity:
          "LeaveRequest",

        entityId:
          leave._id,

        description:
          `${leave.days} day leave request was submitted${!isSelf ? " on behalf of an employee" : ""}.`,
      });

      await notifyUsersWithPermission({
        companyId: req.user.companyId,
        permission: "leave.approve",
        excludeUserId: req.user._id,
        type: "leave",
        title: "New leave request",
        message:
        isSelf
          ? `${targetName} requested ${leave.days} day(s) of ${leaveType.name}.`
          : `${submitterName} (${roleLabel}) submitted ${leave.days} day(s) of ${leaveType.name} on behalf of ${targetName}.`,
        link: "/leaves",
        metadata: {
          leaveRequestId: leave._id,
          employeeId: targetEmployee._id,
        },
      });

      res
        .status(
          201
        )
        .json(
          await populateLeave(
            LeaveRequest.findById(
              leave._id
            )
          )
        );
    } catch (error) {
      console.error(
        "createLeaveRequest:",
        error
      );

      res
        .status(
          500
        )
        .json({
          message:
            "Unable to submit leave request.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Review
|--------------------------------------------------------------------------
*/

export const reviewLeaveRequest =
  async (
    req,
    res
  ) => {
    try {
      const {
        status,
        note =
          "",
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
          .status(
            400
          )
          .json({
            message:
              "Choose Approve or Reject.",
          });
      }

      if (
        status ===
          "rejected" &&
        !String(
          note ||
            ""
        ).trim()
      ) {
        return res
          .status(400)
          .json({
            message:
              "A rejection reason is required.",
          });
      }

      const leave =
        await LeaveRequest.findOne({
          _id:
            req.params.id,

          companyId:
            req.user.companyId,
        });

      if (
        !leave
      ) {
        return res
          .status(
            404
          )
          .json({
            message:
              "Leave request not found.",
          });
      }

      if (
        LEGACY_PENDING_STATUSES.includes(
          leave.status
        )
      ) {
        leave.status =
          "pending";
      }

      if (
        leave.status !==
        "pending"
      ) {
        return res
          .status(
            409
          )
          .json({
            message:
              "This leave request has already been reviewed.",
          });
      }

      if (
        !(
          await canActForEmployee(
            req.user,
            leave.employeeId
          )
        )
      ) {
        return res
          .status(
            403
          )
          .json({
            message:
              "You cannot review this employee's leave request.",
          });
      }

      const actorEmployee =
        await getEmployeeForUser(
          req.user
        );

      if (
        actorEmployee?._id?.toString() ===
        leave.employeeId.toString()
      ) {
        return res
          .status(
            403
          )
          .json({
            message:
              "You cannot approve or reject your own leave request.",
          });
      }

      leave.status =
        status;

      leave.reviewNote =
        String(
          note ||
            ""
        ).trim();

      leave.reviewedByUserId =
        req.user._id;

      leave.reviewedAt =
        new Date();

      leave.approvalHistory.push({
        status,

        note:
          leave.reviewNote,

        byUserId:
          req.user._id,

        byRole:
          req.user.role,

        at:
          new Date(),
      });

      await leave.save();

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          `leave.${status}`,

        entity:
          "LeaveRequest",

        entityId:
          leave._id,

        description:
          `Leave request was ${status}.`,
      });

      const reviewedLeaveType =
        await LeaveType.findById(
          leave.leaveTypeId
        ).select("name");

      await notifyEmployee({
        companyId: req.user.companyId,
        employeeId: leave.employeeId,
        type: "leave",
        title:
          status === "approved"
            ? "Leave approved"
            : "Leave rejected",
        message:
          leave.reviewNote ||
          `Your ${reviewedLeaveType?.name || "leave"} request was ${status}.`,
        link: "/leaves",
        metadata: {
          leaveRequestId: leave._id,
          status,
        },
      });

      res.json(
        await populateLeave(
          LeaveRequest.findById(
            leave._id
          )
        )
      );
    } catch (error) {
      res
        .status(
          500
        )
        .json({
          message:
            "Unable to review leave request.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Cancel
|--------------------------------------------------------------------------
*/

export const cancelLeaveRequest =
  async (
    req,
    res
  ) => {
    try {
      const leave =
        await LeaveRequest.findOne({
          _id:
            req.params.id,

          companyId:
            req.user.companyId,
        });

      if (
        !leave
      ) {
        return res
          .status(
            404
          )
          .json({
            message:
              "Leave request not found.",
          });
      }

      const actorEmployee =
        await getEmployeeForUser(
          req.user
        );

      const isOwner =
        actorEmployee?._id?.toString() ===
        leave.employeeId.toString();

      if (
        !isOwner &&
        ![
          "admin",
          "hr",
        ].includes(
          req.user.role
        )
      ) {
        return res
          .status(
            403
          )
          .json({
            message:
              "You cannot cancel this leave request.",
          });
      }

      if (
        ![
          "pending",
          "approved",
        ].includes(
          leave.status
        )
      ) {
        return res
          .status(
            409
          )
          .json({
            message:
              "This leave request cannot be cancelled.",
          });
      }

      leave.status =
        "cancelled";

      leave.reviewedByUserId =
        req.user._id;

      leave.reviewedAt =
        new Date();

      leave.approvalHistory.push({
        status:
          "cancelled",

        note:
          isOwner
            ? "Leave request cancelled by employee."
            : "Leave request cancelled by HR/Admin.",

        byUserId:
          req.user._id,

        byRole:
          req.user.role,

        at:
          new Date(),
      });

      await leave.save();

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "leave.cancelled",

        entity:
          "LeaveRequest",

        entityId:
          leave._id,

        description:
          "Leave request was cancelled.",
      });

      if (isOwner) {
        await notifyUsersWithPermission({
          companyId: req.user.companyId,
          permission: "leave.approve",
          excludeUserId: req.user._id,
          type: "leave",
          title: "Leave request cancelled",
          message: "An employee cancelled a leave request.",
          link: "/leaves",
          metadata: {
            leaveRequestId: leave._id,
          },
        });
      } else {
        await notifyEmployee({
          companyId: req.user.companyId,
          employeeId: leave.employeeId,
          type: "leave",
          title: "Leave cancelled",
          message:
            "Your leave request was cancelled by HR.",
          link: "/leaves",
          metadata: {
            leaveRequestId: leave._id,
          },
        });
      }

      res.json(
        await populateLeave(
          LeaveRequest.findById(
            leave._id
          )
        )
      );
    } catch (error) {
      res
        .status(
          500
        )
        .json({
          message:
            "Unable to cancel leave request.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| My Leave Balances
|--------------------------------------------------------------------------
*/

export const getMyLeaveBalances =
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
        return res.json(
          []
        );
      }

      const year =
        Number(
          req.query.year
        ) ||
        new Date().getFullYear();

      const leaveTypes =
        await LeaveType.find({
          companyId:
            req.user.companyId,

          isActive:
            true,
        }).sort({
          name:
            1,
        });

      const balances =
        [];

      for (
        const type of leaveTypes
      ) {
        const entitlement =
          await getEntitlement({
            companyId:
              req.user.companyId,

            employeeId:
              employee._id,

            leaveType:
              type,

            year,
          });

        const approved =
          await getUsedLeaveDays({
            companyId:
              req.user.companyId,

            employeeId:
              employee._id,

            leaveTypeId:
              type._id,

            year,

            statuses: [
              "approved",
            ],
          });

        const pending =
          await getUsedLeaveDays({
            companyId:
              req.user.companyId,

            employeeId:
              employee._id,

            leaveTypeId:
              type._id,

            year,

            statuses: [
              "pending",
            ],
          });

        balances.push({
          leaveType:
            type,

          unlimited:
            entitlement.unlimited,

          baseEntitlement:
            entitlement.base,

          carryForward:
            entitlement.carryForward,

          entitled:
            entitlement.total,

          approved,

          pending,

          available:
            entitlement.unlimited
              ? null
              : Math.max(
                  0,

                  entitlement.total -
                    approved -
                    pending
                ),
        });
      }

      res.json(
        balances
      );
    } catch (error) {
      console.error(
        "getMyLeaveBalances:",
        error
      );

      res
        .status(
          500
        )
        .json({
          message:
            "Unable to load leave balances.",
        });
    }
  };

export const getEmployeeLeaveBalances =
  async (
    req,
    res
  ) => {
    try {
      if (
        req.user.role !==
        "admin"
      ) {
        return res
          .status(403)
          .json({
            message:
              "Only an administrator can view another employee's leave balance from the dashboard.",
          });
      }

      const employee =
        await Employee.findOne({
          _id:
            req.params.employeeId,

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

      const year =
        Number(
          req.query.year
        ) ||
        new Date().getFullYear();

      const leaveTypes =
        await LeaveType.find({
          companyId:
            req.user.companyId,

          isActive:
            true,
        }).sort({
          name:
            1,
        });

      const balances =
        [];

      for (
        const type of leaveTypes
      ) {
        const entitlement =
          await getEntitlement({
            companyId:
              req.user.companyId,

            employeeId:
              employee._id,

            leaveType:
              type,

            year,
          });

        const approved =
          await getUsedLeaveDays({
            companyId:
              req.user.companyId,

            employeeId:
              employee._id,

            leaveTypeId:
              type._id,

            year,

            statuses: [
              "approved",
            ],
          });

        const pending =
          await getUsedLeaveDays({
            companyId:
              req.user.companyId,

            employeeId:
              employee._id,

            leaveTypeId:
              type._id,

            year,

            statuses: [
              "pending",
            ],
          });

        balances.push({
          leaveType:
            type,

          unlimited:
            entitlement.unlimited,

          baseEntitlement:
            entitlement.base,

          carryForward:
            entitlement.carryForward,

          entitled:
            entitlement.total,

          approved,

          pending,

          available:
            entitlement.unlimited
              ? null
              : Math.max(
                  0,
                  entitlement.total -
                    approved -
                    pending
                ),
        });
      }

      res.json(
        balances
      );
    } catch (error) {
      console.error(
        "getEmployeeLeaveBalances:",
        error
      );

      res
        .status(500)
        .json({
          message:
            "Unable to load employee leave balances.",
        });
    }
  };