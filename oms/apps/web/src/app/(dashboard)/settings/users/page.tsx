"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  locationAccess: string[];
  createdAt: string;
  company?: {
    id: string;
    name: string;
    code: string;
  };
}

const roles = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "ADMIN", label: "Admin" },
  { value: "MANAGER", label: "Manager" },
  { value: "OPERATOR", label: "Operator" },
  { value: "PICKER", label: "Picker" },
  { value: "PACKER", label: "Packer" },
];

export default function UsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    role: "OPERATOR",
  });

  const canManageUsers = ["SUPER_ADMIN", "ADMIN"].includes(
    session?.user?.role || ""
  );

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const response = await fetch("/api/v1/users");
      if (!response.ok) throw new Error("Failed to fetch users");
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const url = editingUser ? `/api/v1/users/${editingUser.id}` : "/api/v1/users";
      const method = editingUser ? "PATCH" : "POST";

      const payload = editingUser
        ? { ...formData, password: formData.password || undefined }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save user");
      }

      toast.success(editingUser ? "User updated" : "User created");
      setIsDialogOpen(false);
      setEditingUser(null);
      setFormData({
        email: "",
        password: "",
        name: "",
        phone: "",
        role: "OPERATOR",
      });
      fetchUsers();
    } catch (error) {
      console.error("Error saving user:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save user");
    }
  }

  async function handleToggleActive(user: User) {
    try {
      const response = await fetch(`/api/v1/v1/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });

      if (!response.ok) throw new Error("Failed to update user");

      toast.success(user.isActive ? "User deactivated" : "User activated");
      fetchUsers();
    } catch (error) {
      console.error("Error toggling user status:", error);
      toast.error("Failed to update user status");
    }
  }

  async function handleDelete(user: User) {
    if (!confirm(`Are you sure you want to delete ${user.name}?`)) return;

    try {
      const response = await fetch(`/api/v1/v1/users/${user.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete user");
      }

      toast.success("User deleted");
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete user");
    }
  }

  function openEditDialog(user: User) {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: "",
      name: user.name,
      phone: user.phone || "",
      role: user.role,
    });
    setIsDialogOpen(true);
  }

  function openCreateDialog() {
    setEditingUser(null);
    setFormData({
      email: "",
      password: "",
      name: "",
      phone: "",
      role: "OPERATOR",
    });
    setIsDialogOpen(true);
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "destructive";
      case "ADMIN":
        return "default";
      case "MANAGER":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            Manage users and their access permissions
          </p>
        </div>
        {canManageUsers && (
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            A list of all users in the system with their roles and status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-muted-foreground">No users found</p>
              {canManageUsers && (
                <Button variant="link" onClick={openCreateDialog}>
                  Add your first user
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {user.role.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "default" : "secondary"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.company?.name || "-"}</TableCell>
                    <TableCell className="text-right">
                      {canManageUsers && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openEditDialog(user)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleActive(user)}
                            >
                              {user.isActive ? (
                                <>
                                  <UserX className="mr-2 h-4 w-4" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            {session?.user?.role === "SUPER_ADMIN" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDelete(user)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* User Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Edit User" : "Create User"}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Update the user details below."
                : "Fill in the details to create a new user."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">
                  Password {editingUser && "(leave blank to keep current)"}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required={!editingUser}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) =>
                    setFormData({ ...formData, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingUser ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
