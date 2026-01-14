"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  User,
  Bell,
  Shield,
  Palette,
  Save,
  Mail,
  Phone,
  Building2,
  Key,
  Eye,
  EyeOff,
} from "lucide-react";

export default function ClientSettingsPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState("profile");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({
    name: session?.user?.name || "",
    email: session?.user?.email || "",
    phone: "+91 9876543210",
    company: "ABC Trading Co.",
  });

  const [notifications, setNotifications] = useState({
    orderUpdates: true,
    shipmentAlerts: true,
    inventoryAlerts: true,
    weeklyReports: true,
    marketingEmails: false,
  });

  const [password, setPassword] = useState({
    current: "",
    new: "",
    confirm: "",
  });

  const handleSaveProfile = async () => {
    setSaving(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
    alert("Profile updated successfully!");
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
    alert("Notification preferences saved!");
  };

  const handleChangePassword = async () => {
    if (password.new !== password.confirm) {
      alert("Passwords do not match!");
      return;
    }
    if (password.new.length < 8) {
      alert("Password must be at least 8 characters!");
      return;
    }
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
    setPassword({ current: "", new: "", confirm: "" });
    alert("Password changed successfully!");
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Shield },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your account preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 shrink-0">
          <nav className="bg-white rounded-xl shadow-sm border p-2 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  activeTab === tab.id
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === "profile" && (
            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900">
                  Profile Information
                </h2>
                <p className="text-sm text-gray-600">
                  Update your personal details
                </p>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-blue-600">
                      {profile.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <button className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                    Change Photo
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={profile.name}
                        onChange={(e) =>
                          setProfile({ ...profile, name: e.target.value })
                        }
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        value={profile.email}
                        onChange={(e) =>
                          setProfile({ ...profile, email: e.target.value })
                        }
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="tel"
                        value={profile.phone}
                        onChange={(e) =>
                          setProfile({ ...profile, phone: e.target.value })
                        }
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Company Name
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={profile.company}
                        disabled
                        className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 text-gray-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900">
                  Notification Preferences
                </h2>
                <p className="text-sm text-gray-600">
                  Choose what notifications you receive
                </p>
              </div>
              <div className="p-6 space-y-6">
                {[
                  {
                    key: "orderUpdates",
                    label: "Order Updates",
                    description: "Get notified about order status changes",
                  },
                  {
                    key: "shipmentAlerts",
                    label: "Shipment Alerts",
                    description: "Notifications about shipping and delivery",
                  },
                  {
                    key: "inventoryAlerts",
                    label: "Inventory Alerts",
                    description: "Low stock and out of stock notifications",
                  },
                  {
                    key: "weeklyReports",
                    label: "Weekly Reports",
                    description: "Weekly summary of your business metrics",
                  },
                  {
                    key: "marketingEmails",
                    label: "Marketing Emails",
                    description: "Tips, updates, and promotional content",
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{item.label}</p>
                      <p className="text-sm text-gray-500">{item.description}</p>
                    </div>
                    <button
                      onClick={() =>
                        setNotifications({
                          ...notifications,
                          [item.key]:
                            !notifications[item.key as keyof typeof notifications],
                        })
                      }
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        notifications[item.key as keyof typeof notifications]
                          ? "bg-blue-600"
                          : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          notifications[item.key as keyof typeof notifications]
                            ? "translate-x-7"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveNotifications}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? "Saving..." : "Save Preferences"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900">
                  Security Settings
                </h2>
                <p className="text-sm text-gray-600">
                  Manage your password and security
                </p>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">Change Password</h3>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Current Password
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password.current}
                        onChange={(e) =>
                          setPassword({ ...password, current: e.target.value })
                        }
                        className="w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      New Password
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password.new}
                        onChange={(e) =>
                          setPassword({ ...password, new: e.target.value })
                        }
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password.confirm}
                        onChange={(e) =>
                          setPassword({ ...password, confirm: e.target.value })
                        }
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleChangePassword}
                    disabled={saving || !password.current || !password.new}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Shield className="w-4 h-4" />
                    {saving ? "Updating..." : "Update Password"}
                  </button>
                </div>

                <div className="pt-6 border-t">
                  <h3 className="font-medium text-gray-900 mb-4">
                    Active Sessions
                  </h3>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">Current Session</p>
                        <p className="text-sm text-gray-500">
                          Chrome on Windows - Last active: Just now
                        </p>
                      </div>
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                        Active
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
