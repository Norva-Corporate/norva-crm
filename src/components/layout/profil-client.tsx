"use client";

import React, { useState, useTransition } from "react";
import { Header } from "@/components/layout/header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, Users } from "lucide-react";
import { getInitials } from "@/lib/utils";
import {
  updateProfileAction,
  updateMemberRoleAction,
} from "@/app/(auth)/actions";
import type { Profile } from "@/types";

interface Props {
  profile: Profile | null;
  teamMembers: Profile[];
}

export function ProfilClient({ profile, teamMembers }: Props) {
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [members, setMembers] = useState(teamMembers);
  const [feedback, setFeedback] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSaveProfile(formData: FormData) {
    setFeedback(null);
    startTransition(async () => {
      const result = await updateProfileAction(formData);
      if (result?.error) {
        setFeedback({ type: "error", text: result.error });
      } else if (result?.message) {
        setFeedback({ type: "success", text: result.message });
        setTimeout(() => setFeedback(null), 2000);
      }
    });
  }

  function handleRoleChange(memberId: string, role: "admin" | "member") {
    const previous = members;
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role } : m))
    );
    startTransition(async () => {
      const result = await updateMemberRoleAction(memberId, role);
      if (result?.error) {
        setMembers(previous);
        setFeedback({ type: "error", text: result.error });
      }
    });
  }

  const isAdmin = profile?.role === "admin";

  return (
    <>
      <Header title="Profil" />
      <div className="flex-1 p-4 md:p-6 space-y-6 animate-fade-in max-w-2xl">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Mon profil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="text-base">
                  {profile?.full_name ? getInitials(profile.full_name) : "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {profile?.email}
                </p>
                <Badge
                  variant={isAdmin ? "default" : "secondary"}
                  className="mt-1"
                >
                  {isAdmin ? "Administrateur" : "Membre"}
                </Badge>
              </div>
            </div>

            <form action={handleSaveProfile} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Nom complet</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jean Dupont"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Rôle</Label>
                <p className="text-xs text-muted-foreground">
                  {isAdmin ? "Administrateur" : "Membre"}
                  {!isAdmin && " — seul un administrateur peut modifier votre rôle."}
                </p>
              </div>

              {feedback && (
                <p
                  className={
                    feedback.type === "error"
                      ? "text-xs text-destructive bg-destructive/10 border border-destructive/20 px-3 py-2"
                      : "text-xs text-success bg-success/10 border border-success/20 px-3 py-2"
                  }
                >
                  {feedback.text}
                </p>
              )}

              <Button type="submit" size="sm" disabled={pending}>
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Sauvegarder
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Team — admin only */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <CardTitle>Équipe ({members.length} membres)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-[var(--border)]">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px]">
                        {member.full_name
                          ? getInitials(member.full_name)
                          : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {member.full_name ?? member.email}
                        {member.id === profile?.id && (
                          <span className="text-[10px] text-muted-foreground ml-2">
                            (vous)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.email}
                      </p>
                    </div>
                    {member.id !== profile?.id ? (
                      <Select
                        value={member.role}
                        onValueChange={(v) =>
                          handleRoleChange(member.id, v as "admin" | "member")
                        }
                      >
                        <SelectTrigger className="w-36 h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrateur</SelectItem>
                          <SelectItem value="member">Membre</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge
                        variant={member.role === "admin" ? "default" : "secondary"}
                      >
                        {member.role === "admin" ? "Admin" : "Membre"}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
