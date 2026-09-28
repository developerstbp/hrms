import express from "express";

import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  createThemeChangeNotification,
} from "../controllers/notificationController.js";

import {
  protect,
} from "../middleware/authMiddleware.js";

const router =
  express.Router();

/*
|--------------------------------------------------------------------------
| Notification Routes
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  protect,
  getNotifications
);

router.post(
  "/theme-change",
  protect,
  createThemeChangeNotification
);

router.put(
  "/read-all",
  protect,
  markAllNotificationsRead
);

router.put(
  "/:id/read",
  protect,
  markNotificationRead
);

router.delete(
  "/:id",
  protect,
  deleteNotification
);

export default router;