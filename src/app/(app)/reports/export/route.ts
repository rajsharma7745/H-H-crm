import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { userHasPermission } from "@/lib/rbac/authorize";
import { toCsv } from "@/lib/csv";
import { resolveDateRange, createdAtWhere } from "@/lib/queries/date-range";
import { parseLeadPipelineFilter } from "@/lib/queries/leads";
import { PIPELINE_LABEL, STAGE_LABEL } from "@/app/(app)/leads/lead-stage-badge";

/** Presentation only — the stored enum values are unchanged. */
const OUTCOME_LABEL = { WON: "Won", LOST: "Lost" } as const;

/**
 * CSV export of the leads behind the current report view.
 *
 * A route handler can't redirect a file download to /login usefully, so this
 * returns 401/403 status codes instead of using requirePermission()'s
 * redirect — but it performs exactly the same check, server-side, before
 * touching any data.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!userHasPermission(user, "reports.view")) return new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const range = resolveDateRange(
    {
      range: url.searchParams.get("range") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    },
    new Date(),
  );
  const pipeline = parseLeadPipelineFilter(url.searchParams.get("pipeline") ?? undefined);
  const assignedRepId = url.searchParams.get("assignedRep") ?? undefined;

  const leads = await db.lead.findMany({
    where: {
      ...createdAtWhere(range),
      ...(pipeline ? { pipeline } : {}),
      ...(assignedRepId ? { assignedRepId } : {}),
    },
    include: { assignedRep: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  });

  const csv = toCsv(leads, [
    { header: "Lead name", value: (lead) => lead.name },
    { header: "Company", value: (lead) => lead.companyName },
    { header: "Email", value: (lead) => lead.email },
    { header: "Phone", value: (lead) => lead.phone },
    { header: "Pipeline", value: (lead) => PIPELINE_LABEL[lead.pipeline] },
    { header: "Stage", value: (lead) => STAGE_LABEL[lead.stage] },
    { header: "Source", value: (lead) => lead.source },
    { header: "Campaign", value: (lead) => lead.campaignName },
    { header: "Ad creative", value: (lead) => lead.adCreative },
    {
      header: "Assigned rep",
      value: (lead) => (lead.assignedRep ? `${lead.assignedRep.firstName} ${lead.assignedRep.lastName}` : ""),
    },
    { header: "Interest level", value: (lead) => lead.interestLevel },
    { header: "Closing probability (%)", value: (lead) => lead.closingProbability },
    { header: "Proposal amount", value: (lead) => lead.proposalAmount ? Number(lead.proposalAmount).toFixed(2) : "" },
    { header: "Proposal sent", value: (lead) => lead.proposalSentAt },
    { header: "Expected closure", value: (lead) => lead.expectedCloseAt },
    { header: "Outcome", value: (lead) => (lead.outcome ? OUTCOME_LABEL[lead.outcome] : "") },
    { header: "Created", value: (lead) => lead.createdAt },
    { header: "Last updated", value: (lead) => lead.updatedAt },
  ]);

  const filename = `hh-leads-${range.key}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // An export is a point-in-time snapshot; never let it be cached.
      "Cache-Control": "no-store",
    },
  });
}
