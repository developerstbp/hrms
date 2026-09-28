# HRMS Final — Shifts & Payroll Edition

Full-stack HRMS built with React, Express and MongoDB. This edition keeps the existing HRMS modules and adds effective-dated shift management and monthly payroll.

## Included modules

- Company onboarding and email/password login
- Role-based access: Admin, HR, HOD, Manager, Employee
- Admin-only Access Control
- Employees and reporting hierarchy
- Departments and HODs
- Attendance with employee check-in/check-out and HR manual corrections
- Leave management, balances, policies and on-behalf requests
- Holidays
- Shift management and employee shift-change requests
- Payroll, salary profiles and employee payslips
- Audit log
- Company settings
- Employee self-service profile and password change

## Role behaviour

### Admin
Full system access. Only Admin can grant/remove roles and permissions through Access Control.

### HR
Receives all operational HRMS access by default, including Employees, Departments, Attendance, Leave, Shifts, Payroll, Holidays, Audit and Company Settings. HR does not receive Access Control.

### HOD / Manager
Scoped employee visibility, attendance/leave workflows, team shift visibility, own shift requests and own payslips. Additional permissions can be granted by Admin.

### Employee
Own attendance, leave, shift/request workflow, holidays, profile and finalized payslips.

## Company shifts included by default

1. **Day Shift** — 10:00 AM to 6:30 PM
2. **Evening Shift** — 3:00 PM to 11:30 PM
3. **Early Day Shift** — 9:30 AM to 6:00 PM

Each shift also supports configurable break minutes, grace period and working days.

## Important: shift history is effective-dated

A shift change does not overwrite an employee's old shift.

Example:

- Employee works **10:00 AM–6:30 PM from 1–15 September**
- Employee requests **9:30 AM–6:00 PM from 16 September**
- HR approves the request with effective date **16 September**

The HRMS automatically closes the first assignment on 15 September and creates the new assignment from 16 September. Attendance and payroll can therefore resolve the correct shift for every date.

Existing assignment records store a schedule snapshot. Editing a shift definition later does not rewrite old assignment history.

## Shift workflow

- Employee can submit a shift-change request with requested effective date and reason.
- HR/Admin can approve or reject it.
- HR/Admin can change the approved effective date if required.
- HR/Admin can also directly assign/change a shift without a request.
- Current Shift Roster gives HR a quick company view.
- Assignment History shows all dated shift segments.
- Existing employees without a shift are automatically migrated to the default shift when HR/Admin first opens the Shifts module.

## Payroll

Payroll includes:

- Employee salary profiles
- Basic monthly salary
- Fixed allowance
- Other allowance
- Fixed deduction
- Overtime hourly rate
- Payment method and bank details
- Monthly payroll runs
- Attendance summary
- Paid/unpaid leave summary
- Explicit absence deductions
- Half-day deductions
- Optional late penalty
- Optional overtime calculation
- Manual payroll adjustments with notes
- Draft → Finalized → Paid workflow
- Employee self-service payslips

### Payroll safety

A payroll run starts as **Draft**. HR can regenerate it after correcting attendance, leave or shift assignments.

After HR selects **Finalize & Lock**, its payslip calculations are stored as snapshots. Later shift changes or salary profile edits do not silently rewrite that finalized payroll.

### Missing attendance is not automatically an absence

Only attendance explicitly marked `absent` is treated as an absence deduction. This avoids accidental payroll deductions while biometric attendance is not yet connected.

Approved unpaid leave can be deducted when the setting is enabled. Paid leave remains paid.

### Payroll settings

HR/Admin can configure:

- Salary day divisor (default 30)
- Pay day
- Explicit absence deduction on/off
- Unpaid leave deduction on/off
- Half-day deduction on/off
- Late penalty amount
- Overtime calculation on/off

Statutory tax, EOBI, provident fund or organization-specific legal deductions are intentionally not hard-coded because those rules depend on company policy and current jurisdictional requirements. They can currently be represented through fixed/manual deductions and can be added as dedicated policy modules later.

## Attendance and shifts

Employee check-in now resolves the shift assigned for that specific date. Late arrival uses that shift's start time and grace period instead of one global company start time.

Attendance records also keep:

- Shift assignment reference
- Shift name
- Scheduled start
- Scheduled end

The schema is ready to accept a future `biometric` attendance source, but the ZKTeco integration is **not connected in this edition**, as requested.

## Environment setup

### Server

Create `server/.env` from `server/.env.example`:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/hrms
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

Install and run:

```bash
cd server
npm install
npm run dev
```

### Client

Create `client/.env` from `client/.env.example` and run:

```bash
cd client
npm install
npm run dev
```

Default frontend URL:

```text
http://localhost:5173
```

Default API URL is configured by the existing client environment setup.

## MongoDB

For local MongoDB:

```env
MONGO_URI=mongodb://127.0.0.1:27017/hrms
```

Make sure the MongoDB Windows service is running before starting the server.

## Node modules

`node_modules` is intentionally not included in the project ZIP. Run `npm install` separately inside `client` and `server`.

## Validation performed

- Server JavaScript syntax checked with Node
- Client JS/JSX parsed with TypeScript's JSX parser
- Relative imports checked for missing project files
- No source dependency was added beyond the existing package files
