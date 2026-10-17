"use client";

import * as React from "react";
import { ConfigForm, type ConfigFormInitial } from "./config-form";

interface ConfigFormHostProps {
  mode: "create" | "edit";
  configId?: string;
  expectedVersion?: number;
  initial?: ConfigFormInitial;
  projects: { id: string; name: string }[];
  collections: { id: string; name: string }[];
  initialTags: { id: string; name: string }[];
}

/**
 * Hosts ConfigForm with client-side tag state (new tags created inline must
 * appear in the picker without a page reload).
 */
export function ConfigFormHost({
  mode,
  configId,
  expectedVersion,
  initial,
  projects,
  collections,
  initialTags,
}: ConfigFormHostProps) {
  const [tags, setTags] = React.useState(initialTags);
  return (
    <ConfigForm
      mode={mode}
      configId={configId}
      expectedVersion={expectedVersion}
      initial={initial}
      projects={projects}
      collections={collections}
      tags={tags}
      onTagsChanged={setTags}
    />
  );
}
