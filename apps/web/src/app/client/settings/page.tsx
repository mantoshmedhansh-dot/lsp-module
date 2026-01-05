"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Settings,
  User,
  Users,
  Key,
  Building,
  Bell,
  Shield,
  ChevronRight,
  Edit,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from "@cjdquick/ui";

interface ClientProfile {
  id: string;
  companyName: string;
  gstNumber: string | null;
  billingAddress: string;
  webhookUrl: string | null;
  apiKey: string | null;
  user: {
    email: string;
    name: string;
    phone: string | null;
  };
}

interface ClientUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

async function fetchProfile(): Promise<{ data: ClientProfile }> {
  const res = await fetch("/api/client/profile");
  return res.json();
}

async function fetchTeamUsers(): Promise<{ data: ClientUser[] }> {
  const res = await fetch("/api/client/users");
  return res.json();
}

export default function ClientSettingsPage() {
  const { data: profileData } = useQuery({
    queryKey: ["client-profile"],
    queryFn: fetchProfile,
  });

  const { data: usersData } = useQuery({
    queryKey: ["client-users"],
    queryFn: fetchTeamUsers,
  });

  const profile = profileData?.data;
  const users = usersData?.data || [];

  const settingsSections = [
    {
      title: "Company Profile",
      description: "Manage your company details and GST information",
      icon: Building,
      href: "/client/settings/profile",
    },
    {
      title: "Team Members",
      description: `${users.length} user${users.length !== 1 ? "s" : ""} in your team`,
      icon: Users,
      href: "/client/settings/users",
    },
    {
      title: "API Integration",
      description: "Manage API keys and webhook configuration",
      icon: Key,
      href: "/client/settings/api",
    },
    {
      title: "Notifications",
      description: "Configure email and SMS alerts",
      icon: Bell,
      href: "/client/settings/notifications",
    },
    {
      title: "Security",
      description: "Password, 2FA, and login settings",
      icon: Shield,
      href: "/client/settings/security",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your account and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary-600" />
              Your Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profile ? (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl font-bold text-primary-600">
                      {profile.user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </span>
                  </div>
                  <h3 className="font-medium text-gray-900">{profile.user.name}</h3>
                  <p className="text-sm text-gray-500">{profile.user.email}</p>
                </div>

                <div className="pt-4 border-t space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Company</p>
                    <p className="text-sm font-medium">{profile.companyName}</p>
                  </div>
                  {profile.gstNumber && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase">GSTIN</p>
                      <p className="text-sm font-mono">{profile.gstNumber}</p>
                    </div>
                  )}
                  {profile.user.phone && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Phone</p>
                      <p className="text-sm">{profile.user.phone}</p>
                    </div>
                  )}
                </div>

                <Link href="/client/settings/profile">
                  <Button variant="outline" className="w-full">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="animate-pulse space-y-4">
                <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mx-auto"></div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Settings Sections */}
        <div className="lg:col-span-2 space-y-4">
          {settingsSections.map((section) => (
            <Link key={section.href} href={section.href}>
              <Card className="hover:border-primary-300 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                        <section.icon className="h-6 w-6 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {section.title}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {section.description}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Team Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary-600" />
            Team Members
          </CardTitle>
          <Link href="/client/settings/users/new">
            <Button size="sm">Add User</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No team members added</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Email
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Role
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Last Login
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.slice(0, 5).map((user) => (
                    <tr key={user.id}>
                      <td className="px-4 py-2 font-medium">{user.name}</td>
                      <td className="px-4 py-2 text-gray-500">{user.email}</td>
                      <td className="px-4 py-2">
                        <Badge
                          variant={
                            user.role === "OWNER"
                              ? "primary"
                              : user.role === "ADMIN"
                              ? "info"
                              : "default"
                          }
                          size="sm"
                        >
                          {user.role.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-2">
                        <Badge
                          variant={user.isActive ? "success" : "default"}
                          size="sm"
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {user.lastLoginAt
                          ? new Date(user.lastLoginAt).toLocaleDateString()
                          : "Never"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
