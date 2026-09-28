export const toDateKey = (value = new Date()) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const calculateLeaveDays = (startDate, endDate, halfDay = false) => {
  if (halfDay) return 0.5;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;

  let days = 0;
  const cursor = new Date(start);
  cursor.setHours(12, 0, 0, 0);
  const endCopy = new Date(end);
  endCopy.setHours(12, 0, 0, 0);

  while (cursor <= endCopy) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) days += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};
