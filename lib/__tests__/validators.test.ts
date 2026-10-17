/**
 * Validator tests: config / collection / tag / project schemas.
 *
 * Accept valid payloads; reject bad names, oversize JSON, invalid enums,
 * and bad UUIDs. (Auth schemas are covered in foundation.test.ts.)
 */
import { describe, expect, it } from "vitest";
import {
  createConfigSchema,
  updateConfigSchema,
  collectionSchema,
  projectSchema,
  tagSchema,
  configNameSchema,
  jsonDataSchema,
  configTypeSchema,
  environmentSchema,
  configStatusSchema,
  uuidSchema,
  importConflictSchema,
} from "@/lib/validators";

const GOOD_UUID = "123e4567-e89b-12d3-a456-426614174000";

function validConfig(overrides: Record<string, unknown> = {}) {
  return {
    name: "My API config",
    config_type: "application",
    environment: "production",
    data: { url: "https://example.com", retries: 3 },
    ...overrides,
  };
}

describe("configNameSchema", () => {
  it("accepts a normal name", () => {
    expect(configNameSchema.safeParse("Payments API").success).toBe(true);
  });
  it("rejects empty and oversize names", () => {
    expect(configNameSchema.safeParse("").success).toBe(false);
    expect(configNameSchema.safeParse("   ").success).toBe(false);
    expect(configNameSchema.safeParse("x".repeat(201)).success).toBe(false);
  });
  it("rejects names with invalid characters", () => {
    expect(configNameSchema.safeParse("bad<name>").success).toBe(false);
    expect(configNameSchema.safeParse("semi;colon").success).toBe(false);
    expect(configNameSchema.safeParse("slash/name").success).toBe(false);
  });
});

describe("createConfigSchema", () => {
  it("accepts a complete valid config", () => {
    const parsed = createConfigSchema.safeParse(validConfig());
    expect(parsed.success).toBe(true);
  });
  it("applies defaults for data and status", () => {
    const parsed = createConfigSchema.safeParse({
      name: "Flags",
      config_type: "feature-flags",
      environment: "development",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.data).toEqual({});
      expect(parsed.data.status).toBe("draft");
    }
  });
  it("rejects an invalid config_type enum", () => {
    expect(
      createConfigSchema.safeParse(validConfig({ config_type: "database" }))
        .success,
    ).toBe(false);
  });
  it("rejects an invalid environment enum", () => {
    expect(
      createConfigSchema.safeParse(validConfig({ environment: "prod" }))
        .success,
    ).toBe(false);
  });
  it("rejects an invalid status enum", () => {
    expect(
      createConfigSchema.safeParse(validConfig({ status: "deleted" }))
        .success,
    ).toBe(false);
  });
  it("rejects a bad project_id UUID", () => {
    expect(
      createConfigSchema.safeParse(validConfig({ project_id: "not-a-uuid" }))
        .success,
    ).toBe(false);
  });
  it("accepts a valid project_id UUID", () => {
    expect(
      createConfigSchema.safeParse(validConfig({ project_id: GOOD_UUID }))
        .success,
    ).toBe(true);
  });
  it("rejects oversize JSON data", () => {
    const big = { blob: "x".repeat(500_001) };
    expect(
      createConfigSchema.safeParse(validConfig({ data: big })).success,
    ).toBe(false);
  });
  it("rejects non-object data", () => {
    expect(
      createConfigSchema.safeParse(validConfig({ data: ["a"] })).success,
    ).toBe(false);
  });
});

describe("updateConfigSchema", () => {
  it("accepts a partial update with a change summary", () => {
    const parsed = updateConfigSchema.safeParse({
      data: { a: 1 },
      change_summary: "Bump retries",
    });
    expect(parsed.success).toBe(true);
  });
  it("rejects an invalid type in a partial update", () => {
    expect(
      updateConfigSchema.safeParse({ config_type: "nope" }).success,
    ).toBe(false);
  });
});

describe("enum schemas", () => {
  it("accepts every documented config type", () => {
    for (const t of [
      "application",
      "api-endpoints",
      "feature-flags",
      "integration",
      "web-profile",
      "environment",
      "custom-json",
    ]) {
      expect(configTypeSchema.safeParse(t).success).toBe(true);
    }
  });
  it("accepts every documented environment", () => {
    for (const e of ["development", "staging", "production", "custom"]) {
      expect(environmentSchema.safeParse(e).success).toBe(true);
    }
  });
  it("accepts every documented status", () => {
    for (const s of ["active", "archived", "draft"]) {
      expect(configStatusSchema.safeParse(s).success).toBe(true);
    }
  });
  it("accepts every conflict mode", () => {
    for (const m of ["rename", "skip", "replace"]) {
      expect(importConflictSchema.safeParse(m).success).toBe(true);
    }
    expect(importConflictSchema.safeParse("overwrite").success).toBe(false);
  });
});

describe("collectionSchema", () => {
  it("accepts a complete valid collection", () => {
    const parsed = collectionSchema.safeParse({
      name: "Payments",
      description: "Payment configs",
      color: "#438BFF",
      icon: "credit-card",
    });
    expect(parsed.success).toBe(true);
  });
  it("rejects a bad name", () => {
    expect(
      collectionSchema.safeParse({ name: "bad<name>" }).success,
    ).toBe(false);
  });
  it("rejects a non-hex color", () => {
    expect(
      collectionSchema.safeParse({ name: "OK", color: "#zzzzzz" }).success,
    ).toBe(false);
    expect(
      collectionSchema.safeParse({ name: "OK", color: "red" }).success,
    ).toBe(false);
  });
  it("rejects a bad project_id UUID", () => {
    expect(
      collectionSchema.safeParse({ name: "OK", project_id: "xyz" }).success,
    ).toBe(false);
  });
});

describe("projectSchema", () => {
  it("accepts a valid project", () => {
    expect(
      projectSchema.safeParse({ name: "Website", description: "Main site" })
        .success,
    ).toBe(true);
  });
  it("rejects a bad name", () => {
    expect(projectSchema.safeParse({ name: "no/slashes" }).success).toBe(
      false,
    );
    expect(projectSchema.safeParse({ name: "" }).success).toBe(false);
  });
});

describe("tagSchema", () => {
  it("accepts a valid tag name", () => {
    expect(tagSchema.safeParse({ name: "critical" }).success).toBe(true);
  });
  it("rejects empty and oversize tag names", () => {
    expect(tagSchema.safeParse({ name: "" }).success).toBe(false);
    expect(tagSchema.safeParse({ name: "  " }).success).toBe(false);
    expect(tagSchema.safeParse({ name: "x".repeat(61) }).success).toBe(false);
  });
});

describe("uuidSchema", () => {
  it("accepts a valid UUID", () => {
    expect(uuidSchema.safeParse(GOOD_UUID).success).toBe(true);
  });
  it("rejects non-UUID strings", () => {
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(uuidSchema.safeParse("12345").success).toBe(false);
  });
});

describe("jsonDataSchema", () => {
  it("accepts plain objects", () => {
    expect(jsonDataSchema.safeParse({ a: 1, b: [1, 2] }).success).toBe(true);
  });
  it("rejects non-object JSON", () => {
    expect(jsonDataSchema.safeParse(null).success).toBe(false);
    expect(jsonDataSchema.safeParse("str").success).toBe(false);
    expect(jsonDataSchema.safeParse([1, 2]).success).toBe(false);
  });
  it("rejects payloads over 500 KB", () => {
    expect(
      jsonDataSchema.safeParse({ blob: "x".repeat(500_001) }).success,
    ).toBe(false);
    expect(
      jsonDataSchema.safeParse({ blob: "x".repeat(100) }).success,
    ).toBe(true);
  });
});
