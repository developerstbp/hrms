import express from "express";
import cors from "cors";
import path from "path";

import {
  fileURLToPath,
} from "url";

import authRoutes from "./routes/authRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import departmentRoutes from "./routes/departmentRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import shiftRoutes from "./routes/shiftRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import holidayRoutes from "./routes/holidayRoutes.js";
import payrollRoutes from "./routes/payrollRoutes.js";
import accessRoutes from "./routes/accessRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import masterDataRoutes from "./routes/masterDataRoutes.js";

/*
|--------------------------------------------------------------------------
| Reports + Notifications
|--------------------------------------------------------------------------
*/

import notificationRoutes from "./routes/notificationRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";

const app = express();

const __filename =
  fileURLToPath(
    import.meta.url
  );

const __dirname =
  path.dirname(
    __filename
  );

const clientDistPath =
  path.resolve(
    __dirname,
    "../../client/dist"
  );

/*
|--------------------------------------------------------------------------
| Middleware
|--------------------------------------------------------------------------
*/

const allowedOrigins = (
  process.env.CLIENT_URL ||
  "http://localhost:5173"
)
  .split(",")
  .map(
    (origin) =>
      origin.trim()
  );

app.use(
  cors({
    origin:
      allowedOrigins,

    credentials:
      true,
  })
);

app.use(
  express.json({
    limit:
      "2mb",
  })
);

app.use(
  express.urlencoded({
    extended:
      true,
  })
);

/*
|--------------------------------------------------------------------------
| Health
|--------------------------------------------------------------------------
*/

app.get(
  "/api/health",
  (
    req,
    res
  ) =>
    res.json({
      message:
        "HRMS API is running",

      status:
        "healthy",
    })
);

/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/dashboard",
  dashboardRoutes
);

app.use(
  "/api/departments",
  departmentRoutes
);

app.use(
  "/api/master-data",
  masterDataRoutes
);

app.use(
  "/api/employees",
  employeeRoutes
);

app.use(
  "/api/shifts",
  shiftRoutes
);

app.use(
  "/api/attendance",
  attendanceRoutes
);

app.use(
  "/api/leaves",
  leaveRoutes
);

app.use(
  "/api/holidays",
  holidayRoutes
);

app.use(
  "/api/payroll",
  payrollRoutes
);

app.use(
  "/api/reports",
  reportRoutes
);

app.use(
  "/api/notifications",
  notificationRoutes
);

app.use(
  "/api/access",
  accessRoutes
);

app.use(
  "/api/audit",
  auditRoutes
);

app.use(
  "/api/company",
  companyRoutes
);

/*
|--------------------------------------------------------------------------
| React Production Frontend
|--------------------------------------------------------------------------
*/

app.use(
  express.static(
    clientDistPath
  )
);

/*
|--------------------------------------------------------------------------
| React Router Fallback
|--------------------------------------------------------------------------
|
| Any GET request that is not /api/*
| should return React's index.html.
|
*/

app.use(
  (
    req,
    res,
    next
  ) => {
    if (
      req.method ===
        "GET" &&
      !req.path.startsWith(
        "/api/"
      )
    ) {
      return res.sendFile(
        path.join(
          clientDistPath,
          "index.html"
        )
      );
    }

    next();
  }
);

/*
|--------------------------------------------------------------------------
| 404
|--------------------------------------------------------------------------
*/

app.use(
  (
    req,
    res
  ) =>
    res
      .status(
        404
      )
      .json({
        message:
          "API route not found.",
      })
);

/*
|--------------------------------------------------------------------------
| Error Handler
|--------------------------------------------------------------------------
*/

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      error
    );

    res
      .status(
        500
      )
      .json({
        message:
          "An unexpected server error occurred.",
      });
  }
);

export default app;