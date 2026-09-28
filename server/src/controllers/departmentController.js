import Department from "../models/Department.js";
import Employee from "../models/Employees.js";

import {
  writeAudit,
} from "../utils/audit.js";

import {
  notifyEmployee,
} from "../utils/notifications.js";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const getValidHod = async (
  companyId,
  hodId
) => {
  if (!hodId) {
    return null;
  }

  const employee =
    await Employee.findOne({
      _id: hodId,
      companyId,
      status: {
        $ne: "inactive",
      },
    });

  if (!employee) {
    throw Object.assign(
      new Error(
        "Selected Head of Department is invalid or inactive."
      ),
      {
        statusCode: 400,
      }
    );
  }

  return employee;
};

const getDepartmentCounts =
  async (
    companyId
  ) => {
    const [
      totalCounts,
      activeCounts,
    ] =
      await Promise.all([
        Employee.aggregate([
          {
            $match: {
              companyId,
            },
          },

          {
            $group: {
              _id:
                "$departmentId",

              count: {
                $sum:
                  1,
              },
            },
          },
        ]),

        Employee.aggregate([
          {
            $match: {
              companyId,

              status: {
                $ne:
                  "inactive",
              },
            },
          },

          {
            $group: {
              _id:
                "$departmentId",

              count: {
                $sum:
                  1,
              },
            },
          },
        ]),
      ]);

    const totalMap =
      {};

    const activeMap =
      {};

    totalCounts.forEach(
      (
        item
      ) => {
        if (
          item._id
        ) {
          totalMap[
            String(
              item._id
            )
          ] =
            item.count;
        }
      }
    );

    activeCounts.forEach(
      (
        item
      ) => {
        if (
          item._id
        ) {
          activeMap[
            String(
              item._id
            )
          ] =
            item.count;
        }
      }
    );

    return {
      totalMap,
      activeMap,
    };
  };

const notifyDepartmentEmployees =
  async ({
    companyId,
    departmentId,
    title,
    message,
    excludeEmployeeIds = [],
  }) => {
    const employees =
      await Employee.find({
        companyId,

        departmentId,

        status: {
          $ne:
            "inactive",
        },
      }).select(
        "_id"
      );

    const excluded =
      new Set(
        excludeEmployeeIds
          .filter(
            Boolean
          )
          .map(
            String
          )
      );

    for (
      const employee
      of employees
    ) {
      if (
        excluded.has(
          String(
            employee._id
          )
        )
      ) {
        continue;
      }

      await notifyEmployee({
        companyId,

        employeeId:
          employee._id,

        type:
          "employee",

        title,

        message,

        link:
          "/departments",

        metadata: {
          departmentId,
        },
      });
    }
  };

/*
|--------------------------------------------------------------------------
| Get Departments
|--------------------------------------------------------------------------
*/

export const getDepartments =
  async (
    req,
    res
  ) => {
    try {
      const [
        departments,
        counts,
      ] =
        await Promise.all([
          Department.find({
            companyId:
              req.user.companyId,
          })
            .populate(
              "hodId",
              "firstName lastName employeeCode designation status"
            )
            .sort({
              isActive:
                -1,

              name:
                1,
            }),

          getDepartmentCounts(
            req.user.companyId
          ),
        ]);

      res.json(
        departments.map(
          (
            department
          ) => {
            const id =
              String(
                department._id
              );

            return {
              ...department.toObject(),

              employeeCount:
                counts
                  .totalMap[
                  id
                ] ||
                0,

              activeEmployeeCount:
                counts
                  .activeMap[
                  id
                ] ||
                0,
            };
          }
        )
      );
    } catch (error) {
      console.error(
        "getDepartments:",
        error
      );

      res
        .status(500)
        .json({
          message:
            "Unable to load departments.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Create Department
|--------------------------------------------------------------------------
*/

export const createDepartment =
  async (
    req,
    res
  ) => {
    try {
      const {
        name,
        code,
        description =
          "",
        hodId =
          null,
      } =
        req.body;

      if (
        !String(
          name ||
            ""
        ).trim() ||
        !String(
          code ||
            ""
        ).trim()
      ) {
        return res
          .status(400)
          .json({
            message:
              "Department name and code are required.",
          });
      }

      const hod =
        await getValidHod(
          req.user.companyId,
          hodId
        );

      const department =
        await Department.create({
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

          description:
            String(
              description ||
                ""
            ).trim(),

          hodId:
            hod?._id ||
            null,

          isActive:
            true,
        });

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "department.created",

        entity:
          "Department",

        entityId:
          department._id,

        description:
          `Department ${department.name} was created.`,
      });

      if (
        hod
      ) {
        await notifyEmployee({
          companyId:
            req.user.companyId,

          employeeId:
            hod._id,

          type:
            "employee",

          title:
            "Head of Department assigned",

          message:
            `You have been assigned as Head of Department for ${department.name}.`,

          link:
            "/departments",

          metadata: {
            departmentId:
              department._id,
          },
        });
      }

      const populated =
        await Department.findById(
          department._id
        ).populate(
          "hodId",
          "firstName lastName employeeCode designation status"
        );

      res
        .status(201)
        .json({
          ...populated.toObject(),

          employeeCount:
            0,

          activeEmployeeCount:
            0,
        });
    } catch (error) {
      console.error(
        "createDepartment:",
        error
      );

      res
        .status(
          error.statusCode ||
            (
              error.code ===
              11000
                ? 409
                : 500
            )
        )
        .json({
          message:
            error.statusCode
              ? error.message
              : error.code ===
                  11000
                ? "A department with this name or code already exists."
                : "Unable to create department.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Update Department
|--------------------------------------------------------------------------
*/

export const updateDepartment =
  async (
    req,
    res
  ) => {
    try {
      const department =
        await Department.findOne({
          _id:
            req.params.id,

          companyId:
            req.user.companyId,
        });

      if (
        !department
      ) {
        return res
          .status(404)
          .json({
            message:
              "Department not found.",
          });
      }

      const oldName =
        department.name;

      const oldHodId =
        department.hodId
          ? String(
              department.hodId
            )
          : "";

      const oldActive =
        department.isActive;

      const {
        name,
        code,
        description,
        hodId,
        isActive,
      } =
        req.body;

      /*
      |--------------------------------------------------------------------------
      | Safe Deactivate
      |--------------------------------------------------------------------------
      */

      if (
        isActive ===
          false &&
        department.isActive
      ) {
        const activeEmployees =
          await Employee.countDocuments({
            companyId:
              req.user.companyId,

            departmentId:
              department._id,

            status: {
              $ne:
                "inactive",
            },
          });

        if (
          activeEmployees >
          0
        ) {
          return res
            .status(400)
            .json({
              message:
                `This department still has ${activeEmployees} active employee(s). Reassign or deactivate them before deactivating the department.`,
            });
        }
      }

      /*
      |--------------------------------------------------------------------------
      | HOD Validation
      |--------------------------------------------------------------------------
      */

      let newHod =
        null;

      if (
        hodId !==
        undefined
      ) {
        newHod =
          await getValidHod(
            req.user.companyId,
            hodId
          );

        department.hodId =
          newHod?._id ||
          null;
      }

      /*
      |--------------------------------------------------------------------------
      | Update Fields
      |--------------------------------------------------------------------------
      */

      if (
        name !==
        undefined
      ) {
        const cleaned =
          String(
            name
          ).trim();

        if (
          !cleaned
        ) {
          return res
            .status(400)
            .json({
              message:
                "Department name cannot be empty.",
            });
        }

        department.name =
          cleaned;
      }

      if (
        code !==
        undefined
      ) {
        const cleaned =
          String(
            code
          )
            .trim()
            .toUpperCase();

        if (
          !cleaned
        ) {
          return res
            .status(400)
            .json({
              message:
                "Department code cannot be empty.",
            });
        }

        department.code =
          cleaned;
      }

      if (
        description !==
        undefined
      ) {
        department.description =
          String(
            description ||
              ""
          ).trim();
      }

      if (
        isActive !==
        undefined
      ) {
        department.isActive =
          Boolean(
            isActive
          );
      }

      await department.save();

      const newHodId =
        department.hodId
          ? String(
              department.hodId
            )
          : "";

      const hodChanged =
        oldHodId !==
        newHodId;

      const nameChanged =
        oldName !==
        department.name;

      const statusChanged =
        oldActive !==
        department.isActive;

      /*
      |--------------------------------------------------------------------------
      | Notifications
      |--------------------------------------------------------------------------
      */

      if (
        hodChanged
      ) {
        if (
          oldHodId
        ) {
          await notifyEmployee({
            companyId:
              req.user.companyId,

            employeeId:
              oldHodId,

            type:
              "employee",

            title:
              "Head of Department updated",

            message:
              `You are no longer assigned as Head of Department for ${department.name}.`,

            link:
              "/departments",

            metadata: {
              departmentId:
                department._id,
            },
          });
        }

        if (
          newHodId
        ) {
          await notifyEmployee({
            companyId:
              req.user.companyId,

            employeeId:
              newHodId,

            type:
              "employee",

            title:
              "Head of Department assigned",

            message:
              `You have been assigned as Head of Department for ${department.name}.`,

            link:
              "/departments",

            metadata: {
              departmentId:
                department._id,
            },
          });
        }

        await notifyDepartmentEmployees({
          companyId:
            req.user.companyId,

          departmentId:
            department._id,

          title:
            "Department leadership updated",

          message:
            newHod
              ? `${newHod.firstName} ${newHod.lastName || ""}`.trim() +
                ` is now Head of Department for ${department.name}.`
              : `${department.name} currently has no Head of Department assigned.`,

          excludeEmployeeIds: [
            oldHodId,
            newHodId,
          ],
        });
      }

      if (
        nameChanged
      ) {
        await notifyDepartmentEmployees({
          companyId:
            req.user.companyId,

          departmentId:
            department._id,

          title:
            "Department updated",

          message:
            `Your department has been renamed from ${oldName} to ${department.name}.`,
        });
      }

      if (
        statusChanged &&
        department.isActive
      ) {
        await notifyDepartmentEmployees({
          companyId:
            req.user.companyId,

          departmentId:
            department._id,

          title:
            "Department activated",

          message:
            `${department.name} is now active.`,
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Audit
      |--------------------------------------------------------------------------
      */

      await writeAudit({
        companyId:
          req.user.companyId,

        actorUserId:
          req.user._id,

        action:
          "department.updated",

        entity:
          "Department",

        entityId:
          department._id,

        description:
          `Department ${department.name} was updated.`,
      });

      const counts =
        await getDepartmentCounts(
          req.user.companyId
        );

      const populated =
        await Department.findById(
          department._id
        ).populate(
          "hodId",
          "firstName lastName employeeCode designation status"
        );

      const id =
        String(
          department._id
        );

      res.json({
        ...populated.toObject(),

        employeeCount:
          counts
            .totalMap[
            id
          ] ||
          0,

        activeEmployeeCount:
          counts
            .activeMap[
            id
          ] ||
          0,
      });
    } catch (error) {
      console.error(
        "updateDepartment:",
        error
      );

      res
        .status(
          error.statusCode ||
            (
              error.code ===
              11000
                ? 409
                : 500
            )
        )
        .json({
          message:
            error.statusCode
              ? error.message
              : error.code ===
                  11000
                ? "A department with this name or code already exists."
                : "Unable to update department.",
        });
    }
  };