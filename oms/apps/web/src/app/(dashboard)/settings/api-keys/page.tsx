"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { Loader2, Plus, Key, Copy, Check } from "lucide-react";

export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newKey, setNewKey] = useState({ name: "", channel: "" });
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const res = await fetch("/api/v1/api-keys");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (keyData: { name: string; channel: string }) => {
      const res = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(keyData),
      });
      if (!res.ok) throw new Error("Failed to create key");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      setCreatedKey(data.key);
      setNewKey({ name: "", channel: "" });
    },
  });

  const keys = Array.isArray(data) ? data : data?.items || [];

  const copyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Key className="h-6 w-6" />
            API Keys
          </h1>
          <p className="text-muted-foreground">Manage API keys for external integrations</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setCreatedKey(null);
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {createdKey ? "Key Created" : "Create API Key"}
              </DialogTitle>
            </DialogHeader>
            {createdKey ? (
              <div className="space-y-4">
                <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
                  <p className="text-sm text-amber-800 font-medium mb-2">
                    Copy this key now. You won&apos;t be able to see it again.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-white p-2 rounded border break-all">
                      {createdKey}
                    </code>
                    <Button variant="outline" size="sm" onClick={copyKey}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button className="w-full" onClick={() => { setDialogOpen(false); setCreatedKey(null); }}>
                  Done
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>Key Name</Label>
                  <Input
                    placeholder="e.g. Shopify Integration"
                    value={newKey.name}
                    onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Channel (optional)</Label>
                  <Input
                    placeholder="e.g. SHOPIFY, AMAZON, WEB"
                    value={newKey.channel}
                    onChange={(e) => setNewKey({ ...newKey, channel: e.target.value })}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => createMutation.mutate(newKey)}
                  disabled={!newKey.name || createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create Key"}
                </Button>
              </div>
            )}
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
                  <TableHead>Name</TableHead>
                  <TableHead>Key Prefix</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key: {
                  id: string;
                  name: string;
                  keyPrefix: string;
                  channel: string;
                  isActive: boolean;
                  lastUsedAt: string;
                  createdAt: string;
                }) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <code className="text-sm">{key.keyPrefix}...</code>
                    </TableCell>
                    <TableCell>{key.channel || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={key.isActive ? "default" : "secondary"}>
                        {key.isActive ? "Active" : "Revoked"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {key.lastUsedAt
                        ? new Date(key.lastUsedAt).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      {new Date(key.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
                {keys.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No API keys created yet
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
