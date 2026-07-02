const BR_TZ = "America/Sao_Paulo";
const BR_OFFSET = "-03:00";

export function isoToDatetimeLocalBr(iso: string | null | undefined): string {
  if (!iso?.trim()) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const year = pick("year");
  const month = pick("month");
  const day = pick("day");
  let hour = pick("hour");
  if (hour === "24") hour = "00";
  const minute = pick("minute");

  if (!year || !month || !day || !hour || !minute) return "";
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function datetimeLocalBrToIso(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(trimmed);
  if (!m) return null;

  const [, y, mo, d, h, mi] = m;
  const parsed = new Date(`${y}-${mo}-${d}T${h}:${mi}:00${BR_OFFSET}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function splitDatetimeLocalBr(value: string): { date: string; time: string } {
  if (!value || value.length < 16) return { date: "", time: "" };
  return { date: value.slice(0, 10), time: value.slice(11, 16) };
}

export function mergeDatetimeLocalBr(date: string, time: string): string {
  if (!date.trim()) return "";
  const t = time.trim() || "00:00";
  return `${date}T${t}`;
}
