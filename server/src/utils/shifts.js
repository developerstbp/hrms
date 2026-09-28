import Shift from "../models/Shift.js";
import ShiftAssignment from "../models/ShiftAssignment.js";

export const DEFAULT_SHIFTS = [
  { name: "Day Shift", code: "SHIFT-A", startTime: "10:00", endTime: "18:30", breakMinutes: 30, graceMinutes: 15, workingDays: [1, 2, 3, 4, 5], isDefault: true },
  { name: "Evening Shift", code: "SHIFT-B", startTime: "15:00", endTime: "23:30", breakMinutes: 30, graceMinutes: 15, workingDays: [1, 2, 3, 4, 5], isDefault: false },
  { name: "Early Day Shift", code: "SHIFT-C", startTime: "09:30", endTime: "18:00", breakMinutes: 30, graceMinutes: 15, workingDays: [1, 2, 3, 4, 5], isDefault: false }
];

export const dateOnly = (value = new Date()) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00.000Z`);
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

export const dateKeyUTC = (value = new Date()) => {
  const date = dateOnly(value);
  return date.toISOString().slice(0, 10);
};

export const addDaysUTC = (value, amount) => {
  const date = dateOnly(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return date;
};

export const shiftSnapshot = (shift) => ({
  name: shift.name,
  code: shift.code,
  startTime: shift.startTime,
  endTime: shift.endTime,
  breakMinutes: Number(shift.breakMinutes || 0),
  graceMinutes: Number(shift.graceMinutes || 0),
  workingDays: Array.isArray(shift.workingDays) && shift.workingDays.length ? shift.workingDays : [1, 2, 3, 4, 5]
});

export const ensureDefaultShifts = async (companyId) => {
  for (const shift of DEFAULT_SHIFTS) {
    await Shift.findOneAndUpdate(
      { companyId, code: shift.code },
      { $setOnInsert: { companyId, ...shift } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  return Shift.find({ companyId }).sort({ startTime: 1 });
};

export const getShiftAssignmentForDate = async (companyId, employeeId, value) => {
  const date = dateOnly(value);
  return ShiftAssignment.findOne({
    companyId,
    employeeId,
    effectiveFrom: { $lte: date },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: date } }]
  }).sort({ effectiveFrom: -1 });
};

export const assignShiftToEmployee = async ({ companyId, employeeId, shift, effectiveFrom, assignedByUserId, source = "manual", reason = "" }) => {
  const start = dateOnly(effectiveFrom);
  const snapshot = shiftSnapshot(shift);

  const exact = await ShiftAssignment.findOne({ companyId, employeeId, effectiveFrom: start });
  if (exact) {
    exact.shiftId = shift._id;
    exact.snapshot = snapshot;
    exact.assignedByUserId = assignedByUserId;
    exact.source = source;
    exact.reason = reason;
    await exact.save();
    return exact;
  }

  const next = await ShiftAssignment.findOne({ companyId, employeeId, effectiveFrom: { $gt: start } }).sort({ effectiveFrom: 1 });
  const previous = await ShiftAssignment.findOne({
    companyId,
    employeeId,
    effectiveFrom: { $lt: start },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: start } }]
  }).sort({ effectiveFrom: -1 });

  if (previous) {
    previous.effectiveTo = addDaysUTC(start, -1);
    await previous.save();
  }

  const assignment = await ShiftAssignment.create({
    companyId,
    employeeId,
    shiftId: shift._id,
    snapshot,
    effectiveFrom: start,
    effectiveTo: next ? addDaysUTC(next.effectiveFrom, -1) : null,
    assignedByUserId,
    source,
    reason
  });

  return assignment;
};

export const timeToMinutes = (time = "00:00") => {
  const [hours, minutes] = String(time).split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

export const workedMinutes = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;
  const start = timeToMinutes(checkIn);
  let end = timeToMinutes(checkOut);
  if (end < start) end += 24 * 60;
  return Math.max(0, end - start);
};

export const overtimeMinutesForRecord = (assignment, checkIn, checkOut) => {
  if (!assignment?.snapshot || !checkOut) return 0;
  const scheduledEnd = timeToMinutes(assignment.snapshot.endTime);
  let actualEnd = timeToMinutes(checkOut);
  const scheduledStart = timeToMinutes(assignment.snapshot.startTime);
  if (scheduledEnd < scheduledStart) {
    const normalizedScheduledEnd = scheduledEnd + 24 * 60;
    if (actualEnd < scheduledStart) actualEnd += 24 * 60;
    return Math.max(0, actualEnd - normalizedScheduledEnd);
  }
  return Math.max(0, actualEnd - scheduledEnd);
};
