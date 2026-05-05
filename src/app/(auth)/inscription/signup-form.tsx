"use client";

import React from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signupAction, type AuthState } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      Créer mon compte
    </Button>
  );
}

export function SignupForm() {
  const [state, formAction] = useFormState<AuthState, FormData>(
    signupAction,
    undefined
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="first_name">Prénom</Label>
          <Input
            id="first_name"
            name="first_name"
            type="text"
            placeholder="Jean"
            required
            autoComplete="given-name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="last_name">Nom</Label>
          <Input
            id="last_name"
            name="last_name"
            type="text"
            placeholder="Dupont"
            required
            autoComplete="family-name"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="vous@exemple.com"
          required
          autoComplete="email"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
          autoComplete="new-password"
          minLength={6}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm_password">Confirmer le mot de passe</Label>
        <Input
          id="confirm_password"
          name="confirm_password"
          type="password"
          placeholder="••••••••"
          required
          autoComplete="new-password"
          minLength={6}
        />
      </div>

      {state?.error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 px-3 py-2">
          {state.error}
        </p>
      )}

      {state?.message && (
        <p className="text-xs text-success bg-success/10 border border-success/20 px-3 py-2">
          {state.message}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
