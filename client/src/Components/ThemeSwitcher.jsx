import {
  useEffect,
  useState,
} from "react";

import api from "../services/api";

const THEMES = [
  {
    value: "normal",
    label: "Normal",
  },
  {
    value: "ocean",
    label: "Aasiya's UI",
  },
  {
    value: "dark",
    label: "Dark",
  },
];

export default function ThemeSwitcher() {
  const [
    theme,
    setTheme,
  ] = useState(
    () =>
      localStorage.getItem(
        "hrms-theme"
      ) || "normal"
  );

  useEffect(
    () => {
      document.documentElement.setAttribute(
        "data-theme",
        theme
      );

      localStorage.setItem(
        "hrms-theme",
        theme
      );
    },
    [theme]
  );

  return (
    <div className="theme-switcher">
      <div className={`theme-preview theme-preview-${theme}`}>
        {theme === "ocean" ? (
          <>
            <span className="theme-dot royal" />
            <span className="theme-dot navy" />
            <span className="theme-dot turquoise" />
          </>
        ) : (
          <span className="theme-dot single" />
        )}
      </div>

      <select
        value={theme}
        onChange={async (
          event
        ) => {
          const nextTheme =
            event.target.value;

          if (
            nextTheme ===
            theme
          ) {
            return;
          }

          setTheme(
            nextTheme
          );

          try {
            await api.post(
              "/notifications/theme-change",
              {
                theme:
                  nextTheme,
              }
            );

            window.dispatchEvent(
              new Event(
                "hrms-notifications-changed"
              )
            );
          } catch {
            // Theme change should still work
            // even if notification creation fails.
          }
        }}
        aria-label="Select interface theme"
      >
        {THEMES.map(
          (item) => (
            <option
              key={item.value}
              value={item.value}
            >
              {item.label}
            </option>
          )
        )}
      </select>
    </div>
  );
}