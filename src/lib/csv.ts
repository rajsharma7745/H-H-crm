/**
 * Minimal CSV serializer — no dependency needed for this.
 *
 * Two things it deliberately handles:
 *  - RFC-4180 quoting: any value containing a comma, quote or newline is
 *    wrapped in quotes with internal quotes doubled.
 *  - Formula injection: a value starting with =, +, - or @ is prefixed with a
 *    single quote. Without this, exporting a lead named `=cmd|...` produces a
 *    spreadsheet that executes it when opened. Lead names are user input, so
 *    this is a real (and well-known) export vulnerability, not a hypothetical.
 */

const FORMULA_TRIGGERS = ["=", "+", "-", "@"];

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = value instanceof Date ? value.toISOString() : String(value);

  if (FORMULA_TRIGGERS.some((trigger) => text.startsWith(trigger))) {
    text = `'${text}`;
  }

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function toCsv<T>(rows: T[], columns: { header: string; value: (row: T) => unknown }[]): string {
  const lines = [columns.map((column) => csvCell(column.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => csvCell(column.value(row))).join(","));
  }
  // Trailing newline so the file ends cleanly in every tool.
  return `${lines.join("\r\n")}\r\n`;
}
