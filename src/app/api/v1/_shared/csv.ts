/** Minimal CSV helpers for Phase 10 admin exports. */

function escapeCsv(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>,
): string {
  const lines = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ];
  return `${lines.join("\n")}\n`;
}

export function csvResponse(
  filename: string,
  csv: string,
  requestId?: string,
): Response {
  const headers = new Headers({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
  });
  if (requestId) headers.set("x-request-id", requestId);
  return new Response(csv, { status: 200, headers });
}
