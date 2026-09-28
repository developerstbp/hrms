import {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import api from "../services/api";

import {
  Alert,
  Badge,
  Card,
  EmptyState,
  PageHeader,
} from "../Components/UI";

import {
  getError,
} from "../utils/format";

export default function Notifications() {
  const navigate =
    useNavigate();

  const [
    notifications,
    setNotifications,
  ] = useState([]);

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  const [
    filter,
    setFilter,
  ] = useState("all");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    notice,
    setNotice,
  ] = useState("");

  /*
  |--------------------------------------------------------------------------
  | Load Notifications
  |--------------------------------------------------------------------------
  */

  const load = async () => {
    try {
      setLoading(true);

      const params = {
        limit: 100,
      };

      if (
        filter === "unread"
      ) {
        params.unread =
          "true";
      }

      const {
        data,
      } =
        await api.get(
          "/notifications",
          {
            params,
          }
        );

      setNotifications(
        Array.isArray(
          data
        )
          ? data
          : data.notifications ||
              []
      );

      setUnreadCount(
        Number(
          data?.unreadCount ||
            0
        )
      );

      setError("");
    } catch (err) {
      setError(
        getError(
          err,
          "Unable to load notifications."
        )
      );
    } finally {
      setLoading(
        false
      );
    }
  };

  useEffect(
    () => {
      load();
    },
    [
      filter,
    ]
  );

  /*
  |--------------------------------------------------------------------------
  | Mark One Read
  |--------------------------------------------------------------------------
  */

  const markRead =
    async (
      notification
    ) => {
      try {
        if (
          !notification.isRead
        ) {
          await api.put(
            `/notifications/${notification._id}/read`
          );

          setNotifications(
            (
              current
            ) =>
              current.map(
                (
                  item
                ) =>
                  item._id ===
                  notification._id
                    ? {
                        ...item,
                        isRead:
                          true,

                        readAt:
                          new Date(),
                      }
                    : item
              )
          );

          setUnreadCount(
            (
              current
            ) =>
              Math.max(
                0,
                current -
                  1
              )
          );
        }

        if (
          notification.link
        ) {
          navigate(
            notification.link
          );
        }
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to update notification."
          )
        );
      }
    };

  window.dispatchEvent(
    new Event(
      "hrms-notifications-changed"
    )
  );

  /*
  |--------------------------------------------------------------------------
  | Mark All Read
  |--------------------------------------------------------------------------
  */

  const markAllRead =
    async () => {
      try {
        await api.put(
          "/notifications/read-all"
        );

        setNotifications(
          (
            current
          ) =>
            current.map(
              (
                item
              ) => ({
                ...item,

                isRead:
                  true,

                readAt:
                  item.readAt ||
                  new Date(),
              })
            )
        );

        setUnreadCount(
          0
        );

        window.dispatchEvent(
          new Event(
            "hrms-notifications-changed"
          )
        );

        setNotice(
          "All notifications marked as read."
        );

        setError("");
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to mark notifications as read."
          )
        );
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Delete Notification
  |--------------------------------------------------------------------------
  */

  const remove =
    async (
      notification
    ) => {
      const confirmed =
        window.confirm(
          "Delete this notification?"
        );

      if (
        !confirmed
      ) {
        return;
      }

      try {
        await api.delete(
          `/notifications/${notification._id}`
        );

        setNotifications(
          (
            current
          ) =>
            current.filter(
              (
                item
              ) =>
                item._id !==
                notification._id
            )
        );

        if (
          !notification.isRead
        ) {
          setUnreadCount(
            (
              current
            ) =>
              Math.max(
                0,
                current -
                  1
              )
          );
        }

        setNotice(
          "Notification removed."
        );

        setError("");
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to delete notification."
          )
        );
      }
    };

    window.dispatchEvent(
      new Event(
        "hrms-notifications-changed"
      )
    );

  /*
  |--------------------------------------------------------------------------
  | Date Time
  |--------------------------------------------------------------------------
  */

  const formatDateTime =
    (
      value
    ) => {
      if (
        !value
      ) {
        return "—";
      }

      return new Date(
        value
      ).toLocaleString(
        "en-PK",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      );
    };

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Review HR, leave, attendance, shift and employee updates."
        action={
          unreadCount >
          0 ? (
            <button
              className="button secondary"
              onClick={
                markAllRead
              }
            >
              Mark all as read
            </button>
          ) : null
        }
      />

      {notice && (
        <Alert type="success">
          {notice}
        </Alert>
      )}

      {error && (
        <Alert type="error">
          {error}
        </Alert>
      )}

      <div className="stats-grid">
        <Card>
          <div className="card-head">
            <div>
              <span className="eyebrow">
                Notifications
              </span>

              <h2>
                {
                  notifications.length
                }
              </h2>

              <p>
                Currently visible
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <div>
              <span className="eyebrow">
                Unread
              </span>

              <h2>
                {
                  unreadCount
                }
              </h2>

              <p>
                Require your attention
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="card-head">
          <div>
            <h2>
              Notification Center
            </h2>

            <p>
              Your latest HRMS
              activity and updates.
            </p>
          </div>

          <label className="field">
            <span>
              Show
            </span>

            <select
              value={
                filter
              }
              onChange={(
                event
              ) =>
                setFilter(
                  event
                    .target
                    .value
                )
              }
            >
              <option value="all">
                All
              </option>

              <option value="unread">
                Unread only
              </option>
            </select>
          </label>
        </div>

        {loading ? (
          <p>
            Loading notifications...
          </p>
        ) : notifications.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    Status
                  </th>

                  <th>
                    Notification
                  </th>

                  <th>
                    Type
                  </th>

                  <th>
                    Date
                  </th>

                  <th />
                </tr>
              </thead>

              <tbody>
                {notifications.map(
                  (
                    notification
                  ) => (
                    <tr
                      key={
                        notification._id
                      }
                    >
                      <td>
                        <Badge
                          value={
                            notification.isRead
                              ? "read"
                              : "unread"
                          }
                        />
                      </td>

                      <td>
                        <strong>
                          {
                            notification.title
                          }
                        </strong>

                        <small>
                          {
                            notification.message ||
                            "—"
                          }
                        </small>
                      </td>

                      <td>
                        <Badge
                          value={
                            notification.type ||
                            "system"
                          }
                        />
                      </td>

                      <td>
                        {formatDateTime(
                          notification.createdAt
                        )}
                      </td>

                      <td>
                        <div className="table-actions">
                          {notification.link && (
                            <button
                              className="text-button"
                              onClick={() =>
                                markRead(
                                  notification
                                )
                              }
                            >
                              Open
                            </button>
                          )}

                          {!notification.isRead &&
                            !notification.link && (
                              <button
                                className="text-button"
                                onClick={() =>
                                  markRead(
                                    notification
                                  )
                                }
                              >
                                Mark read
                              </button>
                            )}

                          <button
                            className="text-button danger"
                            onClick={() =>
                              remove(
                                notification
                              )
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={
              filter ===
              "unread"
                ? "No unread notifications"
                : "No notifications yet"
            }
            description={
              filter ===
              "unread"
                ? "You're all caught up."
                : "Leave, attendance, shift and HR activity will appear here."
            }
          />
        )}
      </Card>
    </>
  );
}