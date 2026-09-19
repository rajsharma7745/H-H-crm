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
