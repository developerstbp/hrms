import Employee from "../models/Employees.js";
import Attendance from "../models/Attendance.js";
import LeaveRequest from "../models/LeaveRequest.js";
import EmployeeLifecycleEvent from "../models/EmployeeLifecycleEvent.js";
import {
  getScopedEmployeeIds,
} from "../utils/scope.js";

const rangeQuery = (
  from,
  to,
  field = "date"
) => {
  const query = {};

  if (from) {
    query.$gte =
      new Date(
        `${String(from).slice(
          0,
          10
        )}T00:00:00.000Z`
      );
  }

  if (to) {
    query.$lte =
      new Date(
        `${String(to).slice(
          0,
          10
        )}T23:59:59.999Z`
      );
  }

  return Object.keys(
    query
  ).length
    ? {
        [field]:
          query,
      }
    : {};
};

/*
|--------------------------------------------------------------------------
| Headcount / Employee Report
|--------------------------------------------------------------------------
*/

export const getHeadcountReport =
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
        scopedIds
      ) {
        query._id = {
          $in:
            scopedIds,
        };
      }

      const employees =
        await Employee.find(
          query
        )
          .populate(
            "departmentId",
            "name code"
          )
          .populate(
            "designationId",
            "name code"
          )
          .populate(
            "locationId",
            "name code"
          )
          .populate(
            "gradeId",
            "name code"
          )
          .populate(
            "managerId",
            "firstName lastName employeeCode"
          )
          .sort({
            firstName:
              1,

            lastName:
              1,
          });

      res.json(
        employees
      );
    } catch (error) {
      res
        .status(500)
        .json({
          message:
            "Unable to generate headcount report.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Attendance Report
|--------------------------------------------------------------------------
*/

export const getAttendanceReport =
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

        ...rangeQuery(
          req.query.from,
          req.query.to,
          "date"
        ),
      };

      if (
        scopedIds
      ) {
        query.employeeId = {
          $in:
            scopedIds,
        };
      }

      if (
        req.query.status &&
        req.query.status !==
          "all"
      ) {
        query.status =
          req.query.status;
      }

      const records =
        await Attendance.find(
          query
        )
          .populate({
            path:
              "employeeId",

            select:
              "firstName lastName employeeCode designation departmentId",

            populate: {
              path:
                "departmentId",

              select:
                "name code",
            },
          })
          .sort({
            date:
              -1,
          });

      res.json(
        records
      );
    } catch (error) {
      res
        .status(500)
        .json({
          message:
            "Unable to generate attendance report.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Leave Report
|--------------------------------------------------------------------------
*/

export const getLeaveReport =
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
        scopedIds
      ) {
        query.employeeId = {
          $in:
            scopedIds,
        };
      }

      if (
        req.query.year
      ) {
        const year =
          Number(
            req.query.year
          );

        query.startDate = {
          $gte:
            new Date(
              `${year}-01-01T00:00:00.000Z`
            ),

          $lte:
            new Date(
              `${year}-12-31T23:59:59.999Z`
            ),
        };
      }

      if (
        req.query.status &&
        req.query.status !==
          "all"
      ) {
        query.status =
          req.query.status;
      }

      const records =
        await LeaveRequest.find(
          query
        )
          .populate({
            path:
              "employeeId",

            select:
              "firstName lastName employeeCode designation departmentId",

            populate: {
              path:
                "departmentId",

              select:
                "name code",
            },
          })
          .populate(
            "leaveTypeId",
            "name code isPaid"
          )
          .populate(
            "requestedByUserId",
            "firstName lastName role"
          )
          .sort({
            startDate:
              -1,
          });

      res.json(
        records
      );
    } catch (error) {
      res
        .status(500)
        .json({
          message:
            "Unable to generate leave report.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Employee Movement Report
|--------------------------------------------------------------------------
*/

export const getMovementReport =
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

        ...rangeQuery(
          req.query.from,
          req.query.to,
          "effectiveDate"
        ),
      };

      if (
        scopedIds
      ) {
        query.employeeId = {
          $in:
            scopedIds,
        };
      }

      const records =
        await EmployeeLifecycleEvent.find(
          query
        )
          .populate(
            "employeeId",
            "firstName lastName employeeCode"
          )
          .populate(
            "performedByUserId",
            "firstName lastName email role"
          )
          .sort({
            effectiveDate:
              -1,

            createdAt:
              -1,
          });

      res.json(
        records
      );
    } catch (error) {
      res
        .status(500)
        .json({
          message:
            "Unable to generate employee movement report.",
        });
    }
  };