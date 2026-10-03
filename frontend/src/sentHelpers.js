// Small helpers for the Sent and Incomplete screens.

// "2026-10-02" -> a Date at local midnight.
function dayOf(text) {
  const [y, m, d] = text.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// A heading for a day: Today, Yesterday, or "2 Oct".
export function dayHeading(text, t) {
  const day = dayOf(text);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today - day) / 86400000);
  if (days === 0) {
    return t("sentToday");
  }
  if (days === 1) {
    return t("sentYesterday");
  }
  return day.toLocaleDateString([], { day: "numeric", month: "short" });
}

// The clock time of an update, but only when it was recorded on the same
// day as the update itself (old demo rows carry no usable time).
export function timeOf(sentAt, sentOn) {
  if (!sentAt) {
    return "";
  }
  const when = new Date(sentAt);
  if (isNaN(when)) {
    return "";
  }
  const localDay = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(when.getDate()).padStart(2, "0")}`;
  if (localDay !== sentOn) {
    return "";
  }
  return when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// "YYYY-MM-DD" of a Date, in local time.
function toText(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// The Monday of the week a day falls in, as "YYYY-MM-DD".
export function weekStart(text) {
  const day = dayOf(text);
  const back = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - back);
  return toText(day);
}

export function todayText() {
  return toText(new Date());
}

// A heading for a week: This week, Last week, or "28 Sep - 4 Oct".
export function weekHeading(mondayText, t) {
  const monday = dayOf(mondayText);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d) =>
    d.toLocaleDateString([], { day: "numeric", month: "short" });
  const range = `${fmt(monday)} - ${fmt(sunday)}`;
  const thisMonday = weekStart(todayText());
  if (mondayText === thisMonday) {
    return `${t("sentThisWeek")} (${range})`;
  }
  const last = dayOf(thisMonday);
  last.setDate(last.getDate() - 7);
  if (mondayText === toText(last)) {
    return `${t("sentLastWeek")} (${range})`;
  }
  return range;
}

// "1 form" / "5 forms"
export function formsText(n, t) {
  return n === 1 ? t("sentForm") : t("sentForms", { n });
}
