import { describe, expect, it } from "vitest";
import { getGreeting } from "@/lib/greeting";

describe("getGreeting", () => {
  it("says good morning before noon", () => {
    expect(getGreeting(new Date(2026, 0, 1, 6, 0))).toBe("Good morning");
    expect(getGreeting(new Date(2026, 0, 1, 11, 59))).toBe("Good morning");
  });

  it("says good afternoon from noon to before 6pm", () => {
    expect(getGreeting(new Date(2026, 0, 1, 12, 0))).toBe("Good afternoon");
    expect(getGreeting(new Date(2026, 0, 1, 17, 59))).toBe("Good afternoon");
  });

  it("says good evening from 6pm onward", () => {
    expect(getGreeting(new Date(2026, 0, 1, 18, 0))).toBe("Good evening");
    expect(getGreeting(new Date(2026, 0, 1, 23, 59))).toBe("Good evening");
  });
});
