import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters.")
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9^$*.[\]{}()?"!@#%&/\\,><':;|_~`+=-]/.test(v), {
    message: "Password must include a letter and a number or symbol.",
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
  rememberMe: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(100),
  lastName: z.string().trim().min(1, "Last name is required.").max(100),
  jobTitle: z.string().trim().max(150).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});

export const createUserSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(100),
  lastName: z.string().trim().min(1, "Last name is required.").max(100),
  email: emailSchema,
  roleId: z.string().min(1, "Role is required."),
  jobTitle: z.string().trim().max(150).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  temporaryPassword: passwordSchema,
});

export const updateUserSchema = z.object({
  userId: z.string().min(1),
  firstName: z.string().trim().min(1, "First name is required.").max(100),
  lastName: z.string().trim().min(1, "Last name is required.").max(100),
  roleId: z.string().min(1, "Role is required."),
  jobTitle: z.string().trim().max(150).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});

// ---------------------------------------------------------------------------
// Clients (Phase 3)
// ---------------------------------------------------------------------------

const optionalPhoneSchema = z
  .string()
  .trim()
  .max(30)
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || /^[0-9+\-()\s]{7,30}$/.test(v), {
    message: "Enter a valid phone number.",
  });

const optionalEmailSchema = z.union([z.literal(""), emailSchema]).optional();

const optionalWebsiteSchema = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v), {
    message: "Enter a valid website URL, starting with http:// or https://.",
  });

/** Sentinel value the client form's owner <Select> submits for "no owner
 * selected" — Base UI Select items can't carry an empty-string value, so the
 * server action normalizes this back to `null` before writing to the DB. */
export const UNASSIGNED_OWNER = "__unassigned__";

const clientTypeSchema = z.enum(["B2B", "B2C"], { message: "Select a client type." });
const clientStatusSchema = z.enum(["PROSPECT", "ACTIVE", "PAUSED", "CHURNED"], {
  message: "Select a status.",
});

const clientBaseFields = {
  name: z.string().trim().min(1, "Client name is required.").max(200),
  clientType: clientTypeSchema,
  status: clientStatusSchema,
  primaryContactName: z.string().trim().max(150).optional().or(z.literal("")),
  primaryContactEmail: optionalEmailSchema,
  primaryContactPhone: optionalPhoneSchema,
  website: optionalWebsiteSchema,
  industry: z.string().trim().max(100).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
  ownerId: z.string().trim().optional().or(z.literal("")),
};

export const createClientSchema = z.object(clientBaseFields);

export const updateClientSchema = z.object({
  clientId: z.string().min(1),
  ...clientBaseFields,
});

// ---------------------------------------------------------------------------
// Leads (Phase 1)
// ---------------------------------------------------------------------------

/** Sentinel value the lead form's "Assigned representative" <Select> submits
 * for "no rep selected" — same Base-UI-Select constraint UNASSIGNED_OWNER
 * works around, kept as its own constant since it belongs to a different
 * field on a different model. */
export const UNASSIGNED_REP = "__unassigned__";

export const leadPipelineSchema = z.enum(["ADS", "WARM_APPROACH"], {
  message: "Select a pipeline.",
});

export const leadStageSchema = z.enum(["COLD", "WARM", "HOT", "PLAN_MEET", "PITCHED", "PROPOSAL_SENT"], {
  message: "Select a stage.",
});

/** Which LeadStage values are valid for which pipeline. The database's
 * LeadStage enum accepts all six; this is the pipeline-aware half of that
 * validation — a lead can never be saved with a stage from the other
 * pipeline. */
export const STAGES_BY_PIPELINE = {
  ADS: ["COLD", "WARM", "HOT"],
  WARM_APPROACH: ["PLAN_MEET", "PITCHED", "PROPOSAL_SENT"],
} as const;

const optionalDateStringSchema = z
  .string()
  .trim()
  .max(40)
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || !Number.isNaN(Date.parse(v)), { message: "Enter a valid date." });

const optionalPercentSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || (/^\d{1,3}$/.test(v) && Number(v) <= 100), {
    message: "Enter a probability between 0 and 100.",
  });

const optionalMoneySchema = z
  .string()
  .trim()
  .max(20)
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || /^\d+(\.\d{1,2})?$/.test(v), { message: "Enter a valid amount." });

const leadOutcomeSchema = z.union([z.literal(""), z.enum(["WON", "LOST"])]).optional();

const leadBaseFields = {
  name: z.string().trim().min(1, "Lead name is required.").max(200),
  companyName: z.string().trim().max(200).optional().or(z.literal("")),
  email: optionalEmailSchema,
  phone: optionalPhoneSchema,
  pipeline: leadPipelineSchema,
  stage: leadStageSchema,
  source: z.string().trim().max(150).optional().or(z.literal("")),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
  assignedRepId: z.string().trim().optional().or(z.literal("")),

  // Ads-specific
  campaignName: z.string().trim().max(200).optional().or(z.literal("")),
  adCreative: z.string().trim().max(200).optional().or(z.literal("")),
  submittedAt: optionalDateStringSchema,
  initialContactStatus: z.string().trim().max(150).optional().or(z.literal("")),
  interestLevel: z.string().trim().max(150).optional().or(z.literal("")),
  qualificationNotes: z.string().trim().max(5000).optional().or(z.literal("")),
  lastContactedAt: optionalDateStringSchema,
  immediateRequirement: z.string().trim().max(500).optional().or(z.literal("")),
  closingProbability: optionalPercentSchema,
  meetingScheduled: z.boolean().optional().default(false),

  // Warm Approach-specific
  lastInteractionAt: optionalDateStringSchema,
  scheduledMeetingAt: optionalDateStringSchema,
  followUpNotes: z.string().trim().max(5000).optional().or(z.literal("")),
  pitchedAt: optionalDateStringSchema,
  serviceDiscussed: z.string().trim().max(300).optional().or(z.literal("")),
  feedback: z.string().trim().max(5000).optional().or(z.literal("")),
  nextAction: z.string().trim().max(500).optional().or(z.literal("")),
  proposalAmount: optionalMoneySchema,
  proposalDocUrl: optionalWebsiteSchema,
  proposalSentAt: optionalDateStringSchema,
  expectedCloseAt: optionalDateStringSchema,
  outcome: leadOutcomeSchema,
};

/** Cross-field check shared by create/update: a lead's stage must belong to
 * its own pipeline (a Warm Approach lead can never be "Hot", an Ads lead can
 * never be "Pitched"). */
function refineStageMatchesPipeline<T extends { pipeline: string; stage: string }>(data: T, ctx: z.RefinementCtx) {
  const validStages = STAGES_BY_PIPELINE[data.pipeline as keyof typeof STAGES_BY_PIPELINE];
  if (validStages && !(validStages as readonly string[]).includes(data.stage)) {
    ctx.addIssue({
      code: "custom",
      path: ["stage"],
      message: "This stage doesn't belong to the selected pipeline.",
    });
  }
}

export const createLeadSchema = z.object(leadBaseFields).superRefine(refineStageMatchesPipeline);

export const updateLeadSchema = z
  .object({ leadId: z.string().min(1), ...leadBaseFields })
  .superRefine(refineStageMatchesPipeline);

// ---------------------------------------------------------------------------
// Follow-ups (Phase 4)
// ---------------------------------------------------------------------------

/** A follow-up always has a due date — an undated follow-up can't be "due
 * today", "upcoming" or "overdue", which is the module's whole point. The
 * same shape covers an activity's "when did this happen" date. */
function requiredDateString(label: string) {
  return z
    .string()
    .trim()
    .min(1, `A ${label} is required.`)
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: `Enter a valid ${label}.` });
}

export const followUpTypeSchema = z.enum(["CALL", "EMAIL", "MEETING", "MESSAGE", "OTHER"], {
  message: "Select a follow-up type.",
});

export const followUpStatusSchema = z.enum(["PENDING", "COMPLETED", "CANCELLED"], {
  message: "Select a status.",
});

export const followUpPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"], {
  message: "Select a priority.",
});

const followUpBaseFields = {
  leadId: z.string().trim().min(1, "A follow-up must belong to a lead."),
  title: z.string().trim().min(1, "A title is required.").max(200),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  type: followUpTypeSchema,
  dueAt: requiredDateString("due date"),
  status: followUpStatusSchema,
  priority: followUpPrioritySchema,
  assignedRepId: z.string().trim().optional().or(z.literal("")),
};

export const createFollowUpSchema = z.object(followUpBaseFields);

export const updateFollowUpSchema = z.object({
  followUpId: z.string().min(1),
  ...followUpBaseFields,
});

/** Reschedule is its own narrow shape — the row action only sends a new due
 * date, not the whole follow-up. */
export const rescheduleFollowUpSchema = z.object({
  followUpId: z.string().min(1),
  dueAt: requiredDateString("due date"),
});

// ---------------------------------------------------------------------------
// Lead activities (Phase 5)
// ---------------------------------------------------------------------------

export const leadActivityTypeSchema = z.enum(["NOTE", "CALL", "MEETING", "EMAIL", "OTHER"], {
  message: "Select an activity type.",
});

const leadActivityBaseFields = {
  leadId: z.string().trim().min(1, "An activity must belong to a lead."),
  type: leadActivityTypeSchema,
  title: z.string().trim().min(1, "A title is required.").max(200),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  activityAt: requiredDateString("activity date"),
};

export const createLeadActivitySchema = z.object(leadActivityBaseFields);

export const updateLeadActivitySchema = z.object({
  activityId: z.string().min(1),
  ...leadActivityBaseFields,
});
