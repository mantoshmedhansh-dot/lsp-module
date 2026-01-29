"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mic,
  MicOff,
  User,
  Settings,
  Activity,
  RefreshCw,
  Play,
  Square,
  Volume2,
  CheckCircle,
  AlertCircle,
  Clock,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface VoiceProfile {
  id: string;
  userId: string;
  userName: string;
  language: string;
  speechRate: number;
  confirmationMode: string;
  isTrainingComplete: boolean;
  trainingCompletedAt: string | null;
  createdAt: string;
}

interface VoiceSession {
  id: string;
  userId: string;
  userName: string;
  taskType: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  totalInteractions: number;
  successfulInteractions: number;
  errorCount: number;
  itemsProcessed: number;
}

interface VoiceCommand {
  id: string;
  commandPhrase: string;
  commandAction: string;
  alternatePhrases: string[];
  isActive: boolean;
}

export default function VoicePickingPage() {
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [sessions, setSessions] = useState<VoiceSession[]>([]);
  const [commands, setCommands] = useState<VoiceCommand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("profiles");
  const [activeSessions, setActiveSessions] = useState(0);

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

  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/voice/sessions?limit=20");
      if (response.ok) {
        const data = await response.json();
        const sessionList = Array.isArray(data) ? data : [];
        setSessions(sessionList);
        setActiveSessions(sessionList.filter((s: VoiceSession) => s.status === "ACTIVE").length);
      }
    } catch (error) {
      console.error("Error fetching sessions:", error);
    }
  }, []);

  const fetchCommands = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/voice/commands");
      if (response.ok) {
        const data = await response.json();
        setCommands(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching commands:", error);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchProfiles(), fetchSessions(), fetchCommands()]);
    setIsLoading(false);
  }, [fetchProfiles, fetchSessions, fetchCommands]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const toggleCommand = async (command: VoiceCommand) => {
    try {
      const response = await fetch(`/api/v1/voice/commands/${command.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !command.isActive }),
      });
      if (response.ok) {
        toast.success(`Command ${command.isActive ? "disabled" : "enabled"}`);
        fetchCommands();
      }
    } catch (error) {
      toast.error("Failed to update command");
    }
  };

  const getSessionStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-green-100 text-green-800"><Mic className="mr-1 h-3 w-3" />Active</Badge>;
      case "COMPLETED":
        return <Badge variant="secondary"><CheckCircle className="mr-1 h-3 w-3" />Completed</Badge>;
      case "PAUSED":
        return <Badge className="bg-yellow-100 text-yellow-800"><MicOff className="mr-1 h-3 w-3" />Paused</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const calculateSuccessRate = (session: VoiceSession) => {
    if (session.totalInteractions === 0) return 0;
    return (session.successfulInteractions / session.totalInteractions) * 100;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Voice Picking</h1>
          <p className="text-muted-foreground">
            Manage voice-directed warehouse operations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Voice Profiles</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profiles.length}</div>
            <p className="text-xs text-muted-foreground">
              {profiles.filter(p => p.isTrainingComplete).length} trained
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Mic className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeSessions}</div>
            <p className="text-xs text-muted-foreground">
              Currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessions.length}</div>
            <p className="text-xs text-muted-foreground">
              Today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Voice Commands</CardTitle>
            <Volume2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{commands.length}</div>
            <p className="text-xs text-muted-foreground">
              {commands.filter(c => c.isActive).length} active
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="profiles">Voice Profiles</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="commands">Commands</TabsTrigger>
        </TabsList>

        <TabsContent value="profiles">
          <Card>
            <CardHeader>
              <CardTitle>Voice Profiles</CardTitle>
              <CardDescription>Worker voice recognition profiles</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : profiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <User className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No voice profiles configured</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Language</TableHead>
                      <TableHead>Speech Rate</TableHead>
                      <TableHead>Confirmation Mode</TableHead>
                      <TableHead>Training</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profiles.map((profile) => (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">{profile.userName}</TableCell>
                        <TableCell>{profile.language}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{profile.speechRate}x</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{profile.confirmationMode}</Badge>
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
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(profile.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>Voice Sessions</CardTitle>
              <CardDescription>Recent voice picking sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Mic className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No voice sessions recorded</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Task Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Interactions</TableHead>
                      <TableHead className="text-center">Success Rate</TableHead>
                      <TableHead className="text-center">Items</TableHead>
                      <TableHead>Started</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">{session.userName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{session.taskType}</Badge>
                        </TableCell>
                        <TableCell>{getSessionStatusBadge(session.status)}</TableCell>
                        <TableCell className="text-center">
                          {session.totalInteractions}
                          {session.errorCount > 0 && (
                            <span className="text-red-500 ml-1">
                              ({session.errorCount} errors)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center gap-2">
                            <Progress
                              value={calculateSuccessRate(session)}
                              className="h-2 w-16"
                            />
                            <span className="text-sm">
                              {calculateSuccessRate(session).toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {session.itemsProcessed}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(session.startedAt).toLocaleTimeString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commands">
          <Card>
            <CardHeader>
              <CardTitle>Voice Commands</CardTitle>
              <CardDescription>Configure recognized voice commands</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : commands.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Volume2 className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No voice commands configured</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Command Phrase</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Alternate Phrases</TableHead>
                      <TableHead className="text-center">Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commands.map((command) => (
                      <TableRow key={command.id}>
                        <TableCell className="font-medium font-mono">
                          "{command.commandPhrase}"
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{command.commandAction}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {command.alternatePhrases?.slice(0, 3).map((phrase, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {phrase}
                              </Badge>
                            ))}
                            {command.alternatePhrases?.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{command.alternatePhrases.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={command.isActive}
                            onCheckedChange={() => toggleCommand(command)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
