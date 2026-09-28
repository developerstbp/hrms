import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Employee from "../models/Employees.js";

import {
  sendNotificationEmail,
} from "./mailer.js";

/*
|--------------------------------------------------------------------------
| Notify One User
|--------------------------------------------------------------------------
*/

export const notifyUser =
  async ({
    companyId,
    userId,
    type = "system",
    title,
    message,
    link = "",
    metadata = {},
  }) => {
    if (
      !companyId ||
      !userId ||
      !title ||
      !message
    ) {
      return null;
    }

    const notification =
      await Notification.create({
        companyId,
        userId,
        type,
        title,
        message,
        link,
        metadata,
      });

    /*
    |--------------------------------------------------------------------------
    | Email is fail-safe.
    | sendNotificationEmail catches its own delivery errors.
    |--------------------------------------------------------------------------
    */

    await sendNotificationEmail({
      companyId,
      userId,
      type,
      title,
      message,
      link,
    });

    return notification;
  };

/*
|--------------------------------------------------------------------------
| Notify Employee
|--------------------------------------------------------------------------
*/

export const notifyEmployee =
  async ({
    companyId,
    employeeId,
    type = "system",
    title,
    message,
    link = "",
    metadata = {},
  }) => {
    const employee =
      await Employee.findOne({
        _id:
          employeeId,

        companyId,
      }).select(
        "userId"
      );

    if (
      !employee?.userId
    ) {
      return null;
    }

    return notifyUser({
      companyId,

      userId:
        employee.userId,

      type,

      title,

      message,

      link,

      metadata,
    });
  };

/*
|--------------------------------------------------------------------------
| Notify Permission Group
|--------------------------------------------------------------------------
*/

export const notifyUsersWithPermission =
  async ({
    companyId,
    permission,
    excludeUserId = null,
    type = "system",
    title,
    message,
    link = "",
    metadata = {},
  }) => {
    const query = {
      companyId,

      isActive:
        true,

      $or: [
        {
          role:
            "admin",
        },

        {
          permissions:
            permission,
        },
      ],
    };

    if (
      excludeUserId
    ) {
      query._id = {
        $ne:
          excludeUserId,
      };
    }

    const users =
      await User.find(
        query
      ).select(
        "_id"
      );

    if (
      !users.length
    ) {
      return [];
    }

    const notifications =
      await Notification.insertMany(
        users.map(
          (
            user
          ) => ({
            companyId,

            userId:
              user._id,

            type,

            title,

            message,

            link,

            metadata,
          })
        )
      );

    /*
    |--------------------------------------------------------------------------
    | Send associated emails
    |--------------------------------------------------------------------------
    */

    await Promise.all(
      users.map(
        (
          user
        ) =>
          sendNotificationEmail({
            companyId,

            userId:
              user._id,

            type,

            title,

            message,

            link,
          })
      )
    );

    return notifications;
  };

  /*
|--------------------------------------------------------------------------
| Notify All Active Company Users
|--------------------------------------------------------------------------
*/

export const notifyCompanyUsers =
  async ({
    companyId,
    excludeUserId = null,
    type = "system",
    title,
    message,
    link = "",
    metadata = {},
  }) => {
    if (
      !companyId ||
      !title ||
      !message
    ) {
      return [];
    }

    const query = {
      companyId,
      isActive: true,
    };

    if (
      excludeUserId
    ) {
      query._id = {
        $ne:
          excludeUserId,
      };
    }

    const users =
      await User.find(
        query
      ).select(
        "_id"
      );

    if (
      !users.length
    ) {
      return [];
    }

    const notifications =
      await Notification.insertMany(
        users.map(
          (
            user
          ) => ({
            companyId,

            userId:
              user._id,

            type,

            title,

            message,

            link,

            metadata,
          })
        )
      );

    await Promise.all(
      users.map(
        (
          user
        ) =>
          sendNotificationEmail({
            companyId,

            userId:
              user._id,

            type,

            title,

            message,

            link,
          })
      )
    );

    return notifications;
  };