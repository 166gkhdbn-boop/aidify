/**
 * Base zod primitives and shared auth schemas (brief §WAVE PLAN interface).
 *
 * Feature agents: EXTEND this file for new schemas, but keep the names and
 * semantics of existing exports stable — other waves depend on them.
 */

import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Base primitives                                                     */
/* ------------------------------------------------------------------ */

/** Short human-readable name: letters, numbers, spaces, dashes, underscores. */
export const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(120, "Name must be 120 characters or fewer")
  .regex(
    /^[\p{L}\p{N} _'-]+$/u,
    "Name contains invalid characters",
  );

/** URL-safe slug: lowercase letters, numbers, single dashes. */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Slug is required")
  .max(80, "Slug must be 80 characters or fewer")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase, use dashes");

/** Optional longer free-text field. */
export const descriptionSchema = z
  .string()
  .trim()
  .max(2000, "Description must be 2000 characters or fewer")
  .optional();

/** UUID string. */
export const uuidSchema = z.string().uuid("Invalid identifier");

/** Non-negative integer used for pagination limits. */
export const pageSizeSchema = z.coerce.number().int().min(1).max(100);

/** 1-based page number. */
export const pageSchema = z.coerce.number().int().min(1);

/* ------------------------------------------------------------------ */
/* Auth schemas                                                        */
/* ------------------------------------------------------------------ */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .max(254, "Email is too long")
  .email("Enter a valid email address");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be 128 characters or fewer");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
    displayName: nameSchema.max(80, "Display name must be 80 characters or fewer"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/* ------------------------------------------------------------------ */
/* Shared form helpers                                                 */
/* ------------------------------------------------------------------ */

/**
 * Format the first zod issue of each field for react-hook-form's
 * `setError` / manual error rendering: { field: message }.
 */
export function zodIssuesToFieldErrors(
  error: z.ZodError,
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_form";
    if (!(path in fieldErrors)) {
      fieldErrors[path] = issue.message;
    }
  }
  return fieldErrors;
}

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/* ------------------------------------------------------------------ */
/* Aidify domain schemas (configs, collections, tags, projects, admin)  */
/* Services layer (wave 2G). Existing exports above are unchanged.      */
/* ------------------------------------------------------------------ */

/** Config type enum (matches DB check constraint). */
export const configTypeSchema = z.enum([
  "application",
  "api-endpoints",
  "feature-flags",
  "integration",
  "web-profile",
  "environment",
  "custom-json",
]);

/** Environment enum (matches DB check constraint). */
export const environmentSchema = z.enum([
  "development",
  "staging",
  "production",
  "custom",
]);

/** Config status enum (matches DB check constraint). */
export const configStatusSchema = z.enum(["active", "archived", "draft"]);

/** Config names allow up to 200 chars (DB check); same charset as nameSchema. */
export const configNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(200, "Name must be 200 characters or fewer")
  .regex(
    /^[\p{L}\p{N} _'-]+$/u,
    "Name contains invalid characters",
  );

/** Arbitrary JSON object payload, size-capped to keep rows sane. */
export const jsonDataSchema = z
  .record(z.string(), z.unknown())
  .refine((data) => JSON.stringify(data).length <= 500_000, {
    message: "Configuration data must be 500 KB or smaller",
  });

/** ISO date-time string (zod-version-proof: validated via Date.parse). */
export const dateTimeSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid date/time",
  });

export const nullableDateTimeSchema = dateTimeSchema.nullable().optional();

export const notesSchema = z
  .string()
  .trim()
  .max(5000, "Notes must be 5000 characters or fewer")
  .nullable()
  .optional();

/* ------------------------- configurations ------------------------- */

export const createConfigSchema = z.object({
  name: configNameSchema,
  description: descriptionSchema,
  config_type: configTypeSchema,
  environment: environmentSchema,
  project_id: uuidSchema.nullable().optional(),
  collection_id: uuidSchema.nullable().optional(),
  data: jsonDataSchema.default({}),
  status: configStatusSchema.default("draft"),
  expires_at: nullableDateTimeSchema,
  notes: notesSchema,
  tag_ids: z.array(uuidSchema).max(50).optional(),
});

export const updateConfigSchema = createConfigSchema.partial().extend({
  change_summary: z
    .string()
    .trim()
    .max(500, "Change summary must be 500 characters or fewer")
    .optional(),
});

export const expectedVersionSchema = z.coerce
  .number()
  .int("Version must be an integer")
  .min(1, "Version must be at least 1");

export const configSortSchema = z.enum([
  "newest",
  "oldest",
  "name",
  "name_desc",
  "updated",
]);

export const listConfigsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: configStatusSchema.optional(),
  type: configTypeSchema.optional(),
  environment: environmentSchema.optional(),
  collectionId: uuidSchema.optional(),
  tag: z.string().trim().max(60).optional(),
  sort: configSortSchema.default("newest"),
  page: pageSchema.default(1),
  pageSize: pageSizeSchema.default(20),
});

export const uuidArraySchema = z.array(uuidSchema).min(1).max(100);

export const importConflictSchema = z.enum(["rename", "skip", "replace"]);

/* ------------------------- collections ---------------------------- */

export const collectionSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  project_id: uuidSchema.nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value like #438BFF")
    .nullable()
    .optional(),
  icon: z.string().trim().max(40).nullable().optional(),
});

export const updateCollectionSchema = collectionSchema.partial();

/* --------------------------- projects ----------------------------- */

export const projectSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
});

export const updateProjectSchema = projectSchema.partial();

/* ----------------------------- tags ------------------------------- */

export const tagSchema = z.object({
  name: z.string().trim().min(1, "Tag name is required").max(60),
});

/* ------------------------- misc list query ------------------------ */

export const listQuerySchema = z.object({
  page: pageSchema.default(1),
  pageSize: pageSizeSchema.default(20),
  search: z.string().trim().max(120).optional(),
});

/* ------------------------- announcements -------------------------- */

export const announcementSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  body: z.string().trim().min(1, "Body is required").max(10000),
  audience: z.enum(["all", "users", "admins"]).default("all"),
  published: z.boolean().default(false),
});

export const updateAnnouncementSchema = announcementSchema.partial();

/* ---------------------------- support ----------------------------- */

export const ticketSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required").max(200),
  description: z.string().trim().max(10000).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
});

export const ticketReplySchema = z.object({
  body: z.string().trim().min(1, "Reply body is required").max(10000),
});

export const ticketStatusSchema = z.enum([
  "open",
  "in_progress",
  "resolved",
  "closed",
]);

/* ---------------------------- profile ----------------------------- */

/** Matches the DB check: ^[a-zA-Z0-9_.-]{3,32}$ */
export const usernameSchema = z
  .string()
  .trim()
  .regex(
    /^[a-zA-Z0-9_.-]{3,32}$/,
    "Username must be 3-32 characters: letters, numbers, _, . or -",
  );

export const profileUpdateSchema = z.object({
  display_name: z.string().trim().max(80).nullable().optional(),
  username: usernameSchema.optional(),
  avatar_url: z.string().trim().max(2048).nullable().optional(),
});

/* ------------------------- system settings ------------------------ */

export const systemSettingsPatchSchema = z
  .object({
    site_name: z.string().trim().min(1).max(120).optional(),
    registration_open: z.boolean().optional(),
    maintenance_mode: z.boolean().optional(),
    support_email: z
      .string()
      .trim()
      .max(254)
      .refine(
        (value) =>
          value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        { message: "Support email is not a valid email address" },
      )
      .optional(),
    max_configs_per_user: z.number().int().min(1).max(100000).optional(),
    announcement_banner: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

/* ------------------------- notifications -------------------------- */

export const notificationSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  body: z.string().trim().max(2000).nullable().optional(),
  link: z
    .string()
    .trim()
    .max(2048)
    .refine(
      (value) =>
        value === "" || value.startsWith("/") || value.startsWith("https://"),
      { message: "Link must be a relative path or an https URL" },
    )
    .nullable()
    .optional(),
});

/* ------------------------- date-range query ----------------------- */

export const dateRangeSchema = z
  .object({
    from: dateTimeSchema,
    to: dateTimeSchema,
  })
  .refine((range) => Date.parse(range.from) <= Date.parse(range.to), {
    message: "The start of the range must be before its end",
  })
  .refine(
    (range) =>
      Date.parse(range.to) - Date.parse(range.from) <= 366 * 86400_000,
    { message: "Date range must be 366 days or shorter" },
  );

/* ------------------------------ types ----------------------------- */

export type CreateConfigInput = z.infer<typeof createConfigSchema>;
export type UpdateConfigInput = z.infer<typeof updateConfigSchema>;
export type ListConfigsQuery = z.infer<typeof listConfigsQuerySchema>;
export type CollectionInput = z.infer<typeof collectionSchema>;
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type TagInput = z.infer<typeof tagSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
export type AnnouncementInput = z.infer<typeof announcementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
export type TicketInput = z.infer<typeof ticketSchema>;
export type TicketReplyInput = z.infer<typeof ticketReplySchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type SystemSettingsPatch = z.infer<typeof systemSettingsPatchSchema>;
export type NotificationInput = z.infer<typeof notificationSchema>;
export type DateRangeInput = z.infer<typeof dateRangeSchema>;
export type ImportConflictMode = z.infer<typeof importConflictSchema>;

/* ------------------------ user preferences ------------------------ */

/**
 * Per-user settings persisted in `profiles.preferences` (JSONB).
 * Stored values are parsed defensively (`.catch`): a corrupted row falls
 * back to defaults rather than breaking the settings page.
 */
export const userPreferencesSchema = z.object({
  emailNotifications: z.boolean().catch(true),
  defaultPageSize: z.union([z.literal(10), z.literal(20), z.literal(50)]).catch(20),
  defaultEnvironment: environmentSchema.catch("development"),
  maskSecrets: z.boolean().catch(true),
});

export const userPreferencesPatchSchema = z
  .object({
    emailNotifications: z.boolean().optional(),
    defaultPageSize: z.union([z.literal(10), z.literal(20), z.literal(50)]).optional(),
    defaultEnvironment: environmentSchema.optional(),
    maskSecrets: z.boolean().optional(),
  })
  .strict();

export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type UserPreferencesPatch = z.infer<typeof userPreferencesPatchSchema>;

/* ------------------------------------------------------------------ */
/* Proxy users (panel_users)                                            */
/* ------------------------------------------------------------------ */

/** Data limit in gigabytes as entered in the UI. */
const dataLimitGbSchema = z
  .number()
  .positive("Data limit must be positive")
  .max(1_000_000, "Data limit is too large");

export const createProxyUserSchema = z.object({
  name: nameSchema,
  data_limit_gb: dataLimitGbSchema.nullable().optional(),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
});

export const updateProxyUserSchema = z.object({
  name: nameSchema.optional(),
  enabled: z.boolean().optional(),
  data_limit_gb: dataLimitGbSchema.nullable().optional(),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
});

export type CreateProxyUserInput = z.infer<typeof createProxyUserSchema>;
export type UpdateProxyUserInput = z.infer<typeof updateProxyUserSchema>;
