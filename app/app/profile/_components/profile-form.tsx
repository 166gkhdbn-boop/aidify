"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Button,
  Input,
  Label,
  FormError,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Avatar,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { updateProfileAction } from "@/actions/profile";
import { profileUpdateSchema } from "@/lib/validators";
import type { ProfileRow } from "@/lib/dal/types";

type Values = z.infer<typeof profileUpdateSchema>;

/** Edit display name, username and avatar URL. Email is read-only. */
export function ProfileForm({
  profile,
  email,
}: {
  profile: ProfileRow;
  email: string | null;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      display_name: profile.display_name ?? "",
      username: profile.username,
      avatar_url: profile.avatar_url ?? "",
    },
  });

  // Live preview without watch() (React Compiler incompatible).
  const [preview, setPreview] = React.useState({
    avatar: profile.avatar_url ?? "",
    name: profile.display_name || profile.username,
  });
  const previewInitial = (preview.name || "A").trim().charAt(0).toUpperCase();

  const submit = async (values: Values) => {
    const res = await updateProfileAction({
      display_name: values.display_name?.trim() ? values.display_name : null,
      username: values.username,
      avatar_url: values.avatar_url?.trim() ? values.avatar_url : null,
    });
    if (res.ok) {
      toast({ title: "Profile updated", variant: "success" });
      router.refresh();
    } else {
      toast({ title: "Update failed", description: res.error.message, variant: "error" });
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Read-only identity details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar
              src={preview.avatar.trim() || undefined}
              alt={preview.name || "Profile"}
              fallback={previewInitial}
              size="lg"
            />
            <div className="min-w-0">
              <p className="truncate font-semibold text-[var(--aidify-text)]">
                {preview.name || profile.username}
              </p>
              <p className="truncate text-sm text-[var(--aidify-secondary)]">@{profile.username}</p>
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input value={email ?? "Not available"} readOnly disabled className="mt-1.5 opacity-70" aria-label="Email address (read-only)" />
          </div>
          <div>
            <Label>Member since</Label>
            <p className="mt-1.5 text-sm text-[var(--aidify-text)]">
              {new Date(profile.created_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Edit profile</CardTitle>
          <CardDescription>Usernames are unique — taken names are rejected.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
            <div>
              <Label htmlFor="display_name">Display name</Label>
              <Input
                id="display_name"
                {...register("display_name", {
                  onChange: (e) =>
                    setPreview((p) => ({ ...p, name: e.target.value || profile.username })),
                })}
                placeholder="How should we address you?"
                maxLength={80}
                className="mt-1.5"
              />
              {errors.display_name && <FormError message={errors.display_name.message} />}
            </div>
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                {...register("username")}
                className="mt-1.5 font-mono"
                aria-describedby="username-hint"
              />
              <p id="username-hint" className="mt-1 text-xs text-[var(--aidify-secondary)]">
                3–32 characters: letters, numbers, underscore, dot or dash.
              </p>
              {errors.username && <FormError message={errors.username.message} />}
            </div>
            <div>
              <Label htmlFor="avatar_url">Avatar URL</Label>
              <Input
                id="avatar_url"
                {...register("avatar_url", {
                  onChange: (e) => setPreview((p) => ({ ...p, avatar: e.target.value })),
                })}
                placeholder="https://…"
                className="mt-1.5 font-mono"
              />
              {errors.avatar_url && <FormError message={errors.avatar_url.message} />}
            </div>
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
