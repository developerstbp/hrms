import Notification from "../models/Notification.js";

/*
|--------------------------------------------------------------------------
| Get Notifications
|--------------------------------------------------------------------------
*/

export const getNotifications = async (
  req,
  res
) => {
  try {
    const limit =
      Math.min(
        Math.max(
          Number(
            req.query.limit ||
            50
          ),
          1
        ),
        200
      );

    const query = {
      companyId:
        req.user.companyId,

      userId:
        req.user._id,
    };

    if (
      req.query.unread ===
      "true"
    ) {
      query.isRead =
        false;
    }

    const notifications =
      await Notification.find(
        query
      )
        .sort({
          createdAt: -1,
        })
        .limit(
          limit
        );

    const unreadCount =
      await Notification.countDocuments(
        {
          companyId:
            req.user.companyId,

          userId:
            req.user._id,

          isRead:
            false,
        }
      );

    res.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        message:
          "Unable to load notifications.",
      });
  }
};

/*
|--------------------------------------------------------------------------
| Mark One As Read
|--------------------------------------------------------------------------
*/

export const markNotificationRead =
  async (
    req,
    res
  ) => {
    try {
      const notification =
        await Notification.findOneAndUpdate(
          {
            _id:
              req.params.id,

            companyId:
              req.user
                .companyId,

            userId:
              req.user._id,
          },

          {
            isRead:
              true,

            readAt:
              new Date(),
          },

          {
            returnDocument:
              "after",
          }
        );

      if (!notification) {
        return res
          .status(404)
          .json({
            message:
              "Notification not found.",
          });
      }

      res.json(
        notification
      );
    } catch (error) {
      res
        .status(500)
        .json({
          message:
            "Unable to update notification.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Mark All As Read
|--------------------------------------------------------------------------
*/

export const markAllNotificationsRead =
  async (
    req,
    res
  ) => {
    try {
      await Notification.updateMany(
        {
          companyId:
            req.user.companyId,

          userId:
            req.user._id,

          isRead:
            false,
        },

        {
          $set: {
            isRead:
              true,

            readAt:
              new Date(),
          },
        }
      );

      res.json({
        message:
          "All notifications marked as read.",
      });
    } catch (error) {
      res
        .status(500)
        .json({
          message:
            "Unable to update notifications.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| Delete Notification
|--------------------------------------------------------------------------
*/

export const deleteNotification =
  async (
    req,
    res
  ) => {
    try {
      const notification =
        await Notification.findOneAndDelete(
          {
            _id:
              req.params.id,

            companyId:
              req.user
                .companyId,

            userId:
              req.user._id,
          }
        );

      if (!notification) {
        return res
          .status(404)
          .json({
            message:
              "Notification not found.",
          });
      }

      res.json({
        message:
          "Notification removed.",
      });
    } catch (error) {
      res
        .status(500)
        .json({
          message:
            "Unable to delete notification.",
        });
    }
  };

  /*
|--------------------------------------------------------------------------
| Theme Change Notification
|--------------------------------------------------------------------------
*/

export const createThemeChangeNotification =
  async (
    req,
    res
  ) => {
    try {
      const labels = {
        normal:
          "Normal",

        ocean:
          "Aasiya's UI",

        dark:
          "Dark",
      };

      const theme =
        String(
          req.body.theme ||
            ""
        );

      if (
        !labels[
          theme
        ]
      ) {
        return res
          .status(400)
          .json({
            message:
              "Invalid interface theme.",
          });
      }

      const notification =
        await Notification.create({
          companyId:
            req.user.companyId,

          userId:
            req.user._id,

          type:
            "system",

          title:
            "Interface theme changed",

          message:
            `Your HRMS interface theme was changed to ${labels[theme]}.`,

          link:
            "/profile",

          metadata: {
            theme,
          },
        });

      res
        .status(201)
        .json(
          notification
        );
    } catch (error) {
      res
        .status(500)
        .json({
          message:
            "Unable to create theme notification.",
        });
    }
  };