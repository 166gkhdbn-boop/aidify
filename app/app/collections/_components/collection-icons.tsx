"use client";

import {
  FolderKanban,
  Database,
  Settings2,
  Code2,
  Globe,
  Lock,
  Star,
  Box,
  type LucideIcon,
} from "lucide-react";

export const COLLECTION_ICONS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "folder", label: "Folder", icon: FolderKanban },
  { key: "database", label: "Database", icon: Database },
  { key: "settings", label: "Settings", icon: Settings2 },
  { key: "code", label: "Code", icon: Code2 },
  { key: "globe", label: "Globe", icon: Globe },
  { key: "lock", label: "Lock", icon: Lock },
  { key: "star", label: "Star", icon: Star },
  { key: "box", label: "Box", icon: Box },
];

export function collectionIcon(key: string | null): LucideIcon {
  return COLLECTION_ICONS.find((c) => c.key === key)?.icon ?? FolderKanban;
}

export const COLLECTION_COLORS = [
  "#438BFF",
  "#65DFFF",
  "#8A5CFF",
  "#35D6A0",
  "#FFCB70",
  "#FF647C",
  "#9BAFCE",
];
