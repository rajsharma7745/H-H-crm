import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestUser, seedRolesAndPermissions, truncateDynamicTables } from "../helpers/test-db";
import * as headerMocks from "../mocks/next-headers";

vi.mock("next/headers", () => import("../mocks/next-headers"));
vi.mock("next/cache", () => import("../mocks/next-cache"));

import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { ForbiddenError } from "@/lib/rbac/authorize";
import { UNASSIGNED_REP } from "@/lib/validation";
import { buildLeadWhere } from "@/lib/queries/leads";
import { createLeadAction, deleteLeadAction, moveLeadStageAction, updateLeadAction } from "@/lib/actions/leads";

let roleIds: Record<string, string>;

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

async function signIn(userId: string) {
  await createSession(userId, false);
}

const BASE_ADS_LEAD_FIELDS = {
  name: "Jordan Lee",
  companyName: "Lee Fitness",
  email: "jordan@leefitness.com",
  phone: "555-0100",
  pipeline: "ADS",
  stage: "COLD",
  source: "Meta Ads",
  notes: "Submitted a lead form after seeing the carousel ad.",
  assignedRepId: "",
  campaignName: "Fall Promo",
  adCreative: "carousel-01",
  submittedAt: "",
  initialContactStatus: "",
  interestLevel: "",
  qualificationNotes: "",
  lastContactedAt: "",
  immediateRequirement: "",
  closingProbability: "",
  meetingScheduled: "",
  lastInteractionAt: "",
  scheduledMeetingAt: "",
  followUpNotes: "",
  pitchedAt: "",
  serviceDiscussed: "",
  feedback: "",
  nextAction: "",
  proposalAmount: "",
  proposalDocUrl: "",
  proposalSentAt: "",
  expectedCloseAt: "",
  outcome: "",
};

beforeAll(async () => {
  roleIds = await seedRolesAndPermissions();
}, 30_000);

afterEach(async () => {
  await truncateDynamicTables();
  headerMocks.__reset();
});

describe("createLeadAction", () => {
  it("a MANAGER (has leads.create) can create a new Ads lead", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-a@test.local", password: "manager-password-1" });
    await signIn(manager.id);

    const result = await createLeadAction(undefined, form(BASE_ADS_LEAD_FIELDS));
    expect(result?.success).toBeTruthy();

    const created = await db.lead.findFirst({ where: { name: "Jordan Lee" } });
    expect(created).not.toBeNull();
    expect(created?.pipeline).toBe("ADS");
    expect(created?.stage).toBe("COLD");
    expect(created?.createdById).toBe(manager.id);
    expect(await db.auditLog.count({ where: { action: "LEAD_CREATED" } })).toBe(1);

    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "LEAD_CREATED" } });
    expect(audit.actorId).toBe(manager.id);
    expect((audit.metadata as { leadId?: string })?.leadId).toBe(created!.id);
  });

  it("creates a lead from the fields the real form sends (the other pipeline's inputs are absent, not empty)", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-real@test.local", password: "manager-password-r" });
    await signIn(manager.id);

    // The Ads form has no Warm-only inputs, so a browser never posts them and
    // FormData.get() returns null for them — unlike form(BASE_ADS_LEAD_FIELDS).
    const result = await createLeadAction(
      undefined,
      form({ name: "Browser Lead", pipeline: "ADS", stage: "COLD", assignedRepId: UNASSIGNED_REP, campaignName: "Spring" }),
    );
    expect(result?.error).toBeUndefined();
    expect(result?.success).toBeTruthy();
    expect(await db.lead.count({ where: { name: "Browser Lead" } })).toBe(1);
  });

  it("an EMPLOYEE (has leads.view + leads.update only, not leads.create) is rejected", async () => {
    const employee = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "employee-a@test.local", password: "employee-password-1" });
    await signIn(employee.id);

    await expect(createLeadAction(undefined, form(BASE_ADS_LEAD_FIELDS))).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db.lead.count()).toBe(0);
  });

  it("unauthorized: an INTERN (view only) is rejected", async () => {
    const intern = await createTestUser({ roleId: roleIds.INTERN, email: "intern-a@test.local", password: "intern-password-1" });
    await signIn(intern.id);

    await expect(createLeadAction(undefined, form(BASE_ADS_LEAD_FIELDS))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects a missing lead name (server-side validation, not just UI)", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-b@test.local", password: "manager-password-2" });
    await signIn(manager.id);

    const result = await createLeadAction(undefined, form({ ...BASE_ADS_LEAD_FIELDS, name: "" }));
    expect(result?.error).toMatch(/name is required/i);
    expect(await db.lead.count()).toBe(0);
  });

  it("rejects an Ads-pipeline lead given a Warm Approach stage (pipeline-aware validation, enforced server-side)", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-c@test.local", password: "manager-password-3" });
    await signIn(manager.id);

    const result = await createLeadAction(undefined, form({ ...BASE_ADS_LEAD_FIELDS, pipeline: "ADS", stage: "PITCHED" }));
    expect(result?.error).toBeTruthy();
    expect(await db.lead.count()).toBe(0);
  });

  it("normalizes the Unassigned rep sentinel to a null assignedRepId", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-d@test.local", password: "manager-password-4" });
    await signIn(manager.id);

    const result = await createLeadAction(undefined, form({ ...BASE_ADS_LEAD_FIELDS, assignedRepId: UNASSIGNED_REP }));
    expect(result?.success).toBeTruthy();

    const created = await db.lead.findFirstOrThrow({ where: { name: "Jordan Lee" } });
    expect(created.assignedRepId).toBeNull();
  });

  it("assigns a real rep when a valid user id is given", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-e@test.local", password: "manager-password-5" });
    const futureRep = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "rep-a@test.local", password: "rep-password-1" });
    await signIn(manager.id);

    const result = await createLeadAction(undefined, form({ ...BASE_ADS_LEAD_FIELDS, assignedRepId: futureRep.id }));
    expect(result?.success).toBeTruthy();

    const created = await db.lead.findFirstOrThrow({ where: { name: "Jordan Lee" } });
    expect(created.assignedRepId).toBe(futureRep.id);
  });

  it("rejects an assignedRepId that doesn't reference a real user", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-f@test.local", password: "manager-password-6" });
    await signIn(manager.id);

    const result = await createLeadAction(undefined, form({ ...BASE_ADS_LEAD_FIELDS, assignedRepId: "does-not-exist" }));
    expect(result?.error).toMatch(/representative does not exist/i);
    expect(await db.lead.count()).toBe(0);
  });

  it("creates a Warm Approach lead with its own fields (proposal amount, expected closure, outcome)", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-g@test.local", password: "manager-password-7" });
    await signIn(manager.id);

    const result = await createLeadAction(
      undefined,
      form({
        ...BASE_ADS_LEAD_FIELDS,
        pipeline: "WARM_APPROACH",
        stage: "PROPOSAL_SENT",
        proposalAmount: "4500.00",
        expectedCloseAt: "2026-12-01",
        outcome: "WON",
      }),
    );
    expect(result?.success).toBeTruthy();

    const created = await db.lead.findFirstOrThrow({ where: { name: "Jordan Lee" } });
    expect(created.pipeline).toBe("WARM_APPROACH");
    expect(created.stage).toBe("PROPOSAL_SENT");
    expect(created.proposalAmount?.toString()).toBe("4500");
    expect(created.outcome).toBe("WON");
  });
});

describe("updateLeadAction", () => {
  it("a MANAGER (has leads.update) can edit a lead's ordinary fields and logs LEAD_UPDATED", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-h@test.local", password: "manager-password-8" });
    await signIn(manager.id);
    const lead = await db.lead.create({ data: { name: "Old Name", pipeline: "ADS", stage: "COLD" } });

    const result = await updateLeadAction(
      undefined,
      form({ ...BASE_ADS_LEAD_FIELDS, leadId: lead.id, name: "New Name", stage: "COLD" }),
    );
    expect(result?.success).toBeTruthy();

    const refreshed = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(refreshed.name).toBe("New Name");
    expect(await db.auditLog.count({ where: { action: "LEAD_UPDATED" } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: "LEAD_STAGE_CHANGED" } })).toBe(0);
    expect(await db.auditLog.count({ where: { action: "LEAD_ASSIGNED" } })).toBe(0);
  });

  it("an EMPLOYEE (has leads.update) can move a lead's stage within its own pipeline, and logs LEAD_STAGE_CHANGED (not a generic LEAD_UPDATED)", async () => {
    const employee = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "employee-b@test.local", password: "employee-password-2" });
    await signIn(employee.id);
    const lead = await db.lead.create({ data: { name: "Move Me", pipeline: "ADS", stage: "COLD" } });

    const result = await updateLeadAction(undefined, form({ ...BASE_ADS_LEAD_FIELDS, leadId: lead.id, stage: "HOT" }));
    expect(result?.success).toBeTruthy();

    const refreshed = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(refreshed.stage).toBe("HOT");

    expect(await db.auditLog.count({ where: { action: "LEAD_STAGE_CHANGED" } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: "LEAD_UPDATED" } })).toBe(0);

    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "LEAD_STAGE_CHANGED" } });
    expect(audit.metadata).toMatchObject({ leadId: lead.id, fromStage: "COLD", toStage: "HOT" });
  });

  it("reassigning a lead logs LEAD_ASSIGNED (leads.assign is not a separate permission — leads.update covers it)", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-i@test.local", password: "manager-password-9" });
    const rep = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "rep-b@test.local", password: "rep-password-2" });
    await signIn(manager.id);
    const lead = await db.lead.create({ data: { name: "Assign Me", pipeline: "ADS", stage: "COLD" } });

    const result = await updateLeadAction(
      undefined,
      form({ ...BASE_ADS_LEAD_FIELDS, leadId: lead.id, stage: "COLD", assignedRepId: rep.id }),
    );
    expect(result?.success).toBeTruthy();

    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).assignedRepId).toBe(rep.id);
    expect(await db.auditLog.count({ where: { action: "LEAD_ASSIGNED" } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: "LEAD_UPDATED" } })).toBe(0);

    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "LEAD_ASSIGNED" } });
    expect(audit.metadata).toMatchObject({ leadId: lead.id, fromRepId: null, toRepId: rep.id });
  });

  it("a save that changes both stage and rep logs both LEAD_STAGE_CHANGED and LEAD_ASSIGNED", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-j@test.local", password: "manager-password-10" });
    const rep = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "rep-c@test.local", password: "rep-password-3" });
    await signIn(manager.id);
    const lead = await db.lead.create({ data: { name: "Both Change", pipeline: "ADS", stage: "COLD" } });

    await updateLeadAction(undefined, form({ ...BASE_ADS_LEAD_FIELDS, leadId: lead.id, stage: "WARM", assignedRepId: rep.id }));

    expect(await db.auditLog.count({ where: { action: "LEAD_STAGE_CHANGED" } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: "LEAD_ASSIGNED" } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: "LEAD_UPDATED" } })).toBe(0);
  });

  it("unauthorized: a user without leads.update (INTERN) is rejected", async () => {
    const intern = await createTestUser({ roleId: roleIds.INTERN, email: "intern-b@test.local", password: "intern-password-2" });
    await signIn(intern.id);
    const lead = await db.lead.create({ data: { name: "Untouched", pipeline: "ADS", stage: "COLD" } });

    await expect(
      updateLeadAction(undefined, form({ ...BASE_ADS_LEAD_FIELDS, leadId: lead.id })),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).name).toBe("Untouched");
  });

  it("updating a nonexistent lead returns a friendly error instead of throwing", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-k@test.local", password: "manager-password-11" });
    await signIn(manager.id);

    const result = await updateLeadAction(undefined, form({ ...BASE_ADS_LEAD_FIELDS, leadId: "does-not-exist" }));
    expect(result?.error).toMatch(/not found/i);
  });

  it("rejects moving a lead to a stage from the other pipeline", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-l@test.local", password: "manager-password-12" });
    await signIn(manager.id);
    const lead = await db.lead.create({ data: { name: "Stay Put", pipeline: "ADS", stage: "COLD" } });

    const result = await updateLeadAction(undefined, form({ ...BASE_ADS_LEAD_FIELDS, leadId: lead.id, stage: "PROPOSAL_SENT" }));
    expect(result?.error).toBeTruthy();
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).stage).toBe("COLD");
  });
});

describe("deleteLeadAction", () => {
  it("a SUPER_ADMIN (has leads.delete) can permanently delete a lead and logs LEAD_DELETED with a snapshot", async () => {
    const admin = await createTestUser({ roleId: roleIds.SUPER_ADMIN, email: "admin-a@test.local", password: "admin-password-1" });
    await signIn(admin.id);
    const lead = await db.lead.create({ data: { name: "Delete Me", pipeline: "ADS", stage: "HOT" } });

    await deleteLeadAction(form({ leadId: lead.id }));

    expect(await db.lead.findUnique({ where: { id: lead.id } })).toBeNull();
    expect(await db.auditLog.count({ where: { action: "LEAD_DELETED" } })).toBe(1);

    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "LEAD_DELETED" } });
    expect(audit.actorId).toBe(admin.id);
    expect(audit.metadata).toMatchObject({ leadId: lead.id, name: "Delete Me", pipeline: "ADS", stage: "HOT" });
  });

  it("unauthorized: an EMPLOYEE (leads.view + leads.update only, per ROLE_PERMISSION_DEFAULTS — not leads.delete) cannot delete a lead", async () => {
    const employee = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "employee-c@test.local", password: "employee-password-3" });
    await signIn(employee.id);
    const lead = await db.lead.create({ data: { name: "Stays Alive", pipeline: "ADS", stage: "HOT" } });

    await expect(deleteLeadAction(form({ leadId: lead.id }))).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db.lead.findUnique({ where: { id: lead.id } })).not.toBeNull();
  });
});

describe("moveLeadStageAction (the Kanban board's dropdown-move fallback)", () => {
  it("an EMPLOYEE (has leads.update) can move a lead within its own pipeline and logs LEAD_STAGE_CHANGED", async () => {
    const employee = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "employee-d@test.local", password: "employee-password-4" });
    await signIn(employee.id);
    const lead = await db.lead.create({ data: { name: "Kanban Move", pipeline: "ADS", stage: "COLD" } });

    await moveLeadStageAction(form({ leadId: lead.id, stage: "WARM" }));

    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).stage).toBe("WARM");
    expect(await db.auditLog.count({ where: { action: "LEAD_STAGE_CHANGED" } })).toBe(1);
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "LEAD_STAGE_CHANGED" } });
    expect(audit.metadata).toMatchObject({ leadId: lead.id, fromStage: "COLD", toStage: "WARM" });
  });

  it("rejects moving a lead to a stage from the other pipeline", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-n2@test.local", password: "manager-password-15" });
    await signIn(manager.id);
    const lead = await db.lead.create({ data: { name: "Cross Pipeline", pipeline: "ADS", stage: "COLD" } });

    await expect(moveLeadStageAction(form({ leadId: lead.id, stage: "PITCHED" }))).rejects.toThrow(/doesn't belong/i);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).stage).toBe("COLD");
  });

  it("is a no-op (no audit event) when the target stage equals the current stage", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-o@test.local", password: "manager-password-16" });
    await signIn(manager.id);
    const lead = await db.lead.create({ data: { name: "Already There", pipeline: "ADS", stage: "HOT" } });

    await moveLeadStageAction(form({ leadId: lead.id, stage: "HOT" }));

    expect(await db.auditLog.count({ where: { action: "LEAD_STAGE_CHANGED" } })).toBe(0);
  });

  it("unauthorized: an INTERN (view only) cannot move a lead's stage", async () => {
    const intern = await createTestUser({ roleId: roleIds.INTERN, email: "intern-c@test.local", password: "intern-password-3" });
    await signIn(intern.id);
    const lead = await db.lead.create({ data: { name: "Stays Put", pipeline: "ADS", stage: "COLD" } });

    await expect(moveLeadStageAction(form({ leadId: lead.id, stage: "HOT" }))).rejects.toBeInstanceOf(ForbiddenError);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).stage).toBe("COLD");
  });
});

describe("search and filters (buildLeadWhere against real rows)", () => {
  it("filters real leads by pipeline, stage, source and assigned rep together", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-n@test.local", password: "manager-password-14" });
    const rep = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "rep-d@test.local", password: "rep-password-4" });

    await db.lead.create({ data: { name: "Match Me", pipeline: "ADS", stage: "HOT", source: "Meta Ads", assignedRepId: rep.id } });
    await db.lead.create({ data: { name: "Wrong Stage", pipeline: "ADS", stage: "COLD", source: "Meta Ads", assignedRepId: rep.id } });
    await db.lead.create({ data: { name: "Wrong Pipeline", pipeline: "WARM_APPROACH", stage: "PITCHED", source: "Meta Ads", assignedRepId: rep.id } });
    await db.lead.create({ data: { name: "Unrelated", pipeline: "ADS", stage: "HOT" } });

    const where = buildLeadWhere({ pipeline: "ADS", stage: "HOT", source: "Meta Ads", assignedRep: rep.id });
    const matches = await db.lead.findMany({ where });

    expect(matches).toHaveLength(1);
    expect(matches[0]?.name).toBe("Match Me");
    void manager;
  });

  it("search by name/company/email/phone finds a lead by any of those fields", async () => {
    await db.lead.create({
      data: { name: "Searchable Lead", companyName: "Findable Co", email: "find@me.com", phone: "555-9999", pipeline: "ADS", stage: "COLD" },
    });

    for (const q of ["Searchable", "Findable", "find@me", "555-9999"]) {
      const matches = await db.lead.findMany({ where: buildLeadWhere({ q }) });
      expect(matches, `expected a match searching for "${q}"`).toHaveLength(1);
    }
  });
});
