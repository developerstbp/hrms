import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Login from "./pages/Login";
import RegisterCompany from "./pages/RegisterCompany";

import Dashboard from "./pages/Dashboard";
import SetupWizard from "./pages/SetupWizard";

import Departments from "./pages/Departments";
import WorkforceSetup from "./pages/WorkforceSetup";
import Employees from "./pages/Employees";

import Shifts from "./pages/Shifts";
import Attendance from "./pages/Attendance";
import Leaves from "./pages/Leaves";
import Holidays from "./pages/Holidays";

import Reports from "./pages/Reports";
import Notifications from "./pages/Notifications";

import Payroll from "./pages/Payroll";

import AccessControl from "./pages/AccessControl";
import AuditLog from "./pages/AuditLog";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";

import ProtectedRoute from "./Components/ProtectedRoute";
import Layout from "./Components/Layout";

export default function App() {
  return (
    <Routes>
      {/* ============================================================= */}
      {/* Public */}
      {/* ============================================================= */}

      <Route
        path="/login"
        element={
          <Login />
        }
      />

      <Route
        path="/register"
        element={
          <RegisterCompany />
        }
      />

      {/* ============================================================= */}
      {/* Protected Application */}
      {/* ============================================================= */}

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard */}

        <Route
          path="/dashboard"
          element={
            <Dashboard />
          }
        />

        {/* Setup */}

        <Route
          path="/setup"
          element={
            <ProtectedRoute
              permission={[
                "company.settings",
                "employees.manage",
              ]}
            >
              <SetupWizard />
            </ProtectedRoute>
          }
        />

        {/* Organization */}

        <Route
          path="/departments"
          element={
            <ProtectedRoute
              permission={[
                "departments.view",
                "departments.manage",
              ]}
            >
              <Departments />
            </ProtectedRoute>
          }
        />

        <Route
          path="/workforce-setup"
          element={
            <ProtectedRoute
              permission={[
                "departments.view",
                "departments.manage",
                "employees.manage",
              ]}
            >
              <WorkforceSetup />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employees"
          element={
            <ProtectedRoute
              permission={[
                "employees.view",
                "employees.manage",
              ]}
            >
              <Employees />
            </ProtectedRoute>
          }
        />

        {/* Daily Operations */}

        <Route
          path="/shifts"
          element={
            <ProtectedRoute
              permission={[
                "shift.self",
                "shift.team",
                "shift.manage",
              ]}
            >
              <Shifts />
            </ProtectedRoute>
          }
        />

        <Route
          path="/attendance"
          element={
            <Attendance />
          }
        />

        <Route
          path="/leaves"
          element={
            <Leaves />
          }
        />

        <Route
          path="/holidays"
          element={
            <Holidays />
          }
        />

        {/* Notifications */}

        <Route
          path="/notifications"
          element={
            <Notifications />
          }
        />

        {/* Reports */}

        <Route
          path="/reports"
          element={
            <ProtectedRoute
              permission={[
                "employees.view",
                "employees.manage",
                "attendance.view",
                "attendance.manage",
                "leave.team",
                "leave.approve",
                "leave.policies",
              ]}
            >
              <Reports />
            </ProtectedRoute>
          }
        />

        {/* Payroll */}

        <Route
          path="/payroll"
          element={
            <ProtectedRoute
              permission={[
                "payroll.self",
                "payroll.view",
                "payroll.manage",
              ]}
            >
              <Payroll />
            </ProtectedRoute>
          }
        />

        {/* Administration */}

        <Route
          path="/access"
          element={
            <ProtectedRoute
              permission="access.control"
            >
              <AccessControl />
            </ProtectedRoute>
          }
        />

        <Route
          path="/audit"
          element={
            <ProtectedRoute
              permission="audit.view"
            >
              <AuditLog />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute
              permission="company.settings"
            >
              <Settings />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <Profile />
          }
        />
      </Route>

      {/* ============================================================= */}
      {/* Redirects */}
      {/* ============================================================= */}

      <Route
        path="/"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />
    </Routes>
  );
}