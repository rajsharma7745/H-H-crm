import { describe, expect, it } from "vitest";
import { buildLeadTimeline } from "@/lib/queries/lead-timeline";

const REP_NAMES = new Map([["user-1", "Ada Lovelace"]]);

function at(day: number, hour = 12): Date {
  return new Date(2026, 8, day, hour, 0, 0, 0);
}

describe("buildLeadTimeline", () => {
  it("returns an empty timeline when there is nothing to show", () => {
    expect(buildLeadTimeline({ activities: [], auditEvents: [], followUps: [], repNameById: REP_NAMES })).toEqual([]);
  });

  it("includes user-authored activities with their type as the tag and author as actor", () => {
    const timeline = buildLeadTimeline({
      activities: [
        {
          id: "a1",
          type: "CALL",
          title: "Spoke about budget",
          description: "They want a phased rollout.",
          activityAt: at(10),
          createdBy: { firstName: "Grace", lastName: "Hopper" },
        },
      ],
      auditEvents: [],
      followUps: [],
      repNameById: REP_NAMES,
    });

    expect(timeline).toHaveLength(1);
    expect(timeline[0]).toMatchObject({
      kind: "activity",
      tag: "Call",
      label: "Spoke about budget",
      detail: "They want a phased rollout.",
      actorName: "Grace Hopper",
    });
  });

  it("describes stage changes and assignments from audit metadata", () => {
    const timeline = buildLeadTimeline({
      activities: [],
      auditEvents: [
        {
          id: "e1",
          action: "LEAD_STAGE_CHANGED",
          metadata: { fromStage: "COLD", toStage: "HOT" },
          createdAt: at(11),
          actor: { firstName: "Alan", lastName: "Turing" },
        },
        {
          id: "e2",
          action: "LEAD_ASSIGNED",
          metadata: { toRepId: "user-1" },
          createdAt: at(12),
          actor: { firstName: "Alan", lastName: "Turing" },
        },
        {
          id: "e3",
          action: "LEAD_ASSIGNED",
          metadata: { toRepId: null },
          createdAt: at(13),
          actor: null,
        },
      ],
      followUps: [],
      repNameById: REP_NAMES,
    });

    const labels = timeline.map((entry) => entry.label);
    expect(labels).toContain("moved this lead from Cold to Hot");
    expect(labels).toContain("assigned this lead to Ada Lovelace");
    expect(labels).toContain("unassigned this lead");
  });

  it("falls back to a generic name when the assignment target is an unknown user", () => {
    const timeline = buildLeadTimeline({
      activities: [],
      auditEvents: [
        {
          id: "e1",
          action: "LEAD_ASSIGNED",
          metadata: { toRepId: "user-gone" },
          createdAt: at(11),
          actor: null,
        },
      ],
      followUps: [],
      repNameById: REP_NAMES,
    });

    expect(timeline[0]?.label).toBe("assigned this lead to a team member");
  });

  it("ignores audit actions that belong to the security log rather than the lead's story", () => {
    const timeline = buildLeadTimeline({
      activities: [],
      auditEvents: [
        { id: "e1", action: "LOGIN_SUCCESS", metadata: {}, createdAt: at(11), actor: null },
        { id: "e2", action: "FOLLOWUP_COMPLETED", metadata: {}, createdAt: at(12), actor: null },
        { id: "e3", action: "LEAD_ACTIVITY_CREATED", metadata: {}, createdAt: at(13), actor: null },
      ],
      followUps: [],
      repNameById: REP_NAMES,
    });

    expect(timeline).toEqual([]);
  });

  it("dates a pending follow-up by its due date and a completed one by its completion time", () => {
    const timeline = buildLeadTimeline({
      activities: [],
      auditEvents: [],
      followUps: [
        {
          id: "f1",
          title: "Call back",
          status: "PENDING",
          dueAt: at(20),
          completedAt: null,
          createdAt: at(10),
          assignedRep: { firstName: "Ada", lastName: "Lovelace" },
        },
        {
          id: "f2",
          title: "Send deck",
          status: "COMPLETED",
          dueAt: at(12),
          completedAt: at(13),
          createdAt: at(10),
          assignedRep: null,
        },
      ],
      repNameById: REP_NAMES,
    });

    const pending = timeline.find((e) => e.id === "follow-up-f1")!;
    const done = timeline.find((e) => e.id === "follow-up-f2")!;
    expect(pending.at).toEqual(at(20));
    expect(pending.tag).toBe("Follow-up due");
    expect(done.at).toEqual(at(13));
    expect(done.tag).toBe("Follow-up done");
  });

  it("merges all three sources into one newest-first ordering", () => {
    const timeline = buildLeadTimeline({
      activities: [
        { id: "a1", type: "NOTE", title: "Oldest note", description: null, activityAt: at(1), createdBy: null },
      ],
      auditEvents: [
        {
          id: "e1",
          action: "LEAD_CREATED",
          metadata: {},
          createdAt: at(2),
          actor: null,
        },
      ],
      followUps: [
        {
          id: "f1",
          title: "Newest follow-up",
          status: "PENDING",
          dueAt: at(3),
          completedAt: null,
          createdAt: at(1),
          assignedRep: null,
        },
      ],
      repNameById: REP_NAMES,
    });

    expect(timeline.map((e) => e.id)).toEqual(["follow-up-f1", "system-e1", "activity-a1"]);
  });

  it("breaks ties deterministically so repeated renders agree", () => {
    const sameMoment = at(5);
    const first = buildLeadTimeline({
      activities: [
        { id: "b", type: "NOTE", title: "B", description: null, activityAt: sameMoment, createdBy: null },
        { id: "a", type: "NOTE", title: "A", description: null, activityAt: sameMoment, createdBy: null },
      ],
      auditEvents: [],
      followUps: [],
      repNameById: REP_NAMES,
    });
    const second = buildLeadTimeline({
      activities: [
        { id: "a", type: "NOTE", title: "A", description: null, activityAt: sameMoment, createdBy: null },
        { id: "b", type: "NOTE", title: "B", description: null, activityAt: sameMoment, createdBy: null },
      ],
      auditEvents: [],
      followUps: [],
      repNameById: REP_NAMES,
    });

    expect(first.map((e) => e.id)).toEqual(second.map((e) => e.id));
  });
});
