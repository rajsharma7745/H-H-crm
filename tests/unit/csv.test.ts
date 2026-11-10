import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";

describe("csvCell", () => {
  it("passes through a plain value", () => {
    expect(csvCell("Acme")).toBe("Acme");
    expect(csvCell(42)).toBe("42");
  });

  it("renders null and undefined as an empty cell", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes values containing commas, quotes or newlines", () => {
    expect(csvCell("Acme, Inc")).toBe('"Acme, Inc"');
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralizes spreadsheet formula injection", () => {
    // Without the leading apostrophe these execute when the file is opened.
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("+cmd")).toBe("'+cmd");
    expect(csvCell("-2")).toBe("'-2");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("still quotes a formula-triggering value that also contains a comma", () => {
    expect(csvCell("=HYPERLINK(1,2)")).toBe('"\'=HYPERLINK(1,2)"');
  });

  it("serializes dates as ISO strings", () => {
    expect(csvCell(new Date("2026-09-29T10:00:00.000Z"))).toBe("2026-09-29T10:00:00.000Z");
  });
});

describe("toCsv", () => {
  it("writes a header row plus one row per record, CRLF separated", () => {
    const csv = toCsv(
      [
        { name: "Acme", count: 2 },
        { name: "Globex, Inc", count: 0 },
      ],
      [
        { header: "Name", value: (row) => row.name },
        { header: "Count", value: (row) => row.count },
      ],
    );

    expect(csv).toBe('Name,Count\r\nAcme,2\r\n"Globex, Inc",0\r\n');
  });

  it("writes just the header row for an empty result set", () => {
    expect(toCsv<{ name: string }>([], [{ header: "Name", value: (row) => row.name }])).toBe("Name\r\n");
  });
});
