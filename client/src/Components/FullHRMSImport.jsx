import {
  useState,
} from "react";

import * as XLSX from "xlsx";

import api from "../services/api";

import {
  Alert,
  Card,
} from "./UI";

import {
  getError,
} from "../utils/format";

const REQUIRED_SHEETS = [
  "Departments",
  "Designations",
  "Shifts",
  "Employees Upload",
];

const clean = (
  value = ""
) =>
  String(
    value ?? ""
  ).trim();

const normalize = (
  value = ""
) =>
  clean(value)
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

const codeFromName = (
  value = ""
) =>
  clean(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

const isNA = (
  value
) =>
  [
    "",
    "n/a",
    "na",
    "none",
  ].includes(
    normalize(value)
  );

const activeValue = (
  value
) =>
  ![
    "inactive",
    "no",
    "false",
    "0",
  ].includes(
    normalize(value)
  );

const sheetRows = (
  workbook,
  name
) => {
  const sheet =
    workbook.Sheets[name];

  if (!sheet) {
    return [];
  }

  return XLSX.utils.sheet_to_json(
    sheet,
    {
      defval: "",
      raw: false,
    }
  );
};

const getDepartmentId = (
  item
) =>
  String(
    item?.departmentId?._id ||
    item?.departmentId ||
    ""
  );

export default function FullHRMSImport({
  onComplete,
}) {
  const [
    parsed,
    setParsed,
  ] =
    useState(null);

  const [
    fileName,
    setFileName,
  ] =
    useState("");

  const [
    errors,
    setErrors,
  ] =
    useState([]);

  const [
    warnings,
    setWarnings,
  ] =
    useState([]);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    progress,
    setProgress,
  ] =
    useState("");

  const [
    result,
    setResult,
  ] =
    useState(null);

  const [
    password,
    setPassword,
  ] =
    useState(
      "Welcome@123"
    );

  /*
  |--------------------------------------------------------------------------
  | Parse Workbook
  |--------------------------------------------------------------------------
  */

  const selectFile =
    async (
      file
    ) => {
      setParsed(null);
      setErrors([]);
      setWarnings([]);
      setResult(null);

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
              type:
                "array",

              cellDates:
                true,
            }
          );

        const missing =
          REQUIRED_SHEETS.filter(
            (
              name
            ) =>
              !workbook
                .SheetNames
                .includes(
                  name
                )
          );

        if (
          missing.length
        ) {
          setErrors([
            `Missing sheet(s): ${missing.join(", ")}`,
          ]);

          return;
        }

        const data = {
          departments:
            sheetRows(
              workbook,
              "Departments"
            ),

          designations:
            sheetRows(
              workbook,
              "Designations"
            ),

          shifts:
            sheetRows(
              workbook,
              "Shifts"
            ),

          employees:
            sheetRows(
              workbook,
              "Employees Upload"
            ),
        };

        setFileName(
          file.name
        );

        setParsed(
          data
        );

        await validate(
          data
        );
      } catch (error) {
        setErrors([
          "Unable to read the workbook.",
        ]);
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Validate
  |--------------------------------------------------------------------------
  */

  const validate =
    async (
      data
    ) => {
      const foundErrors =
        [];

      const foundWarnings =
        [];

      try {
        const [
          departmentRes,
          masterRes,
          shiftRes,
          employeeRes,
        ] =
          await Promise.all([
            api.get(
              "/departments"
            ),

            api.get(
              "/master-data"
            ),

            api.get(
              "/shifts"
            ),

            api.get(
              "/employees"
            ),
          ]);

        const existingDepartments =
          departmentRes.data ||
          [];

        const master =
          masterRes.data ||
          [];

        const existingShifts =
          shiftRes.data ||
          [];

        const existingEmployees =
          employeeRes.data ||
          [];

        /*
        |--------------------------------------------------------------------------
        | Department names
        |--------------------------------------------------------------------------
        */

        const departmentNames =
          new Set(
            [
              ...existingDepartments.map(
                (
                  item
                ) =>
                  normalize(
                    item.name
                  )
              ),

              ...data.departments.map(
                (
                  row
                ) =>
                  normalize(
                    row[
                      "Department Name"
                    ]
                  )
              ),
            ].filter(
              Boolean
            )
          );

        /*
        |--------------------------------------------------------------------------
        | Designations
        |--------------------------------------------------------------------------
        */

        const designationKeys =
          new Set();

        master
          .filter(
            (
              item
            ) =>
              item.type ===
              "designation"
          )
          .forEach(
            (
              item
            ) => {
              const dept =
                item.departmentId
                  ?.name ||
                "";

              designationKeys.add(
                `${normalize(
                  dept
                )}::${normalize(
                  item.name
                )}`
              );
            }
          );

        data.designations.forEach(
          (
            row,
            index
          ) => {
            const department =
              clean(
                row.Department
              );

            const designation =
              clean(
                row.Designation
              );

            if (
              !department ||
              !designation
            ) {
              foundErrors.push(
                `Designations row ${
                  index +
                  2
                }: Department and Designation are required.`
              );

              return;
            }

            if (
              !departmentNames.has(
                normalize(
                  department
                )
              )
            ) {
              foundErrors.push(
                `Designations row ${
                  index +
                  2
                }: Department "${department}" does not exist.`
              );
            }

            designationKeys.add(
              `${normalize(
                department
              )}::${normalize(
                designation
              )}`
            );
          }
        );

        /*
        |--------------------------------------------------------------------------
        | Shift definitions
        |--------------------------------------------------------------------------
        */

        const existingShiftNames =
          new Set();

        existingShifts.forEach(
          (
            shift
          ) => {
            existingShiftNames.add(
              normalize(
                shift.name
              )
            );

            existingShiftNames.add(
              normalize(
                shift.code
              )
            );
          }
        );

        const workbookShiftMap =
          new Map();

        data.shifts.forEach(
          (
            row
          ) => {
            const name =
              clean(
                row[
                  "Shift Name"
                ]
              );

            if (
              name &&
              !isNA(name)
            ) {
              workbookShiftMap.set(
                normalize(
                  name
                ),
                row
              );
            }
          }
        );

        /*
        |--------------------------------------------------------------------------
        | Employees
        |--------------------------------------------------------------------------
        */

        const codes =
          new Set();

        const emails =
          new Set();

        data.employees.forEach(
          (
            row,
            index
          ) => {
            const number =
              index +
              2;

            const code =
              clean(
                row[
                  "Employee Code"
                ]
              );

            const firstName =
              clean(
                row[
                  "First Name"
                ]
              );

            const email =
              clean(
                row[
                  "Work Email"
                ]
              );

            const department =
              clean(
                row.Department
              );

            const designation =
              clean(
                row.Designation
              );

            const shift =
              clean(
                row.Shift
              );

            if (!code) {
              foundErrors.push(
                `Employees row ${number}: Employee Code is required.`
              );
            }

            if (
              !firstName
            ) {
              foundErrors.push(
                `Employees row ${number}: First Name is required.`
              );
            }

            if (!email) {
              foundErrors.push(
                `Employees row ${number} (${code || "Unknown"}): Work Email is required.`
              );
            }

            if (
              code &&
              codes.has(
                normalize(
                  code
                )
              )
            ) {
              foundErrors.push(
                `Employees row ${number}: Duplicate Employee Code "${code}" inside workbook.`
              );
            }

            if (code) {
              codes.add(
                normalize(
                  code
                )
              );
            }

            if (
              email &&
              emails.has(
                normalize(
                  email
                )
              )
            ) {
              foundErrors.push(
                `Employees row ${number}: Duplicate Work Email "${email}" inside workbook.`
              );
            }

            if (email) {
              emails.add(
                normalize(
                  email
                )
              );
            }

            if (
              !departmentNames.has(
                normalize(
                  department
                )
              )
            ) {
              foundErrors.push(
                `Employees row ${number} (${code}): Department "${department}" does not exist.`
              );
            }

            if (
              !designationKeys.has(
                `${normalize(
                  department
                )}::${normalize(
                  designation
                )}`
              )
            ) {
              foundErrors.push(
                `Employees row ${number} (${code}): Designation "${designation}" is not configured under "${department}".`
              );
            }

            /*
            |--------------------------------------------------------------------------
            | Shift
            |--------------------------------------------------------------------------
            */

            if (
              isNA(
                shift
              )
            ) {
              foundWarnings.push(
                `${code}: Shift is N/A, so the system default shift will be used.`
              );
            } else if (
              !existingShiftNames.has(
                normalize(
                  shift
                )
              )
            ) {
              const definition =
                workbookShiftMap.get(
                  normalize(
                    shift
                  )
                );

              if (
                !definition ||
                !clean(
                  definition[
                    "Start Time"
                  ]
                ) ||
                !clean(
                  definition[
                    "End Time"
                  ]
                )
              ) {
                foundErrors.push(
                  `${code}: Shift "${shift}" does not exist in HRMS and its Start/End Time is missing from the Shifts sheet.`
                );
              }
            }
          }
        );

        /*
        |--------------------------------------------------------------------------
        | Existing employees
        |--------------------------------------------------------------------------
        */

        const existingCodes =
          new Set(
            existingEmployees.map(
              (
                item
              ) =>
                normalize(
                  item.employeeCode
                )
            )
          );

        const alreadyExists =
          data.employees.filter(
            (
              row
            ) =>
              existingCodes.has(
                normalize(
                  row[
                    "Employee Code"
                  ]
                )
              )
          );

        if (
          alreadyExists.length
        ) {
          foundWarnings.push(
            `${alreadyExists.length} employee(s) already exist and will be skipped.`
          );
        }

        setErrors(
          foundErrors
        );

        setWarnings(
          foundWarnings
        );
      } catch (error) {
        setErrors([
          getError(
            error,
            "Unable to validate workbook against HRMS."
          ),
        ]);
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Import
  |--------------------------------------------------------------------------
  */

  const runImport =
    async () => {
      if (
        !parsed ||
        errors.length
      ) {
        return;
      }

      if (
        password.length <
        8
      ) {
        setErrors([
          "Temporary password must be at least 8 characters.",
        ]);

        return;
      }

      setBusy(true);
      setResult(null);

      const summary = {
        departmentsCreated:
          0,

        designationsCreated:
          0,

        shiftsCreated:
          0,

        employeesCreated:
          0,

        employeesSkipped:
          0,

        managerLinksUpdated:
          0,

        failures:
          [],
      };

      try {
        /*
        |--------------------------------------------------------------------------
        | 1. Departments
        |--------------------------------------------------------------------------
        */

        setProgress(
          "Creating departments..."
        );

        let departmentList =
          (
            await api.get(
              "/departments"
            )
          ).data ||
          [];

        const departmentMap =
          new Map();

        departmentList.forEach(
          (
            department
          ) => {
            departmentMap.set(
              normalize(
                department.name
              ),
              department
            );

            departmentMap.set(
              normalize(
                department.code
              ),
              department
            );
          }
        );

        for (
          const row of parsed.departments
        ) {
          const name =
            clean(
              row[
                "Department Name"
              ]
            );

          if (!name) {
            continue;
          }

          if (
            departmentMap.has(
              normalize(
                name
              )
            )
          ) {
            continue;
          }

          try {
            const response =
              await api.post(
                "/departments",
                {
                  name,

                  code:
                    clean(
                      row[
                        "Suggested Code"
                      ]
                    ) ||
                    codeFromName(
                      name
                    ),

                  isActive:
                    activeValue(
                      row.Status
                    ),
                }
              );

            departmentMap.set(
              normalize(
                name
              ),
              response.data
            );

            summary.departmentsCreated +=
              1;
          } catch (error) {
            summary.failures.push(
              `Department "${name}": ${getError(
                error
              )}`
            );
          }
        }

        /*
        |--------------------------------------------------------------------------
        | Reload departments
        |--------------------------------------------------------------------------
        */

        departmentList =
          (
            await api.get(
              "/departments"
            )
          ).data ||
          [];

        departmentMap.clear();

        departmentList.forEach(
          (
            department
          ) => {
            departmentMap.set(
              normalize(
                department.name
              ),
              department
            );

            departmentMap.set(
              normalize(
                department.code
              ),
              department
            );
          }
        );

        /*
        |--------------------------------------------------------------------------
        | 2. Designations
        |--------------------------------------------------------------------------
        */

        setProgress(
          "Creating designations..."
        );

        let master =
          (
            await api.get(
              "/master-data"
            )
          ).data ||
          [];

        const designationMap =
          new Map();

        master
          .filter(
            (
              item
            ) =>
              item.type ===
              "designation"
          )
          .forEach(
            (
              item
            ) => {
              const deptId =
                getDepartmentId(
                  item
                );

              designationMap.set(
                `${deptId}::${normalize(
                  item.name
                )}`,
                item
              );
            }
          );

        for (
          const row of parsed.designations
        ) {
          const department =
            departmentMap.get(
              normalize(
                row.Department
              )
            );

          const name =
            clean(
              row.Designation
            );

          if (
            !department ||
            !name
          ) {
            continue;
          }

          const key =
            `${department._id}::${normalize(
              name
            )}`;

          if (
            designationMap.has(
              key
            )
          ) {
            continue;
          }

          try {
            const response =
              await api.post(
                "/master-data",
                {
                  type:
                    "designation",

                  name,

                  code:
                    clean(
                      row[
                        "Suggested Code"
                      ]
                    ) ||
                    codeFromName(
                      name
                    ),

                  departmentId:
                    department._id,

                  isActive:
                    activeValue(
                      row.Status
                    ),
                }
              );

            designationMap.set(
              key,
              response.data
            );

            summary.designationsCreated +=
              1;
          } catch (error) {
            summary.failures.push(
              `Designation "${name}": ${getError(
                error
              )}`
            );
          }
        }

        /*
        |--------------------------------------------------------------------------
        | Reload Master Data
        |--------------------------------------------------------------------------
        */

        master =
          (
            await api.get(
              "/master-data"
            )
          ).data ||
          [];

        const employmentTypes =
          master.filter(
            (
              item
            ) =>
              item.type ===
                "employment-type" &&
              item.isActive
          );

        const employmentMap =
          new Map();

        employmentTypes.forEach(
          (
            item
          ) => {
            employmentMap.set(
              normalize(
                item.name
              ),
              item
            );

            employmentMap.set(
              normalize(
                item.code
              ),
              item
            );
          }
        );

        /*
        |--------------------------------------------------------------------------
        | Rebuild designations after reload
        |--------------------------------------------------------------------------
        */

        designationMap.clear();

        master
          .filter(
            (
              item
            ) =>
              item.type ===
              "designation"
          )
          .forEach(
            (
              item
            ) => {
              designationMap.set(
                `${getDepartmentId(
                  item
                )}::${normalize(
                  item.name
                )}`,
                item
              );
            }
          );

        /*
        |--------------------------------------------------------------------------
        | 3. Shifts
        |--------------------------------------------------------------------------
        */

        setProgress(
          "Creating shifts..."
        );

        let shifts =
          (
            await api.get(
              "/shifts"
            )
          ).data ||
          [];

        const shiftMap =
          new Map();

        shifts.forEach(
          (
            shift
          ) => {
            shiftMap.set(
              normalize(
                shift.name
              ),
              shift
            );

            shiftMap.set(
              normalize(
                shift.code
              ),
              shift
            );
          }
        );

        for (
          const row of parsed.shifts
        ) {
          const name =
            clean(
              row[
                "Shift Name"
              ]
            );

          if (
            !name ||
            isNA(name)
          ) {
            continue;
          }

          if (
            shiftMap.has(
              normalize(
                name
              )
            )
          ) {
            continue;
          }

          const startTime =
            clean(
              row[
                "Start Time"
              ]
            );

          const endTime =
            clean(
              row[
                "End Time"
              ]
            );

          if (
            !startTime ||
            !endTime
          ) {
            summary.failures.push(
              `Shift "${name}": Start Time / End Time missing.`
            );

            continue;
          }

          try {
            const response =
              await api.post(
                "/shifts",
                {
                  name,

                  code:
                    codeFromName(
                      name
                    ),

                  startTime,

                  endTime,

                  breakMinutes:
                    Number(
                      row[
                        "Break Minutes"
                      ] ||
                        30
                    ),

                  graceMinutes:
                    Number(
                      row[
                        "Grace Minutes"
                      ] ||
                        15
                    ),

                  workingDays: [
                    1,
                    2,
                    3,
                    4,
                    5,
                  ],

                  isDefault:
                    shifts.length ===
                      0 &&
                    summary.shiftsCreated ===
                      0,

                  isActive:
                    true,
                }
              );

            const shift =
              response.data;

            shiftMap.set(
              normalize(
                shift.name
              ),
              shift
            );

            shiftMap.set(
              normalize(
                shift.code
              ),
              shift
            );

            summary.shiftsCreated +=
              1;
          } catch (error) {
            summary.failures.push(
              `Shift "${name}": ${getError(
                error
              )}`
            );
          }
        }

        /*
        |--------------------------------------------------------------------------
        | Reload shifts
        |--------------------------------------------------------------------------
        */

        shifts =
          (
            await api.get(
              "/shifts"
            )
          ).data ||
          [];

        shiftMap.clear();

        shifts.forEach(
          (
            shift
          ) => {
            shiftMap.set(
              normalize(
                shift.name
              ),
              shift
            );

            shiftMap.set(
              normalize(
                shift.code
              ),
              shift
            );
          }
        );

        /*
        |--------------------------------------------------------------------------
        | 4. Employees
        |--------------------------------------------------------------------------
        */

        setProgress(
          "Creating employees..."
        );

        let existingEmployees =
          (
            await api.get(
              "/employees"
            )
          ).data ||
          [];

        const existingCodeMap =
          new Map();

        existingEmployees.forEach(
          (
            item
          ) => {
            existingCodeMap.set(
              normalize(
                item.employeeCode
              ),
              item
            );
          }
        );

        const fullTime =
          employmentMap.get(
            "full time"
          ) ||
          employmentTypes[0];

        const intern =
          employmentMap.get(
            "intern"
          );

        for (
          const row of parsed.employees
        ) {
          const employeeCode =
            clean(
              row[
                "Employee Code"
              ]
            );

          if (
            existingCodeMap.has(
              normalize(
                employeeCode
              )
            )
          ) {
            summary.employeesSkipped +=
              1;

            continue;
          }

          const department =
            departmentMap.get(
              normalize(
                row.Department
              )
            );

          if (!department) {
            summary.failures.push(
              `${employeeCode}: Department "${row.Department}" not found.`
            );

            continue;
          }

          const designation =
            designationMap.get(
              `${department._id}::${normalize(
                row.Designation
              )}`
            );

          if (!designation) {
            summary.failures.push(
              `${employeeCode}: Designation "${row.Designation}" not found.`
            );

            continue;
          }

          /*
          |--------------------------------------------------------------------------
          | Employment Type
          |--------------------------------------------------------------------------
          |
          | Sheet value wins.
          | If blank:
          | designation containing "Intern" -> Intern
          | otherwise -> Full Time
          |--------------------------------------------------------------------------
          */

          const requestedEmployment =
            clean(
              row[
                "Employment Type"
              ]
            );

          let employmentType =
            requestedEmployment
              ? employmentMap.get(
                  normalize(
                    requestedEmployment
                  )
                )
              : null;

          if (
            !employmentType
          ) {
            employmentType =
              normalize(
                row.Designation
              ).includes(
                "intern"
              ) &&
              intern
                ? intern
                : fullTime;
          }

          if (
            !employmentType
          ) {
            summary.failures.push(
              `${employeeCode}: Employment Type could not be resolved.`
            );

            continue;
          }

          /*
          |--------------------------------------------------------------------------
          | Shift
          |--------------------------------------------------------------------------
          */

          const shiftName =
            clean(
              row.Shift
            );

          const shift =
            isNA(
              shiftName
            )
              ? null
              : shiftMap.get(
                  normalize(
                    shiftName
                  )
                );

          if (
            !isNA(
              shiftName
            ) &&
            !shift
          ) {
            summary.failures.push(
              `${employeeCode}: Shift "${shiftName}" not found.`
            );

            continue;
          }

          try {
            await api.post(
              "/employees",
              {
                employeeCode,

                firstName:
                  clean(
                    row[
                      "First Name"
                    ]
                  ),

                lastName:
                  clean(
                    row[
                      "Last Name"
                    ]
                  ),

                email:
                  clean(
                    row[
                      "Work Email"
                    ]
                  ),

                phone:
                  clean(
                    row.Phone
                  ),

                departmentId:
                  department._id,

                designationId:
                  designation._id,

                employmentTypeId:
                  employmentType._id,

                managerId:
                  null,

                locationId:
                  null,

                gradeId:
                  null,

                joiningDate:
                  clean(
                    row[
                      "Joining Date"
                    ]
                  ) ||
                  undefined,

                status:
                  clean(
                    row.Status
                  ) ||
                  "active",

                shiftId:
                  shift?._id ||
                  "",

                initialPassword:
                  password,

                dateOfBirth:
                  clean(
                    row[
                      "Date of Birth"
                    ]
                  ) ||
                  null,

                gender:
                  normalize(
                    row.Gender
                  ),

                address:
                  clean(
                    row.Address
                  ),

                lastWorkingDate:
                  clean(
                    row[
                      "Last Working Date"
                    ]
                  ) ||
                  null,
              }
            );

            summary.employeesCreated +=
              1;
          } catch (error) {
            summary.failures.push(
              `${employeeCode}: ${getError(
                error
              )}`
            );
          }
        }

        /*
        |--------------------------------------------------------------------------
        | 5. Reporting Managers
        |--------------------------------------------------------------------------
        */

        setProgress(
          "Linking reporting managers..."
        );

        existingEmployees =
          (
            await api.get(
              "/employees"
            )
          ).data ||
          [];

        const employeeMap =
          new Map();

        existingEmployees.forEach(
          (
            item
          ) => {
            employeeMap.set(
              normalize(
                item.employeeCode
              ),
              item
            );
          }
        );

        for (
          const row of parsed.employees
        ) {
          const managerCode =
            clean(
              row[
                "Reporting Manager Code"
              ]
            );

          if (
            !managerCode
          ) {
            continue;
          }

          const employee =
            employeeMap.get(
              normalize(
                row[
                  "Employee Code"
                ]
              )
            );

          const manager =
            employeeMap.get(
              normalize(
                managerCode
              )
            );

          if (
            !employee ||
            !manager
          ) {
            summary.failures.push(
              `${row["Employee Code"]}: Reporting manager "${managerCode}" could not be linked.`
            );

            continue;
          }

          try {
            await api.put(
              `/employees/${employee._id}`,
              {
                managerId:
                  manager._id,
              }
            );

            summary.managerLinksUpdated +=
              1;
          } catch (error) {
            summary.failures.push(
              `${row["Employee Code"]}: Manager link failed — ${getError(
                error
              )}`
            );
          }
        }

        setResult(
          summary
        );

        setProgress(
          "Import complete."
        );

        if (
          onComplete
        ) {
          await onComplete();
        }
      } catch (error) {
        setErrors([
          getError(
            error,
            "Full HRMS import failed."
          ),
        ]);

        setProgress("");
      } finally {
        setBusy(false);
      }
    };

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <Card>
      <div className="card-head">
        <div>
          <h2>
            Import Complete HRMS Setup
          </h2>

          <p>
            Upload one workbook to create departments,
            designations, shifts and employees in the correct order.
          </p>
        </div>
      </div>

      <Alert type="info">
        Existing records are not duplicated.
        Employee rows with an existing Employee Code are skipped.
      </Alert>

      <div className="form-grid two">
        <label className="field">
          <span>
            HRMS Workbook
          </span>

          <input
            type="file"
            accept=".xlsx,.xls"
            disabled={
              busy
            }
            onChange={(
              event
            ) =>
              selectFile(
                event.target
                  .files?.[0]
              )
            }
          />

          {fileName && (
            <small>
              {fileName}
            </small>
          )}
        </label>

        <label className="field">
          <span>
            Temporary Employee Password
          </span>

          <input
            type="text"
            minLength="8"
            value={
              password
            }
            disabled={
              busy
            }
            onChange={(
              event
            ) =>
              setPassword(
                event.target
                  .value
              )
            }
          />

          <small>
            Used only when a new employee login account is created.
          </small>
        </label>
      </div>

      {parsed && (
        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(4, minmax(120px,1fr))",

            gap:
              10,

            margin:
              "8px 0 18px",
          }}
        >
          <div>
            <small>
              Departments
            </small>

            <strong
              style={{
                display:
                  "block",

                fontSize:
                  20,
              }}
            >
              {
                parsed
                  .departments
                  .length
              }
            </strong>
          </div>

          <div>
            <small>
              Designations
            </small>

            <strong
              style={{
                display:
                  "block",

                fontSize:
                  20,
              }}
            >
              {
                parsed
                  .designations
                  .length
              }
            </strong>
          </div>

          <div>
            <small>
              Shifts
            </small>

            <strong
              style={{
                display:
                  "block",

                fontSize:
                  20,
              }}
            >
              {
                parsed
                  .shifts
                  .length
              }
            </strong>
          </div>

          <div>
            <small>
              Employees
            </small>

            <strong
              style={{
                display:
                  "block",

                fontSize:
                  20,
              }}
            >
              {
                parsed
                  .employees
                  .length
              }
            </strong>
          </div>
        </div>
      )}

      {warnings.length >
        0 && (
        <Alert type="info">
          <strong>
            Warnings
          </strong>

          <div
            style={{
              marginTop:
                6,
            }}
          >
            {warnings.map(
              (
                warning,
                index
              ) => (
                <div
                  key={
                    index
                  }
                >
                  • {warning}
                </div>
              )
            )}
          </div>
        </Alert>
      )}

      {errors.length >
        0 && (
        <Alert type="error">
          <strong>
            Fix these before importing:
          </strong>

          <div
            style={{
              marginTop:
                7,

              maxHeight:
                250,

              overflowY:
                "auto",
            }}
          >
            {errors.map(
              (
                item,
                index
              ) => (
                <div
                  key={
                    index
                  }
                >
                  • {item}
                </div>
              )
            )}
          </div>
        </Alert>
      )}

      {progress && (
        <Alert
          type={
            busy
              ? "info"
              : "success"
          }
        >
          {progress}
        </Alert>
      )}

      <button
        type="button"
        className="button primary"
        disabled={
          busy ||
          !parsed ||
          errors.length >
            0
        }
        onClick={
          runImport
        }
      >
        {busy
          ? "Importing..."
          : "Import Complete HRMS Setup"}
      </button>

      {result && (
        <div
          style={{
            marginTop:
              20,
          }}
        >
          <div className="section-label">
            Import Result
          </div>

          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(auto-fit, minmax(150px,1fr))",

              gap:
                10,

              marginBottom:
                15,
            }}
          >
            <div>
              <small>
                Departments Created
              </small>

              <strong
                style={{
                  display:
                    "block",

                  fontSize:
                    22,
                }}
              >
                {
                  result
                    .departmentsCreated
                }
              </strong>
            </div>

            <div>
              <small>
                Designations Created
              </small>

              <strong
                style={{
                  display:
                    "block",

                  fontSize:
                    22,
                }}
              >
                {
                  result
                    .designationsCreated
                }
              </strong>
            </div>

            <div>
              <small>
                Shifts Created
              </small>

              <strong
                style={{
                  display:
                    "block",

                  fontSize:
                    22,
                }}
              >
                {
                  result
                    .shiftsCreated
                }
              </strong>
            </div>

            <div>
              <small>
                Employees Created
              </small>

              <strong
                style={{
                  display:
                    "block",

                  fontSize:
                    22,
                }}
              >
                {
                  result
                    .employeesCreated
                }
              </strong>
            </div>

            <div>
              <small>
                Existing Employees Skipped
              </small>

              <strong
                style={{
                  display:
                    "block",

                  fontSize:
                    22,
                }}
              >
                {
                  result
                    .employeesSkipped
                }
              </strong>
            </div>

            <div>
              <small>
                Managers Linked
              </small>

              <strong
                style={{
                  display:
                    "block",

                  fontSize:
                    22,
                }}
              >
                {
                  result
                    .managerLinksUpdated
                }
              </strong>
            </div>
          </div>

          {result.failures.length >
            0 && (
            <Alert type="error">
              <strong>
                {result.failures.length} item(s) need attention:
              </strong>

              <div
                style={{
                  marginTop:
                    7,

                  maxHeight:
                    250,

                  overflowY:
                    "auto",
                }}
              >
                {result.failures.map(
                  (
                    item,
                    index
                  ) => (
                    <div
                      key={
                        index
                      }
                    >
                      • {item}
                    </div>
                  )
                )}
              </div>
            </Alert>
          )}
        </div>
      )}
    </Card>
  );
}