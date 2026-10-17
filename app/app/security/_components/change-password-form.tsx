"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { updatePasswordAction } from "@/actions/auth";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validators";

/** Change the account password (signed-in session, server-validated). */
export function ChangePasswordForm() {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const submit = async (values: ResetPasswordInput) => {
    const res = await updatePasswordAction(values);
    if (res.ok) {
      toast({
        title: "Password changed",
        description: "Use your new password next time you sign in.",
        variant: "success",
      });
      reset();
    } else {
      toast({ title: "Could not change password", description: res.error.message, variant: "error" });
    }
  };

  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="text-base">Change password</CardTitle>
        <CardDescription>Takes effect immediately for this account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(submit)} className="max-w-md space-y-4" noValidate>
          <div>
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
              className="mt-1.5"
            />
            {errors.password && <FormError message={errors.password.message} />}
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              {...register("confirmPassword")}
              className="mt-1.5"
            />
            {errors.confirmPassword && <FormError message={errors.confirmPassword.message} />}
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Changing…" : "Change password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
