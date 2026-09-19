import { describe, expect, it } from "vitest";
import { createClientSchema, updateClientSchema, UNASSIGNED_OWNER } from "@/lib/validation";

const validFields = {
  name: "Acme Corp",
  clientType: "B2B" as const,
  status: "PROSPECT" as const,
  primaryContactName: "Jane Doe",
  primaryContactEmail: "jane@acme.com",
  primaryContactPhone: "+1 555-0100",
  website: "https://acme.com",
  industry: "Retail",
  address: "123 Main St",
  notes: "Some notes",
  ownerId: "",
};

describe("createClientSchema", () => {
  it("accepts a fully populated, valid client", () => {
    expect(createClientSchema.safeParse(validFields).success).toBe(true);
  });

  it("accepts the minimum: just a name, type and status", () => {
    const result = createClientSchema.safeParse({
      name: "Minimal Co",
      clientType: "B2C",
      status: "ACTIVE",
      primaryContactName: "",
      primaryContactEmail: "",
      primaryContactPhone: "",
      website: "",
      industry: "",
      address: "",
      notes: "",
      ownerId: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing/blank name", () => {
    const result = createClientSchema.safeParse({ ...validFields, name: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toMatch(/name is required/i);
  });

  it("rejects a name over 200 characters", () => {
    const result = createClientSchema.safeParse({ ...validFields, name: "x".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email when one is supplied", () => {
    const result = createClientSchema.safeParse({ ...validFields, primaryContactEmail: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("allows an empty email", () => {
    const result = createClientSchema.safeParse({ ...validFields, primaryContactEmail: "" });
    expect(result.success).toBe(true);
  });

  it("rejects a website without a valid URL shape", () => {
    const result = createClientSchema.safeParse({ ...validFields, website: "not a url" });
    expect(result.success).toBe(false);
  });

  it("accepts an empty website", () => {
    const result = createClientSchema.safeParse({ ...validFields, website: "" });
    expect(result.success).toBe(true);
  });

  it("rejects a phone number that's just noise", () => {
    const result = createClientSchema.safeParse({ ...validFields, primaryContactPhone: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid clientType", () => {
    const result = createClientSchema.safeParse({ ...validFields, clientType: "GOVERNMENT" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid status", () => {
    const result = createClientSchema.safeParse({ ...validFields, status: "SOMEDAY" });
    expect(result.success).toBe(false);
  });

  it("accepts the Unassigned owner sentinel (normalized server-side)", () => {
    const result = createClientSchema.safeParse({ ...validFields, ownerId: UNASSIGNED_OWNER });
    expect(result.success).toBe(true);
  });
});

describe("updateClientSchema", () => {
  it("requires a clientId in addition to the base fields", () => {
    const result = updateClientSchema.safeParse(validFields);
    expect(result.success).toBe(false);
  });

  it("accepts a valid payload with clientId present", () => {
    const result = updateClientSchema.safeParse({ ...validFields, clientId: "some-id" });
    expect(result.success).toBe(true);
  });
});
