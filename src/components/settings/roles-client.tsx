"use client";

import React, { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Save,
  Shield,
  Trash2,
  Users,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PERMISSION_CATALOG,
  MODULE_LABELS,
  ACTION_LABELS,
  type PermissionModule,
  type PermissionKey,
} from "@/lib/permissions/catalog";
import {
  createRole,
  deleteRole,
  setRolePermissions,
  updateRole,
  type RoleWithStats,
} from "@/lib/actions/roles";

interface Props {
  initialRoles: RoleWithStats[];
}

export function RolesClient({ initialRoles }: Props) {
  const [roles, setRoles] = useState(initialRoles);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(
    initialRoles[0]?.id ?? null
  );
  const [draftPerms, setDraftPerms] = useState<Set<string>>(
    new Set(initialRoles[0]?.permission_keys ?? [])
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editRoleId, setEditRoleId] = useState<string | null>(null);
  const [openModules, setOpenModules] = useState<Set<string>>(
    new Set(Object.keys(PERMISSION_CATALOG))
  );
  const [pending, startTransition] = useTransition();

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) ?? null,
    [roles, selectedRoleId]
  );

  const isAdminRole = selectedRole?.key === "admin";
  const initialPermsForSelected = useMemo(
    () => new Set(selectedRole?.permission_keys ?? []),
    [selectedRole]
  );
  const dirty = useMemo(() => {
    if (!selectedRole) return false;
    if (draftPerms.size !== initialPermsForSelected.size) return true;
    for (const p of draftPerms) {
      if (!initialPermsForSelected.has(p as PermissionKey)) return true;
    }
    return false;
  }, [draftPerms, initialPermsForSelected, selectedRole]);

  function selectRole(id: string) {
    const r = roles.find((x) => x.id === id);
    if (!r) return;
    setSelectedRoleId(id);
    setDraftPerms(new Set(r.permission_keys));
  }

  function togglePerm(key: PermissionKey, checked: boolean) {
    if (isAdminRole) return;
    setDraftPerms((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleAllInModule(mod: PermissionModule, checked: boolean) {
    if (isAdminRole) return;
    setDraftPerms((prev) => {
      const next = new Set(prev);
      for (const action of PERMISSION_CATALOG[mod]) {
        const key = `${mod}.${action}` as PermissionKey;
        if (checked) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }

  function toggleModuleOpen(mod: string) {
    setOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod);
      else next.add(mod);
      return next;
    });
  }

  function handleSavePermissions() {
    if (!selectedRole) return;
    if (isAdminRole) return;
    const keys = Array.from(draftPerms);
    startTransition(async () => {
      const res = await setRolePermissions(selectedRole.id, keys);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Permissions enregistrées.");
      setRoles((prev) =>
        prev.map((r) =>
          r.id === selectedRole.id
            ? { ...r, permission_keys: keys as PermissionKey[] }
            : r
        )
      );
    });
  }

  function handleDeleteRole(role: RoleWithStats) {
    if (role.is_system) return;
    if (
      !window.confirm(
        `Supprimer le rôle « ${role.name} » ? Cette action est irréversible.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deleteRole(role.id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Rôle supprimé.");
      const remaining = roles.filter((r) => r.id !== role.id);
      setRoles(remaining);
      if (selectedRoleId === role.id) {
        const fallback = remaining[0] ?? null;
        setSelectedRoleId(fallback?.id ?? null);
        setDraftPerms(new Set(fallback?.permission_keys ?? []));
      }
    });
  }

  return (
    <>
      <Header title="Rôles & permissions" />
      <div className="flex-1 p-4 md:p-6 animate-fade-in">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground max-w-2xl">
            Créez des rôles personnalisés et ajustez les permissions par module.
            Les permissions s&apos;appliquent à tous les membres assignés au
            rôle. Vous pouvez assigner un rôle depuis{" "}
            <Link
              href="/dashboard/profil"
              className="text-accent hover:underline"
            >
              la page Profil
            </Link>
            .
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {/* Liste des rôles */}
          <Card className="md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Rôles ({roles.length})
              </CardTitle>
              <Button
                size="sm"
                onClick={() => setCreateOpen(true)}
                disabled={pending}
              >
                <Plus className="h-4 w-4" />
                Nouveau
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-[var(--border)]">
                {roles.map((role) => {
                  const isSelected = role.id === selectedRoleId;
                  return (
                    <div
                      key={role.id}
                      className={
                        "flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors " +
                        (isSelected
                          ? "bg-[var(--muted)]/40"
                          : "hover:bg-[var(--muted)]/20")
                      }
                      onClick={() => selectRole(role.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">
                            {role.name}
                          </p>
                          {role.is_system && (
                            <Badge variant="secondary" className="text-[10px]">
                              Système
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {role.description ?? <span>&mdash;</span>}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {role.member_count} membre
                          {role.member_count > 1 ? "s" : ""}
                          {" · "}
                          {role.permission_keys.length} permission
                          {role.permission_keys.length > 1 ? "s" : ""}
                        </p>
                      </div>
                      {!role.is_system && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground p-1"
                            title="Renommer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditRoleId(role.id);
                            }}
                          >
                            <Save className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive p-1"
                            title="Supprimer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRole(role);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Matrice de permissions */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span>
                  {selectedRole
                    ? `Permissions — ${selectedRole.name}`
                    : "Sélectionnez un rôle"}
                </span>
                {selectedRole && !isAdminRole && (
                  <Button
                    size="sm"
                    onClick={handleSavePermissions}
                    disabled={!dirty || pending}
                  >
                    {pending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Enregistrer
                  </Button>
                )}
              </CardTitle>
              {isAdminRole && (
                <p className="text-xs text-muted-foreground">
                  Le rôle Administrateur possède toujours toutes les permissions.
                  Cette matrice est en lecture seule.
                </p>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {!selectedRole ? (
                <div className="px-5 py-8 text-sm text-muted-foreground text-center">
                  Aucun rôle sélectionné.
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {(
                    Object.keys(PERMISSION_CATALOG) as PermissionModule[]
                  ).map((mod) => {
                    const actions = PERMISSION_CATALOG[mod];
                    const allChecked = actions.every((a) =>
                      isAdminRole ? true : draftPerms.has(`${mod}.${a}`)
                    );
                    const someChecked = actions.some((a) =>
                      isAdminRole ? true : draftPerms.has(`${mod}.${a}`)
                    );
                    const isOpen = openModules.has(mod);
                    return (
                      <div key={mod}>
                        <div className="flex items-center gap-3 px-5 py-2.5">
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => toggleModuleOpen(mod)}
                          >
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {MODULE_LABELS[mod]}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {actions.filter((a) =>
                                isAdminRole
                                  ? true
                                  : draftPerms.has(`${mod}.${a}`)
                              ).length}{" "}
                              / {actions.length} actions
                            </p>
                          </div>
                          <Checkbox
                            checked={
                              allChecked
                                ? true
                                : someChecked
                                ? "indeterminate"
                                : false
                            }
                            disabled={isAdminRole || pending}
                            onCheckedChange={(v) =>
                              toggleAllInModule(mod, v === true)
                            }
                            aria-label={`Tout cocher pour ${MODULE_LABELS[mod]}`}
                          />
                        </div>
                        {isOpen && (
                          <div className="px-5 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4">
                            {actions.map((action) => {
                              const key = `${mod}.${action}` as PermissionKey;
                              const checked = isAdminRole
                                ? true
                                : draftPerms.has(key);
                              return (
                                <label
                                  key={key}
                                  className="flex items-center gap-2 text-xs cursor-pointer pl-7"
                                >
                                  <Checkbox
                                    checked={checked}
                                    disabled={isAdminRole || pending}
                                    onCheckedChange={(v) =>
                                      togglePerm(key, v === true)
                                    }
                                  />
                                  <span className="text-foreground">
                                    {ACTION_LABELS[action] ?? action}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    {key}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <CreateRoleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(role) => {
          setRoles((prev) => [...prev, role]);
          setSelectedRoleId(role.id);
          setDraftPerms(new Set(role.permission_keys));
        }}
      />

      <EditRoleDialog
        role={roles.find((r) => r.id === editRoleId) ?? null}
        onOpenChange={(open) => {
          if (!open) setEditRoleId(null);
        }}
        onUpdated={(updated) => {
          setRoles((prev) =>
            prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
          );
        }}
      />
    </>
  );
}

// ============================================================
// Dialogs
// ============================================================
function CreateRoleDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (role: RoleWithStats) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      const res = await createRole({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Rôle créé.");
      onCreated({
        id: res.data.id,
        key: res.data.key,
        name: name.trim(),
        description: description.trim() || null,
        is_system: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        member_count: 0,
        permission_keys: [],
      });
      setName("");
      setDescription("");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau rôle</DialogTitle>
          <DialogDescription>
            Créez un rôle personnalisé. Les permissions se règlent ensuite dans
            la matrice.
          </DialogDescription>
        </DialogHeader>
        <div className="p-4 md:p-6 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="role-name">Nom</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Manager Ventes"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role-desc">Description (optionnelle)</Label>
            <Textarea
              id="role-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="À quoi sert ce rôle ?"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button size="sm" onClick={handleCreate} disabled={!name.trim() || pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditRoleDialog({
  role,
  onOpenChange,
  onUpdated,
}: {
  role: RoleWithStats | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: (role: Pick<RoleWithStats, "id" | "name" | "description">) => void;
}) {
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [pending, startTransition] = useTransition();

  React.useEffect(() => {
    setName(role?.name ?? "");
    setDescription(role?.description ?? "");
  }, [role]);

  if (!role) return null;

  function handleUpdate() {
    if (!role) return;
    const targetId = role.id;
    startTransition(async () => {
      const res = await updateRole(targetId, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Rôle mis à jour.");
      onUpdated({
        id: targetId,
        name: name.trim(),
        description: description.trim() || null,
      });
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={!!role} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier le rôle</DialogTitle>
        </DialogHeader>
        <div className="p-4 md:p-6 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="role-edit-name">Nom</Label>
            <Input
              id="role-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role-edit-desc">Description</Label>
            <Textarea
              id="role-edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button size="sm" onClick={handleUpdate} disabled={!name.trim() || pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
