"use client";
import React, { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getInitials } from "@/lib/utils";
import type { Profile } from "@/types";

interface Props {
  profile: Profile | null;
  teamMembers: any[];
}

export function SettingsClient({ profile, teamMembers }: Props) {
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [members, setMembers] = useState(teamMembers);

  async function handleSaveProfile() {
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", profile!.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleRoleChange(memberId: string, role: string) {
    const supabase = createClient();
    await supabase.from("profiles").update({ role }).eq("id", memberId);
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role } : m))
    );
  }

  return (
    <>
      <Header title="Paramètres" />
      <div className="flex-1 p-6 space-y-6 animate-fade-in max-w-2xl">
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
                <p className="text-sm font-medium text-foreground">{profile?.email}</p>
                <Badge variant={profile?.role === "admin" ? "default" : "secondary"} className="mt-1">
                  {profile?.role === "admin" ? "Administrateur" : "Membre"}
                </Badge>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nom complet</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jean Dupont"
              />
            </div>
            <Button onClick={handleSaveProfile} disabled={saving} size="sm">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saved ? "Enregistré !" : "Enregistrer"}
            </Button>
          </CardContent>
        </Card>

        {/* Team */}
        {profile?.role === "admin" && (
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
                  <div key={member.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px]">
                        {member.full_name ? getInitials(member.full_name) : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {member.full_name ?? member.email}
                        {member.id === profile.id && (
                          <span className="text-[10px] text-muted-foreground ml-2">(vous)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                    {member.id !== profile.id ? (
                      <Select
                        value={member.role}
                        onValueChange={(v) => handleRoleChange(member.id, v)}
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
                      <Badge variant={member.role === "admin" ? "default" : "secondary"}>
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
