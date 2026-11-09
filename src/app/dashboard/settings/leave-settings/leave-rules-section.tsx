"use client";

import * as React from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";
import {
Dialog,
DialogContent,
DialogDescription,
DialogFooter,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import {
addLeaveTypeAction,
deleteLeaveTypeAction,
setLeaveTypeActiveAction,
updateLeaveTypeAction,
updatePoolAllotmentAction,
type LeavePool,
type LeaveTypePolicy,
} from "./leave-policy-actions";

interface LeaveRulesSectionProps {
	pools: LeavePool[];
	types: LeaveTypePolicy[];
	onChanged: () => Promise<void>;
}

export function LeaveRulesSection({ pools, types, onChanged }: LeaveRulesSectionProps) {
	const [allotmentEdits, setAllotmentEdits] = React.useState<Record<number, string>>({});
	const [typeEdits, setTypeEdits] = React.useState<
		Record<number, { name?: string; poolId?: number }>
	>({});

	const [newName, setNewName] = React.useState("");
  const [newPoolId, setNewPoolId] = React.useState<string>("");
  const [typeToDelete, setTypeToDelete] = React.useState<LeaveTypePolicy | null>(null);

	const [busy, setBusy] = React.useState<string | null>(null);

  const poolName = (id: number) => pools.find((p) => p.id === id)?.pool_name ?? "Unknown";

	const run = async (
    key: string,
    action: () => Promise<{ success: boolean; error?: string }>,
    successMessage: string
  ): Promise<boolean> => {
    setBusy(key);
    try {
      const res = await action();
      if (!res.success) {
        toast.error(res.error || "Something went wrong.");
        return false;
      }
      toast.success(successMessage);
      await onChanged();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(null);
    }
  };

	// Pool allotments edits
	const savePool = async (pool: LeavePool) => {
    const raw = (allotmentEdits[pool.id] ?? "").trim();
    if (raw === "" || !Number.isFinite(Number(raw))) {
      toast.error("Enter a number of days.");
      return;
    }
    const ok = await run(
      `pool-${pool.id}`,
      () => updatePoolAllotmentAction(pool.id, Number(raw)),
      `${pool.pool_name} allotment updated.`
    );
    if (ok) {
      setAllotmentEdits((prev) => {
        const next = { ...prev };
        delete next[pool.id];
        return next;
      });
    }
  };

	// Leave type edits
	const saveType = async (type: LeaveTypePolicy) => {
    const name = typeEdits[type.id]?.name ?? type.name;
    const poolId = typeEdits[type.id]?.poolId ?? type.pool_id;
    const ok = await run(
      `save-${type.id}`,
      () => updateLeaveTypeAction(type.id, { name, poolId }),
      "Leave type updated."
    );
    if (ok) {
      setTypeEdits((prev) => {
        const next = { ...prev };
        delete next[type.id];
        return next;
      });
    }
  };

	// Toggle active status
	const toggleActive = (type: LeaveTypePolicy) =>
    run(
      `active-${type.id}`,
      () => setLeaveTypeActiveAction(type.id, !type.is_active),
      type.is_active ? "Leave type deactivated." : "Leave type reactivated."
    );

	// Confirm delete
	const confirmDelete = async () => {
		if (!typeToDelete) return;
		const target = typeToDelete;
		// If the type is in use, the server's message tells the person to
		// deactivate it instead, and the row stays.
		await run(`delete-${target.id}`, () => deleteLeaveTypeAction(target.id), "Leave type deleted.");
		setTypeToDelete(null);
	};

	// Add Leave type to pool
	const addPoolId = newPoolId || (pools[0] ? String(pools[0].id) : "");
  const addType = async () => {
    if (!addPoolId) {
      toast.error("There are no leave pools to add a type to.");
      return;
    }
    const ok = await run(
      "add",
      () => addLeaveTypeAction(newName, Number(addPoolId)),
      "Leave type added."
    );
    if (ok) setNewName("");
  };

	// Spinner
  const spinner = (key: string) =>
    busy === key ? <IconLoader2 className="h-3 w-3 animate-spin" /> : null;

	return (
    <div className="space-y-5 border-b pb-8">
      <div className="flex items-center gap-2 text-foreground font-semibold text-lg pb-2">
        <h2>Leave Rules</h2>
      </div>

      {/* POOLS: how many days each pool grants per year */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Leave Pools</h3>
        <p className="text-xs text-muted-foreground">
          The days each pool gives every employee per year. Maternity and Paternity
          are where HR sets the government figures.
        </p>
        <div className="border border-border rounded-xl overflow-hidden bg-muted/5">
          <table className="w-full border-collapse text-sm text-left">
            <thead>
              <tr className="bg-muted/10 text-muted-foreground font-medium border-b border-border">
                <th className="p-3">Pool</th>
                <th className="p-3">Annual allotment (days)</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {pools.map((pool) => {
                const value = allotmentEdits[pool.id] ?? String(pool.annual_allotment);
                const isDirty =
                  allotmentEdits[pool.id] !== undefined &&
                  allotmentEdits[pool.id].trim() !== String(pool.annual_allotment);
                return (
                  <tr key={pool.id} className="hover:bg-muted/5 transition-colors">
                    <td className="p-3 text-foreground font-medium">{pool.pool_name}</td>
                    <td className="p-3">
                      <Input
                        type="number"
                        min={0}
                        max={9999.9}
                        step={0.1}
                        value={value}
                        onChange={(e) =>
                          setAllotmentEdits((prev) => ({ ...prev, [pool.id]: e.target.value }))
                        }
                        className="w-32 h-8 text-sm"
                        aria-label={`${pool.pool_name} annual allotment`}
                      />
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        className="h-8 cursor-pointer"
                        disabled={!isDirty || busy === `pool-${pool.id}`}
                        onClick={() => savePool(pool)}
                      >
                        {spinner(`pool-${pool.id}`)}
                        Save
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* LEAVE TYPES: the choices on the leave form, and which pool each draws from */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Leave Types</h3>
        <p className="text-xs text-muted-foreground">
          Deactivate a type to hide it from the leave form. Its approved days still
          count. A type can only be deleted if no leave has ever used it.
        </p>
        <div className="border border-border rounded-xl overflow-hidden bg-muted/5">
          <table className="w-full border-collapse text-sm text-left">
            <thead>
              <tr className="bg-muted/10 text-muted-foreground font-medium border-b border-border">
                <th className="p-3">Name</th>
                <th className="p-3">Pool</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {types.map((type) => {
                const name = typeEdits[type.id]?.name ?? type.name;
                const poolId = typeEdits[type.id]?.poolId ?? type.pool_id;
                const isDirty = name !== type.name || poolId !== type.pool_id;
                const poolChanged = poolId !== type.pool_id;
                const rowBusy = busy !== null && busy.endsWith(`-${type.id}`);

                return (
                  <React.Fragment key={type.id}>
                    <tr className="hover:bg-muted/5 transition-colors">
                      <td className="p-3">
                        <Input
                          value={name}
                          maxLength={64}
                          onChange={(e) =>
                            setTypeEdits((prev) => ({
                              ...prev,
                              [type.id]: { ...prev[type.id], name: e.target.value },
                            }))
                          }
                          className={`w-56 h-8 text-sm ${type.is_active ? "" : "text-muted-foreground"}`}
                          aria-label="Leave type name"
                        />
                      </td>
                      <td className="p-3">
                        <Select
                          value={String(poolId)}
                          onValueChange={(val) =>
                            setTypeEdits((prev) => ({
                              ...prev,
                              [type.id]: { ...prev[type.id], poolId: Number(val) },
                            }))
                          }
                        >
                          <SelectTrigger className="w-36 h-8 bg-muted/20 border-border justify-between text-xs">
                            <SelectValue placeholder="Pool" />
                          </SelectTrigger>
                          <SelectContent>
                            {pools.map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.pool_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 text-xs">
                        <span
                          className={
                            type.is_active
                              ? "text-emerald-600 dark:text-emerald-400 font-medium"
                              : "text-muted-foreground"
                          }
                        >
                          {type.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            className="h-8 cursor-pointer"
                            disabled={!isDirty || rowBusy}
                            onClick={() => saveType(type)}
                          >
                            {spinner(`save-${type.id}`)}
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 cursor-pointer"
                            disabled={rowBusy}
                            onClick={() => toggleActive(type)}
                          >
                            {spinner(`active-${type.id}`)}
                            {type.is_active ? "Deactivate" : "Reactivate"}
                          </Button>
                          <button
                            type="button"
                            onClick={() => setTypeToDelete(type)}
                            disabled={rowBusy}
                            className="p-1.5 border-2 border-border rounded-md text-muted-foreground hover:text-destructive hover:border-destructive/20 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete leave type"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Shown before saving a pool move, so nobody is surprised
                        that balances change. */}
                    {poolChanged && (
                      <tr className="bg-amber-500/5">
                        <td colSpan={4} className="px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                          Moving this type from {poolName(type.pool_id)} to {poolName(poolId)} changes
                          remaining balances for its approved days. Amounts already printed on filed
                          forms stay as they were.
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {types.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-muted-foreground">
                    No leave types yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add a new type. It shows on the leave form right away. */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Input
            value={newName}
            maxLength={64}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New leave type name"
            className="w-56 h-8 text-sm"
            aria-label="New leave type name"
          />
          <Select value={addPoolId} onValueChange={setNewPoolId}>
            <SelectTrigger className="w-36 h-8 bg-muted/20 border-border justify-between text-xs">
              <SelectValue placeholder="Pool" />
            </SelectTrigger>
            <SelectContent>
              {pools.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.pool_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="h-8 cursor-pointer"
            disabled={busy === "add" || newName.trim() === ""}
            onClick={addType}
          >
            {spinner("add")}
            Add
          </Button>
        </div>
      </div>

      <Dialog
        open={!!typeToDelete}
        onOpenChange={(open) => !open && busy === null && setTypeToDelete(null)}
      >
        <DialogContent showCloseButton={busy === null}>
          <DialogHeader>
            <DialogTitle>Delete Leave Type</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{typeToDelete?.name}</strong>? This cannot be
              undone. If any leave has used it, it cannot be deleted. Deactivate it instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setTypeToDelete(null)}
              disabled={busy !== null}
              className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              disabled={busy !== null}
              className="px-4 py-2 text-sm font-medium text-white bg-destructive hover:bg-destructive/90 rounded-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition-colors"
            >
              {busy !== null ? "Deleting..." : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}