const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const startOfDay = (
  value
) => {
  const date =
    value instanceof Date
      ? new Date(
          value
        )
      : new Date(
          value
        );

  date.setHours(
    0,
    0,
    0,
    0
  );

  return date;
};

const endOfDay = (
  value
) => {
  const date =
    startOfDay(
      value
    );

  date.setHours(
    23,
    59,
    59,
    999
  );

  return date;
};

const getSaturdayNumber =
  (
    date
  ) => {
    return Math.floor(
      (
        date.getDate() -
        1
      ) /
        7
    ) + 1;
  };

/*
|--------------------------------------------------------------------------
| Payroll Period Helper
|--------------------------------------------------------------------------
|
| Payroll is still excluded from today's feature work, but this helper is
| preserved because existing payroll code may depend on it.
|
*/

export const resolvePayrollPeriod =
  (
    month,
    payrollSettings = {}
  ) => {
    const [
      yearValue,
      monthValue
    ] =
      String(month)
        .split("-")
        .map(
          Number
        );

    const year =
      yearValue ||
      new Date().getFullYear();

    const monthIndex =
      Math.max(
        0,
        Math.min(
          11,
          (
            monthValue ||
            1
          ) - 1
        )
      );

    const {
      cycleType =
        "calendar_month",

      cycleWindow =
        "same_month",

      cycleStartDay =
        1,

      cycleEndDay =
        31,
    } =
      payrollSettings;

    if (
      cycleType ===
      "calendar_month"
    ) {
      return {
        periodStart:
          new Date(
            year,
            monthIndex,
            1
          ),

        periodEnd:
          new Date(
            year,
            monthIndex +
              1,
            0,
            23,
            59,
            59,
            999
          ),
      };
    }

    let startYear =
      year;

    let startMonth =
      monthIndex;

    let endYear =
      year;

    let endMonth =
      monthIndex;

    if (
      cycleWindow ===
      "previous_to_current"
    ) {
      startMonth =
        monthIndex -
        1;

      if (
        startMonth <
        0
      ) {
        startMonth =
          11;

        startYear -=
          1;
      }
    }

    const startMonthLastDay =
      new Date(
        startYear,
        startMonth +
          1,
        0
      ).getDate();

    const endMonthLastDay =
      new Date(
        endYear,
        endMonth +
          1,
        0
      ).getDate();

    const periodStart =
      new Date(
        startYear,
        startMonth,
        Math.min(
          cycleStartDay,
          startMonthLastDay
        )
      );

    const periodEnd =
      new Date(
        endYear,
        endMonth,
        Math.min(
          cycleEndDay,
          endMonthLastDay
        ),
        23,
        59,
        59,
        999
      );

    return {
      periodStart,
      periodEnd,
    };
  };

/*
|--------------------------------------------------------------------------
| Get Active Work Calendar Policy
|--------------------------------------------------------------------------
*/

export const getActiveWorkPolicy =
  (
    company,
    date
  ) => {
    const targetDate =
      startOfDay(
        date
      );

    const policies =
      Array.isArray(
        company
          ?.workCalendarPolicies
      )
        ? [
            ...company.workCalendarPolicies,
          ]
        : [];

    const eligible =
      policies.filter(
        (
          policy
        ) => {
          if (
            !policy
              ?.effectiveFrom
          ) {
            return false;
          }

          const effectiveFrom =
            startOfDay(
              policy.effectiveFrom
            );

          return (
            effectiveFrom <=
            targetDate
          );
        }
      );

    eligible.sort(
      (
        a,
        b
      ) => {
        const dateDifference =
          new Date(
            b.effectiveFrom
          ) -
          new Date(
            a.effectiveFrom
          );

        if (
          dateDifference !==
          0
        ) {
          return dateDifference;
        }

        return (
          new Date(
            b.createdAt ||
              0
          ) -
          new Date(
            a.createdAt ||
              0
          )
        );
      }
    );

    return (
      eligible[0] ||
      null
    );
  };

/*
|--------------------------------------------------------------------------
| Default Day Resolution
|--------------------------------------------------------------------------
*/

const resolvePolicyDay =
  (
    policy,
    date
  ) => {
    const weekday =
      DAY_NAMES[
        date.getDay()
      ];

    const weekdayModes =
      policy
        ?.weekdayModes ||
      {};

    let mode =
      weekdayModes[
        weekday
      ] ||
      (
        [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
        ].includes(
          weekday
        )
          ? "office"
          : "off"
      );

    /*
    |--------------------------------------------------------------------------
    | Saturday Alternation
    |--------------------------------------------------------------------------
    */

    if (
      weekday ===
        "saturday" &&
      policy
        ?.saturdayPolicy
    ) {
      const {
        pattern =
          "standard",

        firstSaturdayWorking =
          true,

        workingMode =
          "wfh",
      } =
        policy.saturdayPolicy;

      if (
        pattern ===
        "all_off"
      ) {
        mode =
          "off";
      }

      if (
        pattern ===
        "all_working"
      ) {
        mode =
          workingMode;
      }

      if (
        pattern ===
        "alternate"
      ) {
        const saturdayNumber =
          getSaturdayNumber(
            date
          );

        const odd =
          saturdayNumber %
            2 ===
          1;

        const shouldWork =
          firstSaturdayWorking
            ? odd
            : !odd;

        mode =
          shouldWork
            ? workingMode
            : "off";
      }
    }

    if (
      mode ===
      "office"
    ) {
      return {
        dayType:
          "working_day",

        workMode:
          "office",

        isWorkingDay:
          true,

        label:
          "Office",
      };
    }

    if (
      mode ===
      "wfh"
    ) {
      return {
        dayType:
          "working_day",

        workMode:
          "wfh",

        isWorkingDay:
          true,

        label:
          "WFH",
      };
    }

    return {
      dayType:
        "off",

      workMode:
        "",

      isWorkingDay:
        false,

      label:
        "Off",
    };
  };

/*
|--------------------------------------------------------------------------
| Resolve Calendar Day
|--------------------------------------------------------------------------
*/

export const resolveCalendarDay =
  (
    company,
    overrides = [],
    date
  ) => {
    const targetDate =
      startOfDay(
        date
      );

    const activePolicy =
      getActiveWorkPolicy(
        company,
        targetDate
      );

    const base =
      resolvePolicyDay(
        activePolicy,
        targetDate
      );

    const matchingOverrides =
      (
        Array.isArray(
          overrides
        )
          ? overrides
          : []
      )
        .filter(
          (
            override
          ) => {
            if (
              !override?.date
            ) {
              return false;
            }

            const start =
              startOfDay(
                override.date
              );

            const end =
              override.endDate
                ? endOfDay(
                    override.endDate
                  )
                : endOfDay(
                    override.date
                  );

            return (
              targetDate >=
                start &&
              targetDate <=
                end
            );
          }
        )
        .sort(
          (
            a,
            b
          ) =>
            new Date(
              b.createdAt ||
                b.updatedAt ||
                b.date
            ) -
            new Date(
              a.createdAt ||
                a.updatedAt ||
                a.date
            )
        );

    const override =
      matchingOverrides[0];

    const result = {
      date:
        targetDate,

      weekday:
        DAY_NAMES[
          targetDate.getDay()
        ],

      policyName:
        activePolicy
          ?.name ||
        "Default work schedule",

      dayType:
        base.dayType,

      workMode:
        base.workMode,

      isWorkingDay:
        base.isWorkingDay,

      label:
        base.label,

      source:
        activePolicy
          ? "policy"
          : "default",

      overrideId:
        null,

      overrideName:
        "",

      description:
        "",
    };

    if (
      !override
    ) {
      return result;
    }

    result.source =
      "override";

    result.overrideId =
      override._id ||
      null;

    result.overrideName =
      override.name ||
      "";

    result.description =
      override.description ||
      "";

    /*
    |--------------------------------------------------------------------------
    | Holiday
    |--------------------------------------------------------------------------
    */

    if (
      [
        "public",
        "company",
      ].includes(
        override.type
      )
    ) {
      result.dayType =
        "holiday";

      result.workMode =
        "";

      result.isWorkingDay =
        false;

      result.label =
        override.name ||
        "Holiday";

      return result;
    }

    /*
    |--------------------------------------------------------------------------
    | Optional Holiday
    |--------------------------------------------------------------------------
    */

    if (
      override.type ===
      "optional"
    ) {
      result.dayType =
        "optional_holiday";

      result.workMode =
        "";

      result.isWorkingDay =
        false;

      result.label =
        override.name ||
        "Optional Holiday";

      return result;
    }

    /*
    |--------------------------------------------------------------------------
    | Special Off Day
    |--------------------------------------------------------------------------
    */

    if (
      override.type ===
      "off"
    ) {
      result.dayType =
        "special_off";

      result.workMode =
        "";

      result.isWorkingDay =
        false;

      result.label =
        override.name ||
        "Off";

      return result;
    }

    /*
    |--------------------------------------------------------------------------
    | WFH Override
    |--------------------------------------------------------------------------
    */

    if (
      override.type ===
      "wfh"
    ) {
      result.dayType =
        "working_day";

      result.workMode =
        "wfh";

      result.isWorkingDay =
        true;

      result.label =
        override.name ||
        "WFH";

      return result;
    }

    /*
    |--------------------------------------------------------------------------
    | Special Working Day
    |--------------------------------------------------------------------------
    */

    if (
      override.type ===
      "working"
    ) {
      result.dayType =
        "working_day";

      result.workMode =
        override.workMode ||
        "office";

      result.isWorkingDay =
        true;

      result.label =
        override.name ||
        (
          result.workMode ===
          "wfh"
            ? "WFH"
            : "Office"
        );

      return result;
    }

    return result;
  };

/*
|--------------------------------------------------------------------------
| Build Calendar Range
|--------------------------------------------------------------------------
*/

export const buildWorkCalendar =
  (
    company,
    overrides = [],
    startDate,
    endDate
  ) => {
    const start =
      startOfDay(
        startDate
      );

    const end =
      startOfDay(
        endDate
      );

    if (
      Number.isNaN(
        start.getTime()
      ) ||
      Number.isNaN(
        end.getTime()
      ) ||
      start >
        end
    ) {
      return [];
    }

    const days =
      [];

    const cursor =
      new Date(
        start
      );

    while (
      cursor <=
      end
    ) {
      days.push(
        resolveCalendarDay(
          company,
          overrides,
          cursor
        )
      );

      cursor.setDate(
        cursor.getDate() +
          1
      );
    }

    return days;
  };