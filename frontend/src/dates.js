// One way to write dates and times everywhere in the app:
// dates like "4 Oct 2026", times like "7:49 AM".
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// A Date -> "4 Oct"
export function formatDay(date) {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

// A Date -> "7:49 AM" (in the phone's own time zone)
export function formatClock(date) {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
}

// "2026-10-04" (a day with no time) -> "4 Oct 2026"
export function formatDate(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text ?? "");
  if (!match) {
    return text ?? "";
  }
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

// A moment (stored in UTC) -> "Today 7:49 AM", or "4 Oct 5:00 PM" for an
// earlier day.
export function formatWhen(iso) {
  const date = new Date(iso);
  if (isNaN(date)) {
    return "";
  }
  if (date.toDateString() === new Date().toDateString()) {
    return `Today ${formatClock(date)}`;
  }
  return `${formatDay(date)} ${formatClock(date)}`;
}
