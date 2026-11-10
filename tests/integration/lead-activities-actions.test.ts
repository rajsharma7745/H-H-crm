import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestUser, seedRolesAndPermissions, truncateDynamicTables } from "../helpers/test-db";
import * as headerMocks from "../mocks/next-headers";

vi.mock("next/headers", () => import("../mocks/next-headers"));
vi.mock("next/cache", () => import("../mocks/next-cache"));

import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { ForbiddenError } from "@/lib/rbac/authorize";
import { createLeadActivityAction, updateLeadActivityAction } from "@/lib/actions/lead-activities";
import { assignLeadAction, deleteLeadAction } from "@/lib/actions/leads";
import { buildLeadTimeline } from "@/lib/queries/lead-timeline";

let roleIds: Record<string, string>;

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

async function signIn(userId: string) {
  await createSession(userId, false);
}

async function makeLead(name = "Jordan Lee") {
  return db.lead.create({ data: { name, pipeline: "ADS", stage: "COLD" } });
}

function baseActivityFields(leadId: string) {
  return {
    leadId,
    type: "CALL",
    title: "Spoke about pricing",
    description: "Wants a phased rollout.",
    activityAt: "2026-09-20T10:00",
  };
}

beforeAll(async () => {
  roleIds = await seedRolesAndPermissions();
}, 30_000);

afterEach(async () => {
  await truncateDynamicTables();
  headerMocks.__reset();
});

describe("createLeadActivityAction", () => {
  it("a MANAGER can log an activity against a lead, with themselves as author", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-a@test.local", password: "manager-password-1" });
    await signIn(manager.id);
    const lead = await makeLead();

    const result = await createLeadActivityAction(undefined, form(baseActivityFields(lead.id)));
    expect(result?.success).toBeTruthy();

    const created = await db.leadActivity.findFirstOrThrow({ where: { leadId: lead.id } });
    expect(created.type).toBe("CALL");
    expect(created.title).toBe("Spoke about pricing");
    expect(created.createdById).toBe(manager.id);
    expect(await db.auditLog.count({ where: { action: "LEAD_ACTIVITY_CREATED" } })).toBe(1);
  });

  it("an EMPLOYEE (has leads.update) can log activities", async () => {
    const employee = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "employee-a@test.local", password: "employee-password-1" });
    await signIn(employee.id);
    const lead = await makeLead();

    expect((await createLeadActivityAction(undefined, form(baseActivityFields(lead.id))))?.success).toBeTruthy();
  });

  it("unauthorized: an INTERN (leads.view only) cannot log an activity", async () => {
    const intern = await createTestUser({ roleId: roleIds.INTERN, email: "intern-a@test.local", password: "intern-password-1" });
    await signIn(intern.id);
    const lead = await makeLead();

    await expect(createLeadActivityAction(undefined, form(baseActivityFields(lead.id)))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(await db.leadActivity.count()).toBe(0);
  });

  it("rejects an activity against a lead that doesn't exist", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-b@test.local", password: "manager-password-2" });
    await signIn(manager.id);

    const result = await createLeadActivityAction(undefined, form(baseActivityFields("nope")));
    expect(result?.error).toMatch(/no longer exists/i);
    expect(await db.leadActivity.count()).toBe(0);
  });

  it("rejects a missing title, a missing date and an invalid date", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-c@test.local", password: "manager-password-3" });
    await signIn(manager.id);
    const lead = await makeLead();

    expect(
      (await createLeadActivityAction(undefined, form({ ...baseActivityFields(lead.id), title: "" })))?.error,
    ).toMatch(/title is required/i);
    expect(
      (await createLeadActivityAction(undefined, form({ ...baseActivityFields(lead.id), activityAt: "" })))?.error,
    ).toMatch(/activity date is required/i);
    expect(
      (await createLeadActivityAction(undefined, form({ ...baseActivityFields(lead.id), activityAt: "nonsense" })))
        ?.error,
    ).toMatch(/valid activity date/i);
    expect(await db.leadActivity.count()).toBe(0);
  });
});

describe("updateLeadActivityAction", () => {
  it("edits an existing activity and audits the change", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-d@test.local", password: "manager-password-4" });
    await signIn(manager.id);
    const lead = await makeLead();
    const activity = await db.leadActivity.create({
      data: { leadId: lead.id, title: "Old", type: "NOTE", activityAt: new Date("2026-09-01T10:00:00Z") },
    });

    const result = await updateLeadActivityAction(
      undefined,
      form({ ...baseActivityFields(lead.id), activityId: activity.id, title: "New", type: "MEETING" }),
    );
    expect(result?.success).toBeTruthy();

    const refreshed = await db.leadActivity.findUniqueOrThrow({ where: { id: activity.id } });
    expect(refreshed.title).toBe("New");
    expect(refreshed.type).toBe("MEETING");
    expect(await db.auditLog.count({ where: { action: "LEAD_ACTIVITY_UPDATED" } })).toBe(1);
  });

  it("updating a nonexistent activity returns a friendly error", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-e@test.local", password: "manager-password-5" });
    await signIn(manager.id);
    const lead = await makeLead();

    const result = await updateLeadActivityAction(
      undefined,
      form({ ...baseActivityFields(lead.id), activityId: "nope" }),
    );
    expect(result?.error).toMatch(/not found/i);
  });

  it("unauthorized: an INTERN cannot edit an activity", async () => {
    const intern = await createTestUser({ roleId: roleIds.INTERN, email: "intern-b@test.local", password: "intern-password-2" });
    await signIn(intern.id);
    const lead = await makeLead();
    const activity = await db.leadActivity.create({
      data: { leadId: lead.id, title: "Untouched", type: "NOTE", activityAt: new Date("2026-09-01T10:00:00Z") },
    });

    await expect(
      updateLeadActivityAction(undefined, form({ ...baseActivityFields(lead.id), activityId: activity.id })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect((await db.leadActivity.findUniqueOrThrow({ where: { id: activity.id } })).title).toBe("Untouched");
  });
});

describe("assignLeadAction (lead detail quick action)", () => {
  it("assigns a rep and logs LEAD_ASSIGNED", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-f@test.local", password: "manager-password-6" });
    const rep = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "rep-a@test.local", password: "rep-password-1" });
    await signIn(manager.id);
    const lead = await makeLead();

    await assignLeadAction(form({ leadId: lead.id, assignedRepId: rep.id }));

    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).assignedRepId).toBe(rep.id);
    expect(await db.auditLog.count({ where: { action: "LEAD_ASSIGNED" } })).toBe(1);
  });

  it("is a no-op when the rep is unchanged", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-g@test.local", password: "manager-password-7" });
    const rep = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "rep-b@test.local", password: "rep-password-2" });
    await signIn(manager.id);
    const lead = await db.lead.create({
      data: { name: "Already assigned", pipeline: "ADS", stage: "COLD", assignedRepId: rep.id },
    });

    await assignLeadAction(form({ leadId: lead.id, assignedRepId: rep.id }));
    expect(await db.auditLog.count({ where: { action: "LEAD_ASSIGNED" } })).toBe(0);
  });

  it("rejects a rep that doesn't exist", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-h@test.local", password: "manager-password-8" });
    await signIn(manager.id);
    const lead = await makeLead();

    await expect(assignLeadAction(form({ leadId: lead.id, assignedRepId: "ghost" }))).rejects.toThrow(
      /does not exist/i,
    );
  });

  it("unauthorized: an INTERN cannot reassign a lead", async () => {
    const intern = await createTestUser({ roleId: roleIds.INTERN, email: "intern-c@test.local", password: "intern-password-3" });
    await signIn(intern.id);
    const lead = await makeLead();

    await expect(assignLeadAction(form({ leadId: lead.id, assignedRepId: "" }))).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("the lead timeline against real rows", () => {
  it("merges real activities, audit events and follow-ups into one newest-first story", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-i@test.local", password: "manager-password-9" });
    await signIn(manager.id);
    const lead = await makeLead();

    await createLeadActivityAction(
      undefined,
      form({ ...baseActivityFields(lead.id), title: "Called them", activityAt: "2026-09-20T10:00" }),
    );
    await db.followUp.create({
      data: { leadId: lead.id, title: "Call back", dueAt: new Date("2026-10-05T09:00:00Z") },
    });

    const [activities, auditEvents, followUps] = await Promise.all([
      db.leadActivity.findMany({
        where: { leadId: lead.id },
        include: { createdBy: { select: { firstName: true, lastName: true } } },
      }),
      db.auditLog.findMany({
        where: {
          action: { in: ["LEAD_CREATED", "LEAD_UPDATED", "LEAD_STAGE_CHANGED", "LEAD_ASSIGNED"] },
          metadata: { path: ["leadId"], equals: lead.id },
        },
        include: { actor: { select: { firstName: true, lastName: true } } },
      }),
      db.followUp.findMany({
        where: { leadId: lead.id },
        include: { assignedRep: { select: { id: true, firstName: true, lastName: true } } },
      }),
    ]);

    const timeline = buildLeadTimeline({ activities, auditEvents, followUps, repNameById: new Map() });

    // The follow-up is due latest, so it leads; the activity follows.
    expect(timeline[0]?.tag).toBe("Follow-up due");
    expect(timeline.some((e) => e.kind === "activity" && e.label === "Called them")).toBe(true);
    // LEAD_ACTIVITY_CREATED stays in the audit log and out of this timeline.
    expect(timeline.some((e) => e.tag === "Created")).toBe(false);
  });
});

describe("lead deletion cascades to its activities", () => {
  it("deleting a lead removes its activities too", async () => {
    const admin = await createTestUser({ roleId: roleIds.SUPER_ADMIN, email: "admin-a@test.local", password: "admin-password-1" });
    await signIn(admin.id);
    const lead = await makeLead("Doomed");
    await db.leadActivity.create({
      data: { leadId: lead.id, title: "Goes away", type: "NOTE", activityAt: new Date() },
    });

    await deleteLeadAction(form({ leadId: lead.id }));

    expect(await db.lead.findUnique({ where: { id: lead.id } })).toBeNull();
    expect(await db.leadActivity.count()).toBe(0);
  });
});
