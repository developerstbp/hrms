import {
  useEffect,
  useState,
} from "react";

import ThemeSwitcher from "./ThemeSwitcher";

import api from "../services/api";

import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext";

/*
|--------------------------------------------------------------------------
| Navigation
|--------------------------------------------------------------------------
*/

const nav = [
  {
    to: "/dashboard",
    label: "Dashboard",
    permission:
      "dashboard.view",
    icon: "⌂",
  },

  {
    to: "/setup",
    label: "HRMS Setup",
    permission:
      "company.settings",
    altPermission:
      "employees.manage",
    icon: "✓",
  },

  /*
  |--------------------------------------------------------------------------
  | Organization
  |--------------------------------------------------------------------------
  */

  {
    to: "/departments",
    label: "Departments",
    permission:
      "departments.view",
    altPermission:
      "departments.manage",
    icon: "▦",
  },

  {
    to: "/workforce-setup",
    label: "Workforce Setup",
    permission:
      "departments.view",
    altPermission:
      "departments.manage",
    thirdPermission:
      "employees.manage",
    icon: "◇",
  },

  {
    to: "/employees",
    label: "Employees",
    permission:
      "employees.view",
    altPermission:
      "employees.manage",
    icon: "◎",
  },

  /*
  |--------------------------------------------------------------------------
  | Daily Operations
  |--------------------------------------------------------------------------
  */

  {
    to: "/shifts",
    label: "Shifts",
    permission:
      "shift.self",
    altPermission:
      "shift.team",
    thirdPermission:
      "shift.manage",
    icon: "⇄",
  },

  {
    to: "/attendance",
    label: "Attendance",
    permission:
      "attendance.self",
    altPermission:
      "attendance.view",
    thirdPermission:
      "attendance.manage",
    icon: "◷",
  },

  {
    to: "/leaves",
    label: "Leave Management",
    permission:
      "leave.self",
    altPermission:
      "leave.team",
    thirdPermission:
      "leave.approve",
    icon: "□",
  },

  {
    to: "/holidays",
    label: "Work Calendar",
    permission:
      "holidays.view",
    altPermission:
      "holidays.manage",
    icon: "✦",
  },

  /*
  |--------------------------------------------------------------------------
  | Communication
  |--------------------------------------------------------------------------
  */

  {
    to: "/notifications",
    label: "Notifications",
    icon: "●",
  },

  /*
  |--------------------------------------------------------------------------
  | Reports
  |--------------------------------------------------------------------------
  */

  {
    to: "/reports",
    label: "Reports",
    permission:
      "employees.view",
    altPermission:
      "attendance.view",
    thirdPermission:
      "leave.team",
    fourthPermission:
      "employees.manage",
    fifthPermission:
      "attendance.manage",
    sixthPermission:
      "leave.approve",
    icon: "▤",
  },

  /*
  |--------------------------------------------------------------------------
  | Payroll
  |--------------------------------------------------------------------------
  */

  {
    to: "/payroll",
    label: "Payroll",
    permission:
      "payroll.self",
    altPermission:
      "payroll.view",
    thirdPermission:
      "payroll.manage",
    icon: "₨",
  },

  /*
  |--------------------------------------------------------------------------
  | Administration
  |--------------------------------------------------------------------------
  */

  {
    to: "/access",
    label: "Access Control",
    permission:
      "access.control",
    icon: "⌾",
  },

  {
    to: "/audit",
    label: "Audit Log",
    permission:
      "audit.view",
    icon: "≡",
  },

  {
    to: "/settings",
    label: "Company Settings",
    permission:
      "company.settings",
    icon: "⚙",
  },

  {
    to: "/profile",
    label: "My Profile",
    icon: "○",
  },
];

export default function Layout() {
  const {
    user,
    company,
    hasPermission,
    logout,
  } =
    useAuth();

  const [
    open,
    setOpen,
  ] =
    useState(false);

  const [
    unreadNotifications,
    setUnreadNotifications,
  ] =
    useState(0);

  const location =
    useLocation();

  const navigate =
    useNavigate();

  const loadUnreadNotifications =
    async () => {
      try {
        const response =
          await api.get(
            "/notifications?unread=true&limit=1"
          );

        setUnreadNotifications(
          Number(
            response.data
              ?.unreadCount ||
              0
          )
        );
      } catch {
        // Notification count must
        // never block the layout.
      }
    };

  useEffect(
    () => {
      loadUnreadNotifications();
    },
    [
      location.pathname,
    ]
  );

  useEffect(
    () => {
      const refresh =
        () =>
          loadUnreadNotifications();

      window.addEventListener(
        "hrms-notifications-changed",
        refresh
      );

      const timer =
        window.setInterval(
          refresh,
          30000
        );

      return () => {
        window.removeEventListener(
          "hrms-notifications-changed",
          refresh
        );

        window.clearInterval(
          timer
        );
      };
    },
    []
  );

  const initials =
    `${user?.firstName?.[0] || ""}${
      user?.lastName?.[0] || ""
    }`.toUpperCase() ||
    "U";

  /*
  |--------------------------------------------------------------------------
  | Permission Based Menu
  |--------------------------------------------------------------------------
  */

  const visibleNav =
    nav.filter(
      (item) =>
        !item.permission ||
        hasPermission(
          item.permission
        ) ||
        (
          item.altPermission &&
          hasPermission(
            item.altPermission
          )
        ) ||
        (
          item.thirdPermission &&
          hasPermission(
            item.thirdPermission
          )
        ) ||
        (
          item.fourthPermission &&
          hasPermission(
            item.fourthPermission
          )
        ) ||
        (
          item.fifthPermission &&
          hasPermission(
            item.fifthPermission
          )
        ) ||
        (
          item.sixthPermission &&
          hasPermission(
            item.sixthPermission
          )
        )
    );

  /*
  |--------------------------------------------------------------------------
  | Sign Out
  |--------------------------------------------------------------------------
  */

  const signOut =
    () => {
      logout();

      navigate(
        "/login"
      );
    };

  /*
  |--------------------------------------------------------------------------
  | Current Page Name
  |--------------------------------------------------------------------------
  */

  const currentLabel =
    nav.find(
      (item) =>
        location.pathname.startsWith(
          item.to
        )
    )?.label ||
    "Dashboard";

  return (
    <div className="app-shell">
      {/* ============================================================= */}
      {/* Sidebar */}
      {/* ============================================================= */}

      <aside
        className={`sidebar ${
          open
            ? "sidebar-open"
            : ""
        }`}
      >
        <div className="brand">
          <div className="brand-mark">
            H
          </div>

          <div>
            <strong>
              {company?.name ||
                "HRMS"}
            </strong>

            <span>
              People Workspace
            </span>
          </div>
        </div>

        <nav className="side-nav">
          {visibleNav.map(
            (item) => (
              <NavLink
                key={
                  item.to
                }
                to={
                  item.to
                }
                onClick={() =>
                  setOpen(
                    false
                  )
                }
                className={({
                  isActive,
                }) =>
                  `nav-item ${
                    isActive
                      ? "active"
                      : ""
                  }`
                }
              >
                <span className="nav-icon">
                  {
                    item.icon
                  }
                </span>

                <span>
                  {
                    item.label
                  }
                </span>
              </NavLink>
            )
          )}
        </nav>

        {/* =========================================================== */}
        {/* User */}
        {/* =========================================================== */}

        <div className="sidebar-footer">
          <button
            className="profile-mini"
            onClick={() =>
              navigate(
                "/profile"
              )
            }
          >
            <span className="avatar">
              {initials}
            </span>

            <span>
              <strong>
                {user?.firstName}{" "}
                {user?.lastName}
              </strong>

              <small>
                {user?.role?.toUpperCase()}
              </small>
            </span>
          </button>

          <button
            className="logout-button"
            onClick={
              signOut
            }
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ============================================================= */}
      {/* Mobile Overlay */}
      {/* ============================================================= */}

      {open && (
        <button
          className="sidebar-overlay"
          onClick={() =>
            setOpen(
              false
            )
          }
          aria-label="Close menu"
        />
      )}

      {/* ============================================================= */}
      {/* Main */}
      {/* ============================================================= */}

      <main className="main-area">
        <header className="topbar">
          <button
            className="menu-button"
            onClick={() =>
              setOpen(
                true
              )
            }
          >
            ☰
          </button>

          <div className="breadcrumb">
            <span>
              Workspace
            </span>

            <strong>
              {
                currentLabel
              }
            </strong>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                navigate(
                  "/notifications"
                )
              }
              style={{
                position:
                  "relative",
              }}
            >
              🔔

              {unreadNotifications >
                0 && (
                <strong
                  style={{
                    marginLeft:
                      6,
                  }}
                >
                  {unreadNotifications >
                  99
                    ? "99+"
                    : unreadNotifications}
                </strong>
              )}
            </button>

            <ThemeSwitcher />
            <div className="top-user">
              <span className="avatar small">
                {initials}
              </span>

              <div>
                <strong>
                  {user?.firstName}{" "}
                  {user?.lastName}
                </strong>

                <span>
                  {user?.role}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}