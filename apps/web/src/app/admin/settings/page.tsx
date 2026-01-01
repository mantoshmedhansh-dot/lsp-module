"use client";

import { useState } from "react";
import {
  Settings,
  Building2,
  Truck,
  Route,
  Database,
  Shield,
  Bell,
  Globe,
} from "lucide-react";
import { Card, Button } from "@cjdquick/ui";

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState("general");

  const tabs = [
    { id: "general", label: "General", icon: Settings },
    { id: "operations", label: "Operations", icon: Building2 },
    { id: "fleet", label: "Fleet", icon: Truck },
    { id: "routing", label: "Routing", icon: Route },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Shield },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Configure system settings and preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <Card>
            <nav className="p-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? "bg-primary-50 text-primary-700"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <tab.icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              ))}
            </nav>
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === "general" && (
            <Card>
              <div className="p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  General Settings
                </h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company Name
                    </label>
                    <input
                      type="text"
                      defaultValue="CJDQuick Logistics"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      defaultValue="operations@cjdquick.com"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      defaultValue="+91 9876543210"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Timezone
                    </label>
                    <select className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
                      <option value="Asia/Kolkata">
                        Asia/Kolkata (IST, +05:30)
                      </option>
                    </select>
                  </div>
                  <div className="pt-4 border-t">
                    <Button>Save Changes</Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {activeTab === "operations" && (
            <Card>
              <div className="p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Operations Settings
                </h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Hub Operating Hours
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        type="time"
                        defaultValue="06:00"
                        className="px-3 py-2 border rounded-lg"
                      />
                      <input
                        type="time"
                        defaultValue="22:00"
                        className="px-3 py-2 border rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Sorting Capacity (packages/hour)
                    </label>
                    <input
                      type="number"
                      defaultValue="1000"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Target Fill Rate (%)
                    </label>
                    <input
                      type="number"
                      defaultValue="80"
                      min="0"
                      max="100"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div className="pt-4 border-t">
                    <Button>Save Changes</Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {activeTab === "fleet" && (
            <Card>
              <div className="p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Fleet Settings
                </h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Document Expiry Warning (days before)
                    </label>
                    <input
                      type="number"
                      defaultValue="30"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Fuel Cost per km (Rs.)
                    </label>
                    <input
                      type="number"
                      defaultValue="12"
                      step="0.1"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Driver Daily Allowance (Rs.)
                    </label>
                    <input
                      type="number"
                      defaultValue="500"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div className="pt-4 border-t">
                    <Button>Save Changes</Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {activeTab === "routing" && (
            <Card>
              <div className="p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Routing Settings
                </h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Average Speed (km/h)
                    </label>
                    <input
                      type="number"
                      defaultValue="40"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Buffer Time per Stop (minutes)
                    </label>
                    <input
                      type="number"
                      defaultValue="15"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="rounded" />
                      <span className="text-sm font-medium text-gray-700">
                        Enable automatic route optimization
                      </span>
                    </label>
                  </div>
                  <div className="pt-4 border-t">
                    <Button>Save Changes</Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {activeTab === "notifications" && (
            <Card>
              <div className="p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Notification Settings
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium text-gray-900">
                        Trip Status Updates
                      </p>
                      <p className="text-sm text-gray-500">
                        Notify when trips change status
                      </p>
                    </div>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </div>
                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium text-gray-900">
                        Document Expiry Alerts
                      </p>
                      <p className="text-sm text-gray-500">
                        Alert when vehicle/driver documents are expiring
                      </p>
                    </div>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </div>
                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium text-gray-900">
                        Low Capacity Alerts
                      </p>
                      <p className="text-sm text-gray-500">
                        Alert when available vehicles/drivers are low
                      </p>
                    </div>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-gray-900">
                        Email Reports
                      </p>
                      <p className="text-sm text-gray-500">
                        Send daily operational summary via email
                      </p>
                    </div>
                    <input type="checkbox" className="rounded" />
                  </div>
                  <div className="pt-4 border-t">
                    <Button>Save Changes</Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {activeTab === "security" && (
            <Card>
              <div className="p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Security Settings
                </h2>
                <div className="space-y-6">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Database className="h-8 w-8 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">Database</p>
                        <p className="text-sm text-gray-500">
                          SQLite - Local development mode
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Shield className="h-8 w-8 text-green-500" />
                      <div>
                        <p className="font-medium text-gray-900">
                          Security Status
                        </p>
                        <p className="text-sm text-green-600">All systems secure</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="rounded" />
                      <span className="text-sm font-medium text-gray-700">
                        Require OTP for driver login
                      </span>
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="rounded" />
                      <span className="text-sm font-medium text-gray-700">
                        Enable API rate limiting
                      </span>
                    </label>
                  </div>
                  <div className="pt-4 border-t">
                    <Button>Save Changes</Button>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
