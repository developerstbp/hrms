import {
  useEffect,
  useMemo,
  useState,
} from "react";

import FullHRMSImport from "../Components/FullHRMSImport";

import * as XLSX from "xlsx";

import api from "../services/api";

import {
  Alert,
  Card,
  PageHeader,
} from "../Components/UI";

import {
  getError,
} from "../utils/format";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const today = () =>
  new Date()
    .toISOString()
    .slice(0, 10);

const normalize = (
  value = ""
) =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

const codeFromName = (
  value = ""
) =>
  String(value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

const headerKey = (
  value = ""
) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const HEADER_MAP = {
  employeecode: "employeeCode",
  firstname: "firstName",
  lastname: "lastName",
  workemail: "workEmail",
  email: "workEmail",
  phone: "phone",
  department: "department",
  designation: "designation",
  employmenttype: "employmentType",
  location: "location",
  grade: "grade",
  reportingmanagercode: "reportingManagerCode",
  managercode: "reportingManagerCode",
  joiningdate: "joiningDate",
  status: "status",
  shift: "shift",
  dateofbirth: "dateOfBirth",
  gender: "gender",
  address: "address",
  lastworkingdate: "lastWorkingDate",
};

const EMPLOYEE_HEADERS = [
  "Employee Code",
  "First Name",
  "Last Name",
  "Work Email",
  "Phone",
  "Department",
  "Designation",
  "Employment Type",
  "Location",
  "Grade",
  "Reporting Manager Code",
  "Joining Date",
  "Status",
  "Shift",
  "Date of Birth",
  "Gender",
  "Address",
  "Last Working Date",
];

/*
|--------------------------------------------------------------------------
| Recommended Defaults
|--------------------------------------------------------------------------
*/

const SHIFT_TEMPLATES = [
  {
    name: "Morning Shift",
    code: "MORNING",
    startTime: "10:00",
    endTime: "18:30",
    breakMinutes: 30,
    graceMinutes: 15,
    workingDays: [1, 2, 3, 4, 5],
    isDefault: true,
    isActive: true,
  },
  {
    name: "Evening Shift",
    code: "EVENING",
    startTime: "15:00",
    endTime: "23:30",
    breakMinutes: 30,
    graceMinutes: 15,
    workingDays: [1, 2, 3, 4, 5],
    isDefault: false,
    isActive: true,
  },
  {
    name: "Early Shift",
    code: "EARLY",
    startTime: "09:30",
    endTime: "18:00",
    breakMinutes: 30,
    graceMinutes: 15,
    workingDays: [1, 2, 3, 4, 5],
    isDefault: false,
    isActive: true,
  },
];

const LEAVE_TEMPLATES = [
  {
    name: "Annual Leave",
    code: "AL",
    daysPerYear: 14,
    isPaid: true,
    allowHalfDay: true,
    requiresReason: true,
    carryForwardAllowed: true,
    maxCarryForward: 5,
    maxConsecutiveDays: 10,
    noticeDays: 1,
    isActive: true,
  },
  {
    name: "Sick Leave",
    code: "SL",
    daysPerYear: 8,
    isPaid: true,
    allowHalfDay: true,
    requiresReason: true,
    carryForwardAllowed: false,
    maxCarryForward: 0,
    maxConsecutiveDays: 5,
    noticeDays: 0,
    isActive: true,
  },
  {
    name: "Casual Leave",
    code: "CL",
    daysPerYear: 7,
    isPaid: true,
    allowHalfDay: true,
    requiresReason: true,
    carryForwardAllowed: false,
    maxCarryForward: 0,
    maxConsecutiveDays: 3,
    noticeDays: 0,
    isActive: true,
  },
  {
    name: "Unpaid Leave",
    code: "UL",
    daysPerYear: 0,
    isPaid: false,
    allowHalfDay: true,
    requiresReason: true,
    carryForwardAllowed: false,
    maxCarryForward: 0,
    maxConsecutiveDays: 0,
    noticeDays: 0,
    isActive: true,
  },
];

/*
|--------------------------------------------------------------------------
| Setup Step Card
|--------------------------------------------------------------------------
*/

function SetupStep({
  number,
  title,
  description,
  complete,
  children,
}) {
  return (
    <Card>
      <div
        style={{
          display: "flex",
          gap: 14,
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            fontWeight: 800,
            background: complete
              ? "#dcfce7"
              : "#ede9fe",
            color: complete
              ? "#15803d"
              : "#6d28d9",
          }}
        >
          {complete ? "✓" : number}
        </div>

        <div
          style={{
            flex: 1,
          }}
        >
          <div className="card-head">
            <div>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>

            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "5px 9px",
                borderRadius: 999,
                background: complete
                  ? "#dcfce7"
                  : "#f1f5f9",
                color: complete
                  ? "#15803d"
                  : "#64748b",
              }}
            >
              {complete
                ? "Complete"
                : "Needs Setup"}
            </span>
          </div>

          {children}
        </div>
      </div>
    </Card>
  );
}

/*
|--------------------------------------------------------------------------
| Page
|--------------------------------------------------------------------------
*/

export default function SetupWizard() {
  const [
    departments,
    setDepartments,
  ] = useState([]);

  const [
    masterData,
    setMasterData,
  ] = useState([]);

  const [
    shifts,
    setShifts,
  ] = useState([]);

  const [
    policies,
    setPolicies,
  ] = useState([]);

  const [
    leaveTypes,
    setLeaveTypes,
  ] = useState([]);

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    busy,
    setBusy,
  ] = useState("");

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
  | Department
  |--------------------------------------------------------------------------
  */

  const [
    departmentForm,
    setDepartmentForm,
  ] = useState({
    name: "",
    code: "",
  });

  /*
  |--------------------------------------------------------------------------
  | Designation
  |--------------------------------------------------------------------------
  */

  const [
    designationForm,
    setDesignationForm,
  ] = useState({
    departmentId: "",
    name: "",
    code: "",
  });

  /*
  |--------------------------------------------------------------------------
  | Employee Import
  |--------------------------------------------------------------------------
  */

  const [
    importRows,
    setImportRows,
  ] = useState([]);

  const [
    importFile,
    setImportFile,
  ] = useState("");

  const [
    initialPassword,
    setInitialPassword,
  ] = useState(
    "Welcome@123"
  );

  const [
    importResult,
    setImportResult,
  ] = useState(null);

  /*
  |--------------------------------------------------------------------------
  | Load Setup State
  |--------------------------------------------------------------------------
  */

  const load = async () => {
    try {
      setLoading(true);

      const [
        departmentRes,
        masterRes,
        shiftRes,
        policyRes,
        leaveRes,
        employeeRes,
      ] = await Promise.all([
        api.get("/departments"),
        api.get("/master-data"),
        api.get("/shifts"),
        api.get("/holidays/policies"),
        api.get("/leaves/types"),
        api.get("/employees"),
      ]);

      setDepartments(
        departmentRes.data || []
      );

      setMasterData(
        masterRes.data || []
      );

      setShifts(
        shiftRes.data || []
      );

      setPolicies(
        policyRes.data?.policies ||
          []
      );

      setLeaveTypes(
        leaveRes.data || []
      );

      setEmployees(
        employeeRes.data || []
      );

      setError("");
    } catch (err) {
      setError(
        getError(
          err,
          "Unable to load setup status."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Derived
  |--------------------------------------------------------------------------
  */

  const designations =
    masterData.filter(
      (item) =>
        item.type ===
        "designation" &&
        item.isActive
    );

  const employmentTypes =
    masterData.filter(
      (item) =>
        item.type ===
        "employment-type" &&
        item.isActive
    );

  const locations =
    masterData.filter(
      (item) =>
        item.type ===
        "location" &&
        item.isActive
    );

  const grades =
    masterData.filter(
      (item) =>
        item.type ===
        "grade" &&
        item.isActive
    );

  const activeShifts =
    shifts.filter(
      (item) =>
        item.isActive
    );

  const status = {
    departments:
      departments.filter(
        (item) =>
          item.isActive
      ).length > 0,

    workforce:
      designations.length > 0 &&
      employmentTypes.length > 0,

    shifts:
      activeShifts.length > 0,

    calendar:
      policies.length > 0,

    leaves:
      leaveTypes.filter(
        (item) =>
          item.isActive
      ).length > 0,

    employees:
      employees.length > 0,
  };

  const completedCount =
    Object.values(
      status
    ).filter(Boolean).length;

  const completion =
    Math.round(
      (completedCount / 6) *
        100
    );

  const allComplete =
    completedCount === 6;

  /*
  |--------------------------------------------------------------------------
  | Department
  |--------------------------------------------------------------------------
  */

  const addDepartment =
    async (event) => {
      event.preventDefault();

      try {
        setBusy("department");
        setError("");

        await api.post(
          "/departments",
          {
            name:
              departmentForm.name.trim(),

            code:
              (
                departmentForm.code ||
                codeFromName(
                  departmentForm.name
                )
              ).trim(),

            isActive: true,
          }
        );

        setDepartmentForm({
          name: "",
          code: "",
        });

        setNotice(
          "Department added."
        );

        await load();
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to add department."
          )
        );
      } finally {
        setBusy("");
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Designation
  |--------------------------------------------------------------------------
  */

  const addDesignation =
    async (event) => {
      event.preventDefault();

      try {
        setBusy("designation");
        setError("");

        await api.post(
          "/master-data",
          {
            type: "designation",

            name:
              designationForm.name.trim(),

            code:
              (
                designationForm.code ||
                codeFromName(
                  designationForm.name
                )
              ).trim(),

            departmentId:
              designationForm.departmentId,

            isActive: true,
          }
        );

        setDesignationForm({
          departmentId:
            designationForm.departmentId,

          name: "",
          code: "",
        });

        setNotice(
          "Designation added."
        );

        await load();
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to add designation."
          )
        );
      } finally {
        setBusy("");
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Recommended Shifts
  |--------------------------------------------------------------------------
  */

  const createRecommendedShifts =
    async () => {
      try {
        setBusy("shifts");
        setError("");

        let created = 0;

        for (
          const template of SHIFT_TEMPLATES
        ) {
          const exists =
            shifts.some(
              (shift) =>
                normalize(
                  shift.code
                ) ===
                  normalize(
                    template.code
                  ) ||
                normalize(
                  shift.name
                ) ===
                  normalize(
                    template.name
                  )
            );

          if (exists) {
            continue;
          }

          await api.post(
            "/shifts",
            template
          );

          created += 1;
        }

        setNotice(
          created
            ? `${created} recommended shift(s) created.`
            : "Recommended shifts already exist."
        );

        await load();
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to create recommended shifts."
          )
        );
      } finally {
        setBusy("");
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Work Calendar
  |--------------------------------------------------------------------------
  */

  const createRecommendedCalendar =
    async () => {
      try {
        setBusy("calendar");
        setError("");

        await api.post(
          "/holidays/policies",
          {
            name:
              "Standard Work Schedule",

            effectiveFrom:
              today(),

            weekdayModes: {
              monday: "office",
              tuesday: "office",
              wednesday: "office",
              thursday: "office",
              friday: "office",
              saturday: "off",
              sunday: "off",
            },

            saturdayPolicy: {
              pattern:
                "alternate",

              firstSaturdayWorking:
                true,

              workingMode:
                "wfh",
            },

            notes:
              "Monday-Friday Office. 1st, 3rd and 5th Saturdays WFH. 2nd and 4th Saturdays Off.",
          }
        );

        setNotice(
          "Recommended work schedule created."
        );

        await load();
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to create work schedule."
          )
        );
      } finally {
        setBusy("");
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Leave Templates
  |--------------------------------------------------------------------------
  */

  const createRecommendedLeaves =
    async () => {
      try {
        setBusy("leaves");
        setError("");

        let created = 0;

        for (
          const template of LEAVE_TEMPLATES
        ) {
          const exists =
            leaveTypes.some(
              (type) =>
                normalize(
                  type.code
                ) ===
                  normalize(
                    template.code
                  ) ||
                normalize(
                  type.name
                ) ===
                  normalize(
                    template.name
                  )
            );

          if (exists) {
            continue;
          }

          await api.post(
            "/leaves/types",
            template
          );

          created += 1;
        }

        setNotice(
          created
            ? `${created} leave policy template(s) created.`
            : "Recommended leave policies already exist."
        );

        await load();
      } catch (err) {
        setError(
          getError(
            err,
            "Unable to create leave policies."
          )
        );
      } finally {
        setBusy("");
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Excel Template
  |--------------------------------------------------------------------------
  */

  const downloadEmployeeTemplate =
    () => {
      const workbook =
        XLSX.utils.book_new();

      const sheet =
        XLSX.utils.aoa_to_sheet([
          EMPLOYEE_HEADERS,

          [
            "EMP001",
            "Ahmed",
            "Khan",
            "ahmed@company.com",
            "03001234567",
            departments[0]
              ?.name ||
              "Technology",
            designations[0]
              ?.name ||
              "Developer",
            employmentTypes[0]
              ?.name ||
              "Full Time",
            locations[0]
              ?.name ||
              "",
            grades[0]
              ?.name ||
              "",
            "",
            today(),
            "active",
            activeShifts[0]
              ?.name ||
              "Morning Shift",
            "",
            "",
            "",
            "",
          ],
        ]);

      sheet["!cols"] =
        EMPLOYEE_HEADERS.map(
          () => ({
            wch: 22,
          })
        );

      const instructions =
        XLSX.utils.aoa_to_sheet([
          [
            "Employee Import Instructions",
          ],
          [
            "Department",
            "Must already exist in Setup Wizard.",
          ],
          [
            "Designation",
            "Must already exist in Workforce Setup.",
          ],
          [
            "Employment Type",
            "Full Time is created automatically by HRMS.",
          ],
          [
            "Shift",
            "Must match an existing shift name or code.",
          ],
          [
            "Reporting Manager Code",
            "Optional. Manager can be another employee in the same Excel file.",
          ],
          [
            "Password",
            "One temporary password entered in HRMS will be used for imported employees.",
          ],
        ]);

      XLSX.utils.book_append_sheet(
        workbook,
        sheet,
        "Employees"
      );

      XLSX.utils.book_append_sheet(
        workbook,
        instructions,
        "Instructions"
      );

      XLSX.writeFile(
        workbook,
        "HRMS_Employee_Import_Template.xlsx"
      );
    };

  /*
  |--------------------------------------------------------------------------
  | Read Employee Excel
  |--------------------------------------------------------------------------
  */

  const readEmployeeFile =
    async (file) => {
      setImportRows([]);
      setImportResult(null);
      setImportFile("");

      if (!file) {
        return;
      }

      try {
        const buffer =
          await file.arrayBuffer();

        const workbook =
          XLSX.read(
            buffer,
            {
              type: "array",
              cellDates: true,
            }
          );

        const sheet =
          workbook.Sheets[
            workbook
              .SheetNames[0]
          ];

        const raw =
          XLSX.utils.sheet_to_json(
            sheet,
            {
              defval: "",
              raw: false,
            }
          );

        const rows =
          raw
            .map(
              (
                row,
                index
              ) => {
                const mapped = {
                  rowNumber:
                    index + 2,
                };

                Object.entries(
                  row
                ).forEach(
                  ([
                    key,
                    value,
                  ]) => {
                    const target =
                      HEADER_MAP[
                        headerKey(
                          key
                        )
                      ];

                    if (target) {
                      mapped[
                        target
                      ] =
                        String(
                          value ??
                            ""
                        ).trim();
                    }
                  }
                );

                return mapped;
              }
            )
            .filter(
              (row) =>
                row.employeeCode ||
                row.firstName ||
                row.workEmail
            );

        setImportRows(
          rows
        );

        setImportFile(
          file.name
        );
      } catch {
        setError(
          "Unable to read employee Excel file."
        );
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Employee Import Lookups
  |--------------------------------------------------------------------------
  */

  const lookupMaps =
    useMemo(() => {
      const map =
        (items) => {
          const result =
            new Map();

          items.forEach(
            (item) => {
              if (item.name) {
                result.set(
                  normalize(
                    item.name
                  ),
                  item
                );
              }

              if (item.code) {
                result.set(
                  normalize(
                    item.code
                  ),
                  item
                );
              }
            }
          );

          return result;
        };

      return {
        departments:
          map(
            departments
          ),

        designations:
          map(
            designations
          ),

        employmentTypes:
          map(
            employmentTypes
          ),

        locations:
          map(
            locations
          ),

        grades:
          map(
            grades
          ),

        shifts:
          map(
            activeShifts
          ),
      };
    }, [
      departments,
      designations,
      employmentTypes,
      locations,
      grades,
      activeShifts,
    ]);

  /*
  |--------------------------------------------------------------------------
  | Import Employees
  |--------------------------------------------------------------------------
  */

  const importEmployees =
    async () => {
      if (
        !importRows.length
      ) {
        setError(
          "Select an employee Excel file first."
        );

        return;
      }

      if (
        initialPassword.length <
        8
      ) {
        setError(
          "Temporary password must be at least 8 characters."
        );

        return;
      }

      try {
        setBusy("employees");
        setError("");

        const errors = [];
        const createdCodes = [];

        const defaultEmployment =
          lookupMaps.employmentTypes.get(
            "full time"
          ) ||
          employmentTypes[0];

        const defaultShift =
          activeShifts.find(
            (shift) =>
              shift.isDefault
          ) ||
          activeShifts[0];

        /*
        |--------------------------------------------------------------------------
        | Pass 1 — Create employees
        |--------------------------------------------------------------------------
        */

        for (
          const row of importRows
        ) {
          try {
            const department =
              lookupMaps.departments.get(
                normalize(
                  row.department
                )
              );

            const designation =
              lookupMaps.designations.get(
                normalize(
                  row.designation
                )
              );

            const employmentType =
              row.employmentType
                ? lookupMaps.employmentTypes.get(
                    normalize(
                      row.employmentType
                    )
                  )
                : defaultEmployment;

            const location =
              row.location
                ? lookupMaps.locations.get(
                    normalize(
                      row.location
                    )
                  )
                : null;

            const grade =
              row.grade
                ? lookupMaps.grades.get(
                    normalize(
                      row.grade
                    )
                  )
                : null;

            const shift =
              row.shift
                ? lookupMaps.shifts.get(
                    normalize(
                      row.shift
                    )
                  )
                : defaultShift;

            if (
              !row.employeeCode ||
              !row.firstName ||
              !row.workEmail
            ) {
              throw new Error(
                "Employee Code, First Name and Work Email are required."
              );
            }

            if (
              !department
            ) {
              throw new Error(
                `Department "${row.department}" was not found.`
              );
            }

            if (
              !designation
            ) {
              throw new Error(
                `Designation "${row.designation}" was not found.`
              );
            }

            if (
              designation.departmentId &&
              String(
                designation.departmentId
                  ?._id ||
                  designation.departmentId
              ) !==
                String(
                  department._id
                )
            ) {
              throw new Error(
                `${designation.name} does not belong to ${department.name}.`
              );
            }

            if (
              !employmentType
            ) {
              throw new Error(
                "Employment Type was not found."
              );
            }

            await api.post(
              "/employees",
              {
                employeeCode:
                  row.employeeCode,

                firstName:
                  row.firstName,

                lastName:
                  row.lastName ||
                  "",

                email:
                  row.workEmail,

                phone:
                  row.phone ||
                  "",

                departmentId:
                  department._id,

                designationId:
                  designation._id,

                employmentTypeId:
                  employmentType._id,

                locationId:
                  location?._id ||
                  null,

                gradeId:
                  grade?._id ||
                  null,

                managerId:
                  null,

                joiningDate:
                  row.joiningDate ||
                  today(),

                status:
                  row.status ||
                  "active",

                shiftId:
                  shift?._id ||
                  "",

                initialPassword,

                dateOfBirth:
                  row.dateOfBirth ||
                  null,

                gender:
                  row.gender ||
                  "",

                address:
                  row.address ||
                  "",

                lastWorkingDate:
                  row.lastWorkingDate ||
                  null,
              }
            );

            createdCodes.push(
              row.employeeCode
            );
          } catch (err) {
            errors.push({
              row:
                row.rowNumber,

              employeeCode:
                row.employeeCode,

              message:
                getError(
                  err,
                  err.message ||
                    "Unable to create employee."
                ),
            });
          }
        }

        /*
        |--------------------------------------------------------------------------
        | Pass 2 — Reporting Managers
        |--------------------------------------------------------------------------
        */

        const refreshed =
          (
            await api.get(
              "/employees"
            )
          ).data ||
          [];

        const employeeMap =
          new Map();

        refreshed.forEach(
          (item) => {
            employeeMap.set(
              normalize(
                item.employeeCode
              ),
              item
            );
          }
        );

        for (
          const row of importRows
        ) {
          if (
            !row.reportingManagerCode
          ) {
            continue;
          }

          const employeeItem =
            employeeMap.get(
              normalize(
                row.employeeCode
              )
            );

          const manager =
            employeeMap.get(
              normalize(
                row.reportingManagerCode
              )
            );

          if (
            !employeeItem ||
            !manager
          ) {
            continue;
          }

          try {
            await api.put(
              `/employees/${employeeItem._id}`,
              {
                managerId:
                  manager._id,
              }
            );
          } catch {
            // Employee is already created.
            // Manager can be corrected later if needed.
          }
        }

        setImportResult({
          created:
            createdCodes.length,

          failed:
            errors.length,

          errors,
        });

        setNotice(
          `${createdCodes.length} employee(s) imported.`
        );

        await load();
      } finally {
        setBusy("");
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  if (loading) {
    return (
      <p>
        Loading setup...
      </p>
    );
  }

  return (
    <>
      <PageHeader
        title="HRMS Setup"
        description="Complete the company setup in order. HRMS will guide you through everything needed before daily use."
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

      {/* Progress */}

      <Card>
        <div className="card-head">
          <div>
            <span className="eyebrow">
              Setup Progress
            </span>

            <h2>
              {completion}% Complete
            </h2>

            <p>
              {allComplete
                ? "Your HRMS basic setup is ready."
                : `${completedCount} of 6 setup steps completed.`}
            </p>
          </div>

          <strong
            style={{
              fontSize: 28,
            }}
          >
            {completedCount}/6
          </strong>
        </div>

        <div
          style={{
            height: 10,
            background: "#e2e8f0",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${completion}%`,
              background: "#7c3aed",
              borderRadius: 999,
              transition: "width .25s ease",
            }}
          />
        </div>
      </Card>

      <FullHRMSImport
        onComplete={load}
      />

      {/* Step 1 */}

      <SetupStep
        number="1"
        title="Departments"
        description="Add the main teams in your company."
        complete={
          status.departments
        }
      >
        {departments.length >
          0 && (
          <div
            className="button-row"
            style={{
              marginBottom: 16,
            }}
          >
            {departments.map(
              (item) => (
                <span
                  key={item._id}
                  style={{
                    padding:
                      "6px 10px",
                    background:
                      "#f8fafc",
                    border:
                      "1px solid #e2e8f0",
                    borderRadius:
                      999,
                    fontSize: 12,
                  }}
                >
                  {item.name}
                </span>
              )
            )}
          </div>
        )}

        <form
          onSubmit={
            addDepartment
          }
          className="form-grid two"
        >
          <label className="field">
            <span>
              Department Name
            </span>

            <input
              required
              value={
                departmentForm.name
              }
              onChange={(event) =>
                setDepartmentForm({
                  ...departmentForm,
                  name:
                    event.target
                      .value,
                })
              }
              placeholder="e.g. Marketing"
            />
          </label>

          <label className="field">
            <span>
              Code
            </span>

            <input
              value={
                departmentForm.code
              }
              onChange={(event) =>
                setDepartmentForm({
                  ...departmentForm,
                  code:
                    event.target
                      .value,
                })
              }
              placeholder="Auto if blank"
            />
          </label>

          <div>
            <button
              className="button primary"
              disabled={
                busy ===
                "department"
              }
            >
              Add Department
            </button>
          </div>
        </form>
      </SetupStep>

      {/* Step 2 */}

      <SetupStep
        number="2"
        title="Designations"
        description="Connect job titles to the correct department. Employment types are created automatically."
        complete={
          status.workforce
        }
      >
        {designations.length >
          0 && (
          <p>
            <strong>
              {designations.length}
            </strong>{" "}
            designation(s) configured.
          </p>
        )}

        <form
          onSubmit={
            addDesignation
          }
          className="form-grid three"
        >
          <label className="field">
            <span>
              Department
            </span>

            <select
              required
              value={
                designationForm.departmentId
              }
              onChange={(event) =>
                setDesignationForm({
                  ...designationForm,
                  departmentId:
                    event.target
                      .value,
                })
              }
            >
              <option value="">
                Select department
              </option>

              {departments
                .filter(
                  (item) =>
                    item.isActive
                )
                .map(
                  (item) => (
                    <option
                      key={
                        item._id
                      }
                      value={
                        item._id
                      }
                    >
                      {item.name}
                    </option>
                  )
                )}
            </select>
          </label>

          <label className="field">
            <span>
              Designation
            </span>

            <input
              required
              value={
                designationForm.name
              }
              onChange={(event) =>
                setDesignationForm({
                  ...designationForm,
                  name:
                    event.target
                      .value,
                })
              }
              placeholder="e.g. Designer"
            />
          </label>

          <label className="field">
            <span>
              Code
            </span>

            <input
              value={
                designationForm.code
              }
              onChange={(event) =>
                setDesignationForm({
                  ...designationForm,
                  code:
                    event.target
                      .value,
                })
              }
              placeholder="Auto if blank"
            />
          </label>

          <div>
            <button
              className="button primary"
              disabled={
                busy ===
                "designation"
              }
            >
              Add Designation
            </button>
          </div>
        </form>
      </SetupStep>

      {/* Step 3 */}

      <SetupStep
        number="3"
        title="Shifts"
        description="Use recommended shifts now. You can edit timings later."
        complete={
          status.shifts
        }
      >
        <p>
          Recommended:
          {" "}
          Morning 10:00–18:30,
          Evening 15:00–23:30,
          Early 09:30–18:00.
        </p>

        <button
          className="button primary"
          disabled={
            busy ===
            "shifts"
          }
          onClick={
            createRecommendedShifts
          }
        >
          {status.shifts
            ? "Add Missing Recommended Shifts"
            : "Use Recommended Shifts"}
        </button>
      </SetupStep>

      {/* Step 4 */}

      <SetupStep
        number="4"
        title="Work Schedule"
        description="Set your normal work week once."
        complete={
          status.calendar
        }
      >
        <p>
          Recommended setup:
          Monday–Friday Office,
          1st/3rd/5th Saturday WFH,
          2nd/4th Saturday Off,
          Sunday Off.
        </p>

        {!status.calendar && (
          <button
            className="button primary"
            disabled={
              busy ===
              "calendar"
            }
            onClick={
              createRecommendedCalendar
            }
          >
            Use Recommended Schedule
          </button>
        )}

        {status.calendar && (
          <button
            className="button secondary"
            onClick={() => {
              window.location.href =
                "/holidays";
            }}
          >
            Review Work Calendar
          </button>
        )}
      </SetupStep>

      {/* Step 5 */}

      <SetupStep
        number="5"
        title="Leave Policies"
        description="Create common leave policies automatically."
        complete={
          status.leaves
        }
      >
        <p>
          Annual Leave · Sick Leave ·
          Casual Leave · Unpaid Leave
        </p>

        <button
          className="button primary"
          disabled={
            busy ===
            "leaves"
          }
          onClick={
            createRecommendedLeaves
          }
        >
          {status.leaves
            ? "Add Missing Policies"
            : "Use Recommended Leave Policies"}
        </button>
      </SetupStep>

      {/* Step 6 */}

      <SetupStep
        number="6"
        title="Import Employees"
        description="Download the template, fill employee data and upload it here."
        complete={
          status.employees
        }
      >
        <div className="button-row">
          <button
            type="button"
            className="button secondary"
            onClick={
              downloadEmployeeTemplate
            }
          >
            Download Employee Template
          </button>
        </div>

        <div
          className="form-grid two"
          style={{
            marginTop: 16,
          }}
        >
          <label className="field">
            <span>
              Employee Excel File
            </span>

            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(event) =>
                readEmployeeFile(
                  event.target
                    .files?.[0]
                )
              }
            />

            {importFile && (
              <small>
                {importFile} ·{" "}
                {importRows.length} row(s)
              </small>
            )}
          </label>

          <label className="field">
            <span>
              Temporary Login Password
            </span>

            <input
              type="text"
              minLength="8"
              value={
                initialPassword
              }
              onChange={(event) =>
                setInitialPassword(
                  event.target
                    .value
                )
              }
            />

            <small>
              Employees change this
              after first login.
            </small>
          </label>
        </div>

        <button
          className="button primary"
          disabled={
            busy ===
              "employees" ||
            !importRows.length
          }
          onClick={
            importEmployees
          }
        >
          {busy ===
          "employees"
            ? "Importing..."
            : "Import Employees"}
        </button>

        {importResult && (
          <Card
            style={{
              marginTop: 16,
            }}
          >
            <strong>
              {importResult.created} imported
              {" · "}
              {importResult.failed} failed
            </strong>

            {importResult.errors
              .length >
              0 && (
              <div
                className="table-wrap"
                style={{
                  marginTop: 12,
                }}
              >
                <table>
                  <thead>
                    <tr>
                      <th>
                        Row
                      </th>
                      <th>
                        Employee
                      </th>
                      <th>
                        Issue
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {importResult.errors.map(
                      (
                        item,
                        index
                      ) => (
                        <tr
                          key={
                            index
                          }
                        >
                          <td>
                            {item.row}
                          </td>

                          <td>
                            {item.employeeCode ||
                              "—"}
                          </td>

                          <td>
                            {item.message}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </SetupStep>

      {/* Finish */}

      {allComplete && (
        <Alert type="success">
          Basic HRMS setup is complete.
          You can now use Attendance,
          Leave Management, Shifts and
          Work Calendar normally.
        </Alert>
      )}
    </>
  );
}