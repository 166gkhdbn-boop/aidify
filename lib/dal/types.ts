/**
 * Shared row types for the data-access layer (wave 2G).
 *
 * These mirror the exact columns created in supabase/migrations/0001_schema.sql.
 * JSONB `data`/`metadata` columns are typed as Record<string, unknown>.
 */

export type ConfigType =
  | "application"
  | "api-endpoints"
  | "feature-flags"
  | "integration"
  | "web-profile"
  | "environment"
  | "custom-json";

export type ConfigEnvironment =
  | "development"
  | "staging"
  | "production"
  | "custom";

export type ConfigStatus = "active" | "archived" | "draft";

export interface ConfigurationRow {
  id: string;
  owner_id: string;
  project_id: string | null;
  collection_id: string | null;
  name: string;
  description: string | null;
  config_type: ConfigType;
  environment: ConfigEnvironment;
  data: Record<string, unknown>;
  status: ConfigStatus;
  version: number;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConfigurationVersionRow {
  id: string;
  configuration_id: string;
  version_number: number;
  data: Record<string, unknown>;
  change_summary: string | null;
  changed_by: string | null;
  created_at: string;
}

export interface TagRow {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
}

export interface CollectionRow {
  id: string;
  owner_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLogRow {
  id: string;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

export interface TicketRow {
  id: string;
  user_id: string;
  subject: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  updated_at: string;
}

export interface TicketReplyRow {
  id: string;
  ticket_id: string;
  author_id: string | null;
  body: string;
  is_staff: boolean;
  created_at: string;
}

export interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  audience: "all" | "users" | "admins";
  published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** A configuration with its relations resolved (list/detail shapes). */
export interface ConfigDetail extends ConfigurationRow {
  collection: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  tags: TagRow[];
}

export type ConfigSummary = ConfigDetail;

/** Standard paginated result shape. */
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
