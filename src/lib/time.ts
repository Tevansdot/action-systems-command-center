export const TIMEZONE = "America/Jamaica";
export function jamaicaToUtc(local: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new Error("Choose a valid Jamaica date and time.");
  const date = new Date(`${local}:00-05:00`);
  if (
    !Number.isFinite(date.getTime()) ||
    utcToJamaicaInput(date.toISOString()) !== local
  )
    throw new Error("Choose a valid calendar date.");
  return date.toISOString();
}
export function utcToJamaicaInput(utc: string): string {
  const d = new Date(new Date(utc).getTime() - 5 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}
export function displayDate(
  utc: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...options,
  }).format(new Date(utc));
}
export function money(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    cents / 100,
  );
}
export function jamaicaDay(utc: string): string {
  return utcToJamaicaInput(utc).slice(0, 10);
}
