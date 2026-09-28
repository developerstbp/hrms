export const formatDate = (value) => value ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "—";
export const formatTime = (value) => value || "—";
export const getError = (error, fallback = "Something went wrong.") => error?.response?.data?.message || fallback;
export const fullName = (person) => person ? `${person.firstName || ""} ${person.lastName || ""}`.trim() : "—";
