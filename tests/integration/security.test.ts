import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestUser, seedRolesAndPermissions, truncateDynamicTables } from "../helpers/test-db";
import * as headerMocks from "../mocks/next-headers";

vi.mock("next/headers", () => import("../mocks/next-headers"));
vi.mock("next/cache", () => import("../mocks/next-cache"));

import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { ForbiddenError, UnauthenticatedError } from "@/lib/rbac/authorize";
import {
  createLeadAction,
  deleteLeadAction,
  moveLeadStageAction,
  updateLeadAction,
  assignLeadAction,
} from "@/lib/actions/leads";
import { createFollowUpAction, completeFollowUpAction } from "@/lib/actions/follow-ups";
import { createLeadActivityAction } from "@/lib/actions/lead-activities";
import { GET as exportLeadsCsv } from "@/app/(app)/reports/export/route";

/**
 * Cross-module security suite. Every check here calls a server action or route
 * handler DIRECTLY — no UI involved — because hiding a button is not a
 * security boundary and the brief's acceptance criterion is specifically that
 * a user can't get through by calling the API themselves.
 */

let roleIds: Record<string, string>;

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

async function signIn(userId: string) {
  await createSession(userId, false);
}

const LEAD_FIELDS = {
  name: "Target Lead",
  companyName: "",
  email: "",
  phone: "",
  pipeline: "ADS",
  stage: "COLD",
  source: "",
  notes: "",
  assignedRepId: "",
  campaignName: "",
  adCreative: "",
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

describe("no session at all", () => {
  it("every lead write rejects an unauthenticated caller", async () => {
    const lead = await db.lead.create({ data: { name: "Untouchable", pipeline: "ADS", stage: "COLD" } });

    await expect(createLeadAction(undefined, form(LEAD_FIELDS))).rejects.toBeInstanceOf(UnauthenticatedError);
    await expect(
      updateLeadAction(undefined, form({ ...LEAD_FIELDS, leadId: lead.id })),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
    await expect(moveLeadStageAction(form({ leadId: lead.id, stage: "HOT" }))).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    await expect(assignLeadAction(form({ leadId: lead.id, assignedRepId: "" }))).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    await expect(deleteLeadAction(form({ leadId: lead.id }))).rejects.toBeInstanceOf(UnauthenticatedError);

    // Nothing changed.
    const after = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(after.stage).toBe("COLD");
    expect(await db.lead.count()).toBe(1);
  });

  it("follow-up and activity writes reject an unauthenticated caller", async () => {
    const lead = await db.lead.create({ data: { name: "Untouchable", pipeline: "ADS", stage: "COLD" } });
    const followUp = await db.followUp.create({
      data: { leadId: lead.id, title: "Stays pending", dueAt: new Date("2026-10-01T10:00:00Z") },
    });

    await expect(
      createFollowUpAction(
        undefined,
        form({ leadId: lead.id, title: "x", description: "", type: "CALL", dueAt: "2026-10-01T10:00", status: "PENDING", priority: "LOW", assignedRepId: "" }),
      ),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
    await expect(completeFollowUpAction(form({ followUpId: followUp.id }))).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    await expect(
      createLeadActivityAction(
        undefined,
        form({ leadId: lead.id, type: "NOTE", title: "x", description: "", activityAt: "2026-09-20T10:00" }),
      ),
    ).rejects.toBeInstanceOf(UnauthenticatedError);

    expect((await db.followUp.findUniqueOrThrow({ where: { id: followUp.id } })).status).toBe("PENDING");
    expect(await db.leadActivity.count()).toBe(0);
  });

  it("the CSV export returns 401 rather than data", async () => {
    const response = await exportLeadsCsv(new Request("http://localhost/reports/export"));
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain("Lead name");
  });
});

describe("under-privileged sessions (direct action calls)", () => {
  it("an INTERN (leads.view only) is blocked from every lead write", async () => {
    const intern = await createTestUser({ roleId: roleIds.INTERN, email: "intern@test.local", password: "intern-password-1" });
    await signIn(intern.id);
    const lead = await db.lead.create({ data: { name: "Read only", pipeline: "ADS", stage: "COLD" } });

    await expect(createLeadAction(undefined, form(LEAD_FIELDS))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateLeadAction(undefined, form({ ...LEAD_FIELDS, leadId: lead.id }))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(moveLeadStageAction(form({ leadId: lead.id, stage: "HOT" }))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteLeadAction(form({ leadId: lead.id }))).rejects.toBeInstanceOf(ForbiddenError);

    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).stage).toBe("COLD");
  });

  it("an EMPLOYEE can edit but cannot create or delete leads", async () => {
    const employee = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "employee@test.local", password: "employee-password-1" });
    await signIn(employee.id);
    const lead = await db.lead.create({ data: { name: "Editable", pipeline: "ADS", stage: "COLD" } });

    await expect(createLeadAction(undefined, form(LEAD_FIELDS))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteLeadAction(form({ leadId: lead.id }))).rejects.toBeInstanceOf(ForbiddenError);

    // ...but the edit it *is* allowed to do still works.
    await moveLeadStageAction(form({ leadId: lead.id, stage: "WARM" }));
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).stage).toBe("WARM");
  });

  it("a MANAGER without reports.view still gets its CSV export blocked (INTERN case)", async () => {
    const intern = await createTestUser({ roleId: roleIds.INTERN, email: "intern2@test.local", password: "intern-password-2" });
    await signIn(intern.id);

    const response = await exportLeadsCsv(new Request("http://localhost/reports/export"));
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("Lead name");
  });

  it("an EMPLOYEE (has reports.view) can export, and the CSV has a header row", async () => {
    const employee = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "employee2@test.local", password: "employee-password-2" });
    await signIn(employee.id);
    await db.lead.create({ data: { name: "Exportable", pipeline: "ADS", stage: "COLD" } });

    const response = await exportLeadsCsv(new Request("http://localhost/reports/export?range=all"));
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Lead name");
    expect(body).toContain("Exportable");
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
  });

  it("exports readable stage, pipeline, outcome and amount values instead of raw enums", async () => {
    const employee = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "employee3@test.local", password: "employee-password-3" });
    await signIn(employee.id);
    await db.lead.create({
      data: { name: "Readable", pipeline: "WARM_APPROACH", stage: "PROPOSAL_SENT", outcome: "WON", proposalAmount: "2500.5" },
    });

    const body = await (await exportLeadsCsv(new Request("http://localhost/reports/export?range=all"))).text();
    expect(body).toContain("Warm Approach");
    expect(body).toContain("Proposal Sent");
    expect(body).toContain("Won");
    expect(body).toContain("2500.50");
    expect(body).not.toMatch(/WARM_APPROACH|PROPOSAL_SENT/);
  });
});

describe("invalid ids and references", () => {
  it("actions on nonexistent ids fail safely instead of throwing raw database errors", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager@test.local", password: "manager-password-1" });
    await signIn(manager.id);

    expect((await updateLeadAction(undefined, form({ ...LEAD_FIELDS, leadId: "nope" })))?.error).toMatch(/not found/i);
    await expect(moveLeadStageAction(form({ leadId: "nope", stage: "HOT" }))).rejects.toThrow(/not found/i);
    await expect(assignLeadAction(form({ leadId: "nope", assignedRepId: "" }))).rejects.toThrow(/not found/i);
    // Deleting something that's already gone is a silent no-op, not a crash.
    await expect(deleteLeadAction(form({ leadId: "nope" }))).resolves.toBeUndefined();
  });

  it("a lead cannot be assigned to a user id that doesn't exist", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager2@test.local", password: "manager-password-2" });
    await signIn(manager.id);
    const lead = await db.lead.create({ data: { name: "Assignable", pipeline: "ADS", stage: "COLD" } });

    expect(
      (await createLeadAction(undefined, form({ ...LEAD_FIELDS, assignedRepId: "ghost-user" })))?.error,
    ).toMatch(/does not exist/i);
    await expect(assignLeadAction(form({ leadId: lead.id, assignedRepId: "ghost-user" }))).rejects.toThrow(
      /does not exist/i,
    );
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).assignedRepId).toBeNull();
  });

  it("a follow-up cannot be attached to a lead that doesn't exist", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager3@test.local", password: "manager-password-3" });
    await signIn(manager.id);

    const result = await createFollowUpAction(
      undefined,
      form({
        leadId: "ghost-lead",
        title: "Orphan",
        description: "",
        type: "CALL",
        dueAt: "2026-10-01T10:00",
        status: "PENDING",
        priority: "LOW",
        assignedRepId: "",
      }),
    );
    expect(result?.error).toMatch(/no longer exists/i);
    expect(await db.followUp.count()).toBe(0);
  });
});

describe("cross-pipeline stage manipulation", () => {
  it("cannot be smuggled in through create, update, or the Kanban move action", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager4@test.local", password: "manager-password-4" });
    await signIn(manager.id);

    // Create: Ads pipeline with a Warm Approach stage.
    expect(
      (await createLeadAction(undefined, form({ ...LEAD_FIELDS, pipeline: "ADS", stage: "PROPOSAL_SENT" })))?.error,
    ).toBeTruthy();
    expect(await db.lead.count()).toBe(0);

    // Create: Warm Approach pipeline with an Ads stage.
    expect(
      (await createLeadAction(undefined, form({ ...LEAD_FIELDS, pipeline: "WARM_APPROACH", stage: "HOT" })))?.error,
    ).toBeTruthy();
    expect(await db.lead.count()).toBe(0);

    const adsLead = await db.lead.create({ data: { name: "Ads lead", pipeline: "ADS", stage: "COLD" } });
    const waLead = await db.lead.create({
      data: { name: "WA lead", pipeline: "WARM_APPROACH", stage: "PLAN_MEET" },
    });

    // Update: same rule on the edit path.
    expect(
      (await updateLeadAction(undefined, form({ ...LEAD_FIELDS, leadId: adsLead.id, stage: "PITCHED" })))?.error,
    ).toBeTruthy();

    // Kanban move: rejected against the lead's own pipeline, not the payload's.
    await expect(moveLeadStageAction(form({ leadId: adsLead.id, stage: "PITCHED" }))).rejects.toThrow(
      /doesn't belong/i,
    );
    await expect(moveLeadStageAction(form({ leadId: waLead.id, stage: "COLD" }))).rejects.toThrow(/doesn't belong/i);

    expect((await db.lead.findUniqueOrThrow({ where: { id: adsLead.id } })).stage).toBe("COLD");
    expect((await db.lead.findUniqueOrThrow({ where: { id: waLead.id } })).stage).toBe("PLAN_MEET");
  });

  it("a garbage stage value is rejected outright", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager5@test.local", password: "manager-password-5" });
    await signIn(manager.id);
    const lead = await db.lead.create({ data: { name: "Solid", pipeline: "ADS", stage: "COLD" } });

    expect((await createLeadAction(undefined, form({ ...LEAD_FIELDS, stage: "NOT_A_STAGE" })))?.error).toBeTruthy();
    await expect(moveLeadStageAction(form({ leadId: lead.id, stage: "NOT_A_STAGE" }))).rejects.toThrow();
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).stage).toBe("COLD");
  });
});

describe("audit trail integrity", () => {
  it("a rejected write leaves no audit entry behind", async () => {
    const intern = await createTestUser({ roleId: roleIds.INTERN, email: "intern3@test.local", password: "intern-password-3" });
    await signIn(intern.id);
    const lead = await db.lead.create({ data: { name: "Guarded", pipeline: "ADS", stage: "COLD" } });

    await expect(moveLeadStageAction(form({ leadId: lead.id, stage: "HOT" }))).rejects.toBeInstanceOf(ForbiddenError);

    expect(await db.auditLog.count({ where: { action: "LEAD_STAGE_CHANGED" } })).toBe(0);
  });

  it("never records a raw password or session token in audit metadata", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager6@test.local", password: "super-secret-password-1" });
    await signIn(manager.id);

    await createLeadAction(undefined, form(LEAD_FIELDS));

    const entries = await db.auditLog.findMany();
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      const serialized = JSON.stringify(entry.metadata ?? {});
      expect(serialized).not.toContain("super-secret-password-1");
      expect(serialized.toLowerCase()).not.toContain("passwordhash");
      expect(serialized.toLowerCase()).not.toContain("tokenhash");
    }
  });
});
