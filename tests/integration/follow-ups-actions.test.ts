import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestUser, seedRolesAndPermissions, truncateDynamicTables } from "../helpers/test-db";
import * as headerMocks from "../mocks/next-headers";

vi.mock("next/headers", () => import("../mocks/next-headers"));
vi.mock("next/cache", () => import("../mocks/next-cache"));

import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { ForbiddenError } from "@/lib/rbac/authorize";
import { UNASSIGNED_REP } from "@/lib/validation";
import { buildFollowUpWhere } from "@/lib/queries/follow-ups";
import {
  cancelFollowUpAction,
  completeFollowUpAction,
  createFollowUpAction,
  rescheduleFollowUpAction,
  updateFollowUpAction,
} from "@/lib/actions/follow-ups";
import { deleteLeadAction } from "@/lib/actions/leads";
import { utcToZonedInput } from "@/lib/timezone";

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

function baseFollowUpFields(leadId: string) {
  return {
    leadId,
    title: "Call back about the proposal",
    description: "They asked for pricing detail.",
    type: "CALL",
    dueAt: "2026-10-05T10:00",
    status: "PENDING",
    priority: "MEDIUM",
    assignedRepId: "",
  };
}

beforeAll(async () => {
  roleIds = await seedRolesAndPermissions();
}, 30_000);

afterEach(async () => {
  await truncateDynamicTables();
  headerMocks.__reset();
});

describe("createFollowUpAction", () => {
  it("a MANAGER (has leads.update) can schedule a follow-up against a real lead", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-a@test.local", password: "manager-password-1" });
    await signIn(manager.id);
    const lead = await makeLead();

    const result = await createFollowUpAction(undefined, form(baseFollowUpFields(lead.id)));
    expect(result?.success).toBeTruthy();

    const created = await db.followUp.findFirstOrThrow({ where: { leadId: lead.id } });
    expect(created.title).toBe("Call back about the proposal");
    expect(created.status).toBe("PENDING");
    expect(created.priority).toBe("MEDIUM");
    expect(created.createdById).toBe(manager.id);
    expect(created.completedAt).toBeNull();

    expect(await db.auditLog.count({ where: { action: "FOLLOWUP_CREATED" } })).toBe(1);
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "FOLLOWUP_CREATED" } });
    expect(audit.metadata).toMatchObject({ followUpId: created.id, leadId: lead.id });
  });

  it("an EMPLOYEE (has leads.update) can also schedule follow-ups", async () => {
    const employee = await createTestUser({ roleId: roleIds.EMPLOYEE, email: "employee-a@test.local", password: "employee-password-1" });
    await signIn(employee.id);
    const lead = await makeLead();

    const result = await createFollowUpAction(undefined, form(baseFollowUpFields(lead.id)));
    expect(result?.success).toBeTruthy();
    expect(await db.followUp.count()).toBe(1);
  });

  it("unauthorized: an INTERN (leads.view only) cannot schedule a follow-up", async () => {
    const intern = await createTestUser({ roleId: roleIds.INTERN, email: "intern-a@test.local", password: "intern-password-1" });
    await signIn(intern.id);
    const lead = await makeLead();

    await expect(createFollowUpAction(undefined, form(baseFollowUpFields(lead.id)))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(await db.followUp.count()).toBe(0);
  });

  it("rejects a follow-up whose lead doesn't exist (relationship validation)", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-b@test.local", password: "manager-password-2" });
    await signIn(manager.id);

    const result = await createFollowUpAction(
      undefined,
      form({ ...baseFollowUpFields("does-not-exist") }),
    );
    expect(result?.error).toMatch(/no longer exists/i);
    expect(await db.followUp.count()).toBe(0);
  });

  it("rejects a missing title and a missing due date", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-c@test.local", password: "manager-password-3" });
    await signIn(manager.id);
    const lead = await makeLead();

    expect((await createFollowUpAction(undefined, form({ ...baseFollowUpFields(lead.id), title: "" })))?.error).toMatch(
      /title is required/i,
    );
    expect((await createFollowUpAction(undefined, form({ ...baseFollowUpFields(lead.id), dueAt: "" })))?.error).toMatch(
      /due date is required/i,
    );
    expect(await db.followUp.count()).toBe(0);
  });

  it("rejects an assignedRepId that doesn't reference a real user", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-d@test.local", password: "manager-password-4" });
    await signIn(manager.id);
    const lead = await makeLead();

    const result = await createFollowUpAction(
      undefined,
      form({ ...baseFollowUpFields(lead.id), assignedRepId: "nope" }),
    );
    expect(result?.error).toMatch(/representative does not exist/i);
  });

  it("normalizes the Unassigned sentinel to a null rep", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-e@test.local", password: "manager-password-5" });
    await signIn(manager.id);
    const lead = await makeLead();

    await createFollowUpAction(undefined, form({ ...baseFollowUpFields(lead.id), assignedRepId: UNASSIGNED_REP }));
    expect((await db.followUp.findFirstOrThrow({ where: { leadId: lead.id } })).assignedRepId).toBeNull();
  });
});

describe("updateFollowUpAction", () => {
  it("edits fields and logs FOLLOWUP_UPDATED when status doesn't change", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-f@test.local", password: "manager-password-6" });
    await signIn(manager.id);
    const lead = await makeLead();
    const followUp = await db.followUp.create({
      data: { leadId: lead.id, title: "Old title", dueAt: new Date("2026-10-01T10:00:00Z") },
    });

    const result = await updateFollowUpAction(
      undefined,
      form({ ...baseFollowUpFields(lead.id), followUpId: followUp.id, title: "New title", priority: "HIGH" }),
    );
    expect(result?.success).toBeTruthy();

    const refreshed = await db.followUp.findUniqueOrThrow({ where: { id: followUp.id } });
    expect(refreshed.title).toBe("New title");
    expect(refreshed.priority).toBe("HIGH");
    expect(await db.auditLog.count({ where: { action: "FOLLOWUP_UPDATED" } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: "FOLLOWUP_COMPLETED" } })).toBe(0);
  });

  it("logs FOLLOWUP_COMPLETED and stamps completedAt when status flips to COMPLETED", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-g@test.local", password: "manager-password-7" });
    await signIn(manager.id);
    const lead = await makeLead();
    const followUp = await db.followUp.create({
      data: { leadId: lead.id, title: "Finish me", dueAt: new Date("2026-10-01T10:00:00Z") },
    });

    await updateFollowUpAction(
      undefined,
      form({ ...baseFollowUpFields(lead.id), followUpId: followUp.id, status: "COMPLETED" }),
    );

    const refreshed = await db.followUp.findUniqueOrThrow({ where: { id: followUp.id } });
    expect(refreshed.status).toBe("COMPLETED");
    expect(refreshed.completedAt).not.toBeNull();
    expect(await db.auditLog.count({ where: { action: "FOLLOWUP_COMPLETED" } })).toBe(1);
  });

  it("logs FOLLOWUP_CANCELLED when status flips to CANCELLED", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-h@test.local", password: "manager-password-8" });
    await signIn(manager.id);
    const lead = await makeLead();
    const followUp = await db.followUp.create({
      data: { leadId: lead.id, title: "Cancel me", dueAt: new Date("2026-10-01T10:00:00Z") },
    });

    await updateFollowUpAction(
      undefined,
      form({ ...baseFollowUpFields(lead.id), followUpId: followUp.id, status: "CANCELLED" }),
    );

    expect((await db.followUp.findUniqueOrThrow({ where: { id: followUp.id } })).status).toBe("CANCELLED");
    expect(await db.auditLog.count({ where: { action: "FOLLOWUP_CANCELLED" } })).toBe(1);
  });

  it("updating a nonexistent follow-up returns a friendly error", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-i@test.local", password: "manager-password-9" });
    await signIn(manager.id);
    const lead = await makeLead();

    const result = await updateFollowUpAction(
      undefined,
      form({ ...baseFollowUpFields(lead.id), followUpId: "does-not-exist" }),
    );
    expect(result?.error).toMatch(/not found/i);
  });

  it("unauthorized: an INTERN cannot edit a follow-up", async () => {
    const intern = await createTestUser({ roleId: roleIds.INTERN, email: "intern-b@test.local", password: "intern-password-2" });
    await signIn(intern.id);
    const lead = await makeLead();
    const followUp = await db.followUp.create({
      data: { leadId: lead.id, title: "Untouched", dueAt: new Date("2026-10-01T10:00:00Z") },
    });

    await expect(
      updateFollowUpAction(undefined, form({ ...baseFollowUpFields(lead.id), followUpId: followUp.id, title: "Hacked" })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect((await db.followUp.findUniqueOrThrow({ where: { id: followUp.id } })).title).toBe("Untouched");
  });
});

describe("completeFollowUpAction / cancelFollowUpAction / rescheduleFollowUpAction", () => {
  it("completeFollowUpAction marks done, stamps completedAt and audits once", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-j@test.local", password: "manager-password-10" });
    await signIn(manager.id);
    const lead = await makeLead();
    const followUp = await db.followUp.create({
      data: { leadId: lead.id, title: "Do it", dueAt: new Date("2026-10-01T10:00:00Z") },
    });

    await completeFollowUpAction(form({ followUpId: followUp.id }));

    const refreshed = await db.followUp.findUniqueOrThrow({ where: { id: followUp.id } });
    expect(refreshed.status).toBe("COMPLETED");
    expect(refreshed.completedAt).not.toBeNull();
    expect(await db.auditLog.count({ where: { action: "FOLLOWUP_COMPLETED" } })).toBe(1);

    // Completing again is a no-op and does not double-log.
    await completeFollowUpAction(form({ followUpId: followUp.id }));
    expect(await db.auditLog.count({ where: { action: "FOLLOWUP_COMPLETED" } })).toBe(1);
  });

  it("cancelFollowUpAction cancels without deleting the row", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-k@test.local", password: "manager-password-11" });
    await signIn(manager.id);
    const lead = await makeLead();
    const followUp = await db.followUp.create({
      data: { leadId: lead.id, title: "Drop it", dueAt: new Date("2026-10-01T10:00:00Z") },
    });

    await cancelFollowUpAction(form({ followUpId: followUp.id }));

    expect((await db.followUp.findUniqueOrThrow({ where: { id: followUp.id } })).status).toBe("CANCELLED");
    expect(await db.auditLog.count({ where: { action: "FOLLOWUP_CANCELLED" } })).toBe(1);
  });

  it("rescheduleFollowUpAction moves the due date and reopens a completed follow-up", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-l@test.local", password: "manager-password-12" });
    await signIn(manager.id);
    const lead = await makeLead();
    const followUp = await db.followUp.create({
      data: {
        leadId: lead.id,
        title: "Reopen me",
        dueAt: new Date("2026-10-01T10:00:00Z"),
        status: "COMPLETED",
        completedAt: new Date("2026-10-01T11:00:00Z"),
      },
    });

    await rescheduleFollowUpAction(form({ followUpId: followUp.id, dueAt: "2026-11-01T09:00" }));

    const refreshed = await db.followUp.findUniqueOrThrow({ where: { id: followUp.id } });
    expect(refreshed.status).toBe("PENDING");
    expect(refreshed.completedAt).toBeNull();
    expect(refreshed.dueAt.toISOString()).not.toBe(new Date("2026-10-01T10:00:00Z").toISOString());
    expect(await db.auditLog.count({ where: { action: "FOLLOWUP_UPDATED" } })).toBe(1);
  });

  it("rescheduleFollowUpAction rejects an invalid due date", async () => {
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "manager-m@test.local", password: "manager-password-13" });
    await signIn(manager.id);
    const lead = await makeLead();
    const followUp = await db.followUp.create({
      data: { leadId: lead.id, title: "Keep date", dueAt: new Date("2026-10-01T10:00:00Z") },
    });

    await expect(rescheduleFollowUpAction(form({ followUpId: followUp.id, dueAt: "not-a-date" }))).rejects.toThrow();
    expect((await db.followUp.findUniqueOrThrow({ where: { id: followUp.id } })).dueAt.toISOString()).toBe(
      new Date("2026-10-01T10:00:00Z").toISOString(),
    );
  });

  it("unauthorized: an INTERN cannot complete a follow-up", async () => {
    const intern = await createTestUser({ roleId: roleIds.INTERN, email: "intern-c@test.local", password: "intern-password-3" });
    await signIn(intern.id);
    const lead = await makeLead();
    const followUp = await db.followUp.create({
      data: { leadId: lead.id, title: "Stays pending", dueAt: new Date("2026-10-01T10:00:00Z") },
    });

    await expect(completeFollowUpAction(form({ followUpId: followUp.id }))).rejects.toBeInstanceOf(ForbiddenError);
    expect((await db.followUp.findUniqueOrThrow({ where: { id: followUp.id } })).status).toBe("PENDING");
  });
});

describe("follow-up views against real rows", () => {
  it("sorts each follow-up into the right bucket relative to a fixed 'now'", async () => {
    const lead = await makeLead();
    const now = new Date(2026, 8, 29, 15, 0, 0, 0);

    const dueEarlierToday = await db.followUp.create({
      data: { leadId: lead.id, title: "Earlier today", dueAt: new Date(2026, 8, 29, 9, 0) },
    });
    const dueLaterToday = await db.followUp.create({
      data: { leadId: lead.id, title: "Later today", dueAt: new Date(2026, 8, 29, 18, 0) },
    });
    const dueTomorrow = await db.followUp.create({
      data: { leadId: lead.id, title: "Tomorrow", dueAt: new Date(2026, 8, 30, 9, 0) },
    });
    const alreadyDone = await db.followUp.create({
      data: {
        leadId: lead.id,
        title: "Done",
        dueAt: new Date(2026, 8, 28, 9, 0),
        status: "COMPLETED",
        completedAt: new Date(2026, 8, 28, 10, 0),
      },
    });

    const idsFor = async (view: string) =>
      (await db.followUp.findMany({ where: buildFollowUpWhere({ view, now }), select: { id: true } })).map((f) => f.id);

    expect((await idsFor("today")).sort()).toEqual([dueEarlierToday.id, dueLaterToday.id].sort());
    expect(await idsFor("upcoming")).toEqual([dueTomorrow.id]);
    // Overdue deliberately includes the still-pending item from earlier today.
    expect(await idsFor("overdue")).toEqual([dueEarlierToday.id]);
    expect(await idsFor("completed")).toEqual([alreadyDone.id]);
    expect((await idsFor("all")).length).toBe(4);
  });
});

describe("lead deletion cascades to its follow-ups", () => {
  it("deleting a lead removes its follow-ups (they're owned children, not references)", async () => {
    const admin = await createTestUser({ roleId: roleIds.SUPER_ADMIN, email: "admin-a@test.local", password: "admin-password-1" });
    await signIn(admin.id);
    const lead = await makeLead("Doomed Lead");
    await db.followUp.create({ data: { leadId: lead.id, title: "Goes away too", dueAt: new Date("2026-10-01T10:00:00Z") } });

    await deleteLeadAction(form({ leadId: lead.id }));

    expect(await db.lead.findUnique({ where: { id: lead.id } })).toBeNull();
    expect(await db.followUp.count()).toBe(0);
  });
});

describe("timezone handling (regression: 14:30 India shown as 05:00 in New York)", () => {
  const INDIA_INSTANT = "2026-10-05T09:00:00.000Z"; // 14:30 Asia/Kolkata

  afterEach(() => {
    delete process.env.TZ;
  });

  // Run the same scenario with the *server* in several zones: the stored
  // instant must never depend on where the server happens to run.
  it.each(["UTC", "Asia/Kolkata", "America/New_York", "Pacific/Auckland"])(
    "create in India, open and re-save from New York without edits keeps the same instant (server in %s)",
    async (serverZone) => {
      process.env.TZ = serverZone;
      const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "tz-manager@test.local", password: "manager-password-tz" });
      await signIn(manager.id);
      const lead = await makeLead();

      // Scenario A: scheduled 14:30 by a browser in India.
      await createFollowUpAction(
        undefined,
        form({ ...baseFollowUpFields(lead.id), dueAt: "2026-10-05T14:30", timeZone: "Asia/Kolkata" }),
      );
      const created = await db.followUp.findFirstOrThrow({ where: { leadId: lead.id } });
      expect(created.dueAt.toISOString()).toBe(INDIA_INSTANT);
      expect(utcToZonedInput(created.dueAt, "Asia/Kolkata")).toBe("2026-10-05T14:30");

      // Scenario B: a New York browser sees 05:00 and saves it untouched.
      const shownInNewYork = utcToZonedInput(created.dueAt, "America/New_York");
      expect(shownInNewYork).toBe("2026-10-05T05:00");
      await updateFollowUpAction(
        undefined,
        form({
          ...baseFollowUpFields(lead.id),
          followUpId: created.id,
          dueAt: shownInNewYork,
          timeZone: "America/New_York",
        }),
      );
      expect((await db.followUp.findUniqueOrThrow({ where: { id: created.id } })).dueAt.toISOString()).toBe(
        INDIA_INSTANT,
      );

      // Reschedule quick action honours the submitter's zone too.
      await rescheduleFollowUpAction(
        form({ followUpId: created.id, dueAt: shownInNewYork, timeZone: "America/New_York" }),
      );
      expect((await db.followUp.findUniqueOrThrow({ where: { id: created.id } })).dueAt.toISOString()).toBe(
        INDIA_INSTANT,
      );

      await truncateDynamicTables();
      headerMocks.__reset();
    },
  );

  it("a submission with no timezone is read as UTC, not the server's zone", async () => {
    process.env.TZ = "Asia/Kolkata";
    const manager = await createTestUser({ roleId: roleIds.MANAGER, email: "tz-manager2@test.local", password: "manager-password-tz2" });
    await signIn(manager.id);
    const lead = await makeLead();
    await createFollowUpAction(undefined, form({ ...baseFollowUpFields(lead.id), dueAt: "2026-10-05T10:00" }));
    const created = await db.followUp.findFirstOrThrow({ where: { leadId: lead.id } });
    expect(created.dueAt.toISOString()).toBe("2026-10-05T10:00:00.000Z");
  });
});
