"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Flag } from "lucide-react";

export default function FeatureFlagsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newFlag, setNewFlag] = useState({ key: "", name: "", description: "" });

  const { data: flags, isLoading } = useQuery({
    queryKey: ["feature-flags"],
    queryFn: async () => {
      const res = await fetch("/api/v1/platform/feature-flags");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { key: string; name: string; description: string }) => {
      const res = await fetch("/api/v1/platform/feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create flag");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
      setDialogOpen(false);
      setNewFlag({ key: "", name: "", description: "" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/v1/platform/feature-flags/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Failed to update flag");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
    },
  });

  const flagList = Array.isArray(flags) ? flags : flags?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flag className="h-6 w-6" />
            Feature Flags
          </h1>
          <p className="text-muted-foreground">Manage feature flags for gradual rollout</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Flag
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Feature Flag</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Key</Label>
                <Input
                  placeholder="e.g. beta_analytics"
                  value={newFlag.key}
                  onChange={(e) => setNewFlag({ ...newFlag, key: e.target.value })}
                />
              </div>
              <div>
                <Label>Name</Label>
                <Input
                  placeholder="e.g. Beta Analytics Dashboard"
                  value={newFlag.name}
                  onChange={(e) => setNewFlag({ ...newFlag, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  placeholder="What this flag controls..."
                  value={newFlag.description}
                  onChange={(e) => setNewFlag({ ...newFlag, description: e.target.value })}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate(newFlag)}
                disabled={!newFlag.key || !newFlag.name || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create Flag"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Global</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flagList.map((flag: {
                  id: string;
                  key: string;
                  name: string;
                  description: string;
                  isGlobal: boolean;
                  isActive: boolean;
                }) => (
                  <TableRow key={flag.id}>
                    <TableCell className="font-mono text-sm">{flag.key}</TableCell>
                    <TableCell className="font-medium">{flag.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {flag.description || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={flag.isGlobal ? "default" : "outline"}>
                        {flag.isGlobal ? "Global" : "Per-tenant"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={flag.isActive}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: flag.id, isActive: checked })
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {flagList.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No feature flags created yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
