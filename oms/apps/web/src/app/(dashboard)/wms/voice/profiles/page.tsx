"use client";

import { useState, useEffect, useCallback } from "react";
import {
  User,
  Plus,
  RefreshCw,
  Mic,
  Settings,
  CheckCircle,
  Clock,
  Edit,
  Trash2,
  Volume2,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface VoiceProfile {
  id: string;
  userId: string;
  userName: string;
  language: string;
  speechRate: number;
  volume: number;
  confirmationMode: string;
  isTrainingComplete: boolean;
  trainingProgress: number;
  trainingCompletedAt: string | null;
  lastUsedAt: string | null;
  totalSessions: number;
  createdAt: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

export default function VoiceProfilesPage() {
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<VoiceProfile | null>(null);
  const [formData, setFormData] = useState({
    userId: "",
    language: "en-US",
    speechRate: 1.0,
    volume: 1.0,
    confirmationMode: "STANDARD",
  });

  const fetchProfiles = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/voice/profiles");
      if (response.ok) {
        const data = await response.json();
        setProfiles(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/users?role=WAREHOUSE_WORKER");
      if (response.ok) {
        const data = await response.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchProfiles(), fetchUsers()]);
    setIsLoading(false);
  }, [fetchProfiles, fetchUsers]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSubmit = async () => {
    try {
      const url = editingProfile
        ? `/api/v1/voice/profiles/${editingProfile.id}`
        : "/api/v1/voice/profiles";
      const method = editingProfile ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success(editingProfile ? "Profile updated" : "Profile created");
        setIsDialogOpen(false);
        setEditingProfile(null);
        resetForm();
        fetchProfiles();
      } else {
        toast.error("Failed to save profile");
      }
    } catch (error) {
      toast.error("Error saving profile");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this voice profile?")) return;
    try {
      const response = await fetch(`/api/v1/voice/profiles/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast.success("Profile deleted");
        fetchProfiles();
      }
    } catch (error) {
      toast.error("Failed to delete profile");
    }
  };

  const startTraining = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/voice/profiles/${id}/start-training`, {
        method: "POST",
      });
      if (response.ok) {
        toast.success("Voice training started");
        fetchProfiles();
      }
    } catch (error) {
      toast.error("Failed to start training");
    }
  };

  const resetForm = () => {
    setFormData({
      userId: "",
      language: "en-US",
      speechRate: 1.0,
      volume: 1.0,
      confirmationMode: "STANDARD",
    });
  };

  const openEditDialog = (profile: VoiceProfile) => {
    setEditingProfile(profile);
    setFormData({
      userId: profile.userId,
      language: profile.language,
      speechRate: profile.speechRate,
      volume: profile.volume,
      confirmationMode: profile.confirmationMode,
    });
    setIsDialogOpen(true);
  };

  const trainedCount = profiles.filter((p) => p.isTrainingComplete).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Voice Profiles</h1>
          <p className="text-muted-foreground">
            Manage worker voice recognition profiles
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingProfile(null); resetForm(); }}>
                <Plus className="mr-2 h-4 w-4" />
                New Profile
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingProfile ? "Edit Profile" : "Create Voice Profile"}</DialogTitle>
                <DialogDescription>
                  {editingProfile ? "Update voice settings" : "Configure voice recognition for a worker"}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Worker</Label>
                  <Select
                    value={formData.userId}
                    onValueChange={(v) => setFormData({ ...formData, userId: v })}
                    disabled={!!editingProfile}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select worker" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select
                    value={formData.language}
                    onValueChange={(v) => setFormData({ ...formData, language: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en-US">English (US)</SelectItem>
                      <SelectItem value="en-GB">English (UK)</SelectItem>
                      <SelectItem value="hi-IN">Hindi</SelectItem>
                      <SelectItem value="es-ES">Spanish</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Speech Rate (0.5-2.0x)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="2.0"
                      value={formData.speechRate}
                      onChange={(e) => setFormData({ ...formData, speechRate: parseFloat(e.target.value) || 1.0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Volume (0.1-1.0)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="1.0"
                      value={formData.volume}
                      onChange={(e) => setFormData({ ...formData, volume: parseFloat(e.target.value) || 1.0 })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Confirmation Mode</Label>
                  <Select
                    value={formData.confirmationMode}
                    onValueChange={(v) => setFormData({ ...formData, confirmationMode: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">None (Expert)</SelectItem>
                      <SelectItem value="STANDARD">Standard</SelectItem>
                      <SelectItem value="VERBOSE">Verbose (Beginner)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit}>
                  {editingProfile ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Profiles</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profiles.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trained</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{trainedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Training</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{profiles.length - trainedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Profiles Table */}
      <Card>
        <CardHeader>
          <CardTitle>Voice Profiles</CardTitle>
          <CardDescription>Worker voice recognition configurations</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : profiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Mic className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No voice profiles configured</p>
              <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Profile
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Settings</TableHead>
                  <TableHead>Training</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.userName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{profile.language}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Volume2 className="h-4 w-4 text-muted-foreground" />
                        {profile.speechRate}x
                        <span className="text-muted-foreground">|</span>
                        {profile.confirmationMode}
                      </div>
                    </TableCell>
                    <TableCell>
                      {profile.isTrainingComplete ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Complete
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800">
                          <Clock className="mr-1 h-3 w-3" />
                          {profile.trainingProgress}% Complete
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{profile.totalSessions}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {profile.lastUsedAt
                        ? new Date(profile.lastUsedAt).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {!profile.isTrainingComplete && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startTraining(profile.id)}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(profile)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(profile.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
