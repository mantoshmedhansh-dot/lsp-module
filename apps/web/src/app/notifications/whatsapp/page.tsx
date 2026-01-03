"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Input } from "@cjdquick/ui";
import {
  MessageCircle,
  Plus,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  Settings,
  FileText,
  Send,
  Eye,
} from "lucide-react";

interface WhatsAppConfig {
  id: string;
  businessAccountId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  provider: string;
  businessName: string;
  isVerified: boolean;
  qualityRating?: string;
  messagingLimit?: string;
  isActive: boolean;
  _count: { templates: number; messages: number };
}

interface WhatsAppTemplate {
  id: string;
  templateName: string;
  category: string;
  language: string;
  bodyContent: string;
  useCase?: string;
  status: string;
  variableCount: number;
}

interface WhatsAppMessage {
  id: string;
  recipientPhone: string;
  recipientName?: string;
  templateName?: string;
  status: string;
  awbNumber?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  template?: { templateName: string; category: string };
}

export default function WhatsAppPage() {
  const [configs, setConfigs] = useState<WhatsAppConfig[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const configRes = await fetch("/api/whatsapp");
      const configData = await configRes.json();

      if (configData.success) {
        setConfigs(configData.data.items || []);
        if (configData.data.items?.length > 0) {
          setSelectedConfig(configData.data.items[0].id);
          await fetchTemplatesAndMessages(configData.data.items[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch WhatsApp data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTemplatesAndMessages(configId: string) {
    try {
      const [templatesRes, messagesRes] = await Promise.all([
        fetch(`/api/whatsapp?type=templates&configId=${configId}`),
        fetch(`/api/whatsapp?type=messages&configId=${configId}`),
      ]);

      const [templatesData, messagesData] = await Promise.all([
        templatesRes.json(),
        messagesRes.json(),
      ]);

      if (templatesData.success) setTemplates(templatesData.data || []);
      if (messagesData.success) setMessages(messagesData.data || []);
    } catch (error) {
      console.error("Failed to fetch templates/messages:", error);
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
      APPROVED: "success",
      PENDING: "warning",
      REJECTED: "danger",
      SENT: "info",
      DELIVERED: "success",
      READ: "success",
      FAILED: "danger",
    };
    return <Badge variant={colors[status] || "default"}>{status}</Badge>;
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, "success" | "warning" | "info" | "default"> = {
      UTILITY: "info",
      MARKETING: "warning",
      AUTHENTICATION: "default",
    };
    return <Badge variant={colors[category] || "default"}>{category}</Badge>;
  };

  const getQualityBadge = (rating?: string) => {
    const colors: Record<string, "success" | "warning" | "danger"> = {
      GREEN: "success",
      YELLOW: "warning",
      RED: "danger",
    };
    return rating ? <Badge variant={colors[rating] || "default"}>{rating}</Badge> : null;
  };

  // Pre-defined templates for logistics
  const templateSuggestions = [
    { useCase: "SHIPMENT_BOOKED", name: "Order Confirmed", body: "Hi {{1}}, your order has been confirmed. AWB: {{2}}. Track at: {{3}}" },
    { useCase: "OUT_FOR_DELIVERY", name: "Out for Delivery", body: "Hi {{1}}, your package {{2}} is out for delivery. Expected by {{3}}." },
    { useCase: "DELIVERED", name: "Delivered", body: "Hi {{1}}, your package {{2}} has been delivered successfully. Thank you!" },
    { useCase: "NDR", name: "Delivery Attempt Failed", body: "Hi {{1}}, we tried delivering {{2}} but couldn't reach you. Please reschedule: {{3}}" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-green-500" />
            WhatsApp Business
          </h1>
          <p className="text-muted-foreground">Send shipment updates via WhatsApp</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />Refresh
          </Button>
          <Button><Plus className="mr-2 h-4 w-4" />Add Account</Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Accounts</CardTitle>
            <MessageCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{configs.length}</div>
            <p className="text-xs text-muted-foreground">WhatsApp Business accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Templates</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates.length}</div>
            <p className="text-xs text-muted-foreground">
              {templates.filter(t => t.status === "APPROVED").length} approved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sent Today</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {messages.filter(m => new Date(m.sentAt || 0).toDateString() === new Date().toDateString()).length}
            </div>
            <p className="text-xs text-muted-foreground">Messages sent</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {messages.length > 0
                ? ((messages.filter(m => m.status === "DELIVERED" || m.status === "READ").length / messages.length) * 100).toFixed(1)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Messages delivered</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {["overview", "templates", "messages", "settings"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              activeTab === tab ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Connected Accounts */}
          <Card>
            <CardHeader>
              <CardTitle>Connected Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center text-muted-foreground">Loading...</div>
              ) : configs.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p>No WhatsApp accounts connected</p>
                  <Button variant="outline" className="mt-4">Connect Account</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {configs.map((config) => (
                    <div key={config.id} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-5 w-5 text-green-500" />
                          <span className="font-medium">{config.businessName}</span>
                        </div>
                        <Badge variant={config.isVerified ? "success" : "warning"}>
                          {config.isVerified ? "Verified" : "Pending"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <div>{config.displayPhoneNumber}</div>
                        <div className="flex items-center gap-4 mt-2">
                          <span>Quality: {getQualityBadge(config.qualityRating) || "-"}</span>
                          <span>Limit: {config.messagingLimit || "Standard"}</span>
                        </div>
                        <div className="mt-2">
                          {config._count.templates} templates • {config._count.messages} messages
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Template Suggestions */}
          <Card>
            <CardHeader>
              <CardTitle>Recommended Templates</CardTitle>
              <p className="text-sm text-muted-foreground">Pre-built templates for logistics</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {templateSuggestions.map((template, idx) => (
                  <div key={idx} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{template.name}</span>
                      <Badge variant="info">{template.useCase}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{template.body}</p>
                    <Button size="sm" variant="outline" className="mt-2">
                      Use Template
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "templates" && (
        <Card>
          <CardHeader>
            <CardTitle>Message Templates</CardTitle>
            <p className="text-sm text-muted-foreground">WhatsApp message templates for notifications</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : templates.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No templates configured</p>
                <Button variant="outline" className="mt-4">Create First Template</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left font-medium">Template Name</th>
                      <th className="px-4 py-2 text-left font-medium">Category</th>
                      <th className="px-4 py-2 text-left font-medium">Use Case</th>
                      <th className="px-4 py-2 text-left font-medium">Variables</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                      <th className="px-4 py-2 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((template) => (
                      <tr key={template.id} className="border-b">
                        <td className="px-4 py-2">
                          <div className="font-medium">{template.templateName}</div>
                          <div className="text-xs text-muted-foreground">{template.language}</div>
                        </td>
                        <td className="px-4 py-2">{getCategoryBadge(template.category)}</td>
                        <td className="px-4 py-2">{template.useCase || "-"}</td>
                        <td className="px-4 py-2">{template.variableCount}</td>
                        <td className="px-4 py-2">{getStatusBadge(template.status)}</td>
                        <td className="px-4 py-2">
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "messages" && (
        <Card>
          <CardHeader>
            <CardTitle>Message History</CardTitle>
            <p className="text-sm text-muted-foreground">Recent WhatsApp messages sent</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : messages.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Send className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No messages sent yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left font-medium">Recipient</th>
                      <th className="px-4 py-2 text-left font-medium">Template</th>
                      <th className="px-4 py-2 text-left font-medium">AWB</th>
                      <th className="px-4 py-2 text-left font-medium">Sent At</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messages.map((msg) => (
                      <tr key={msg.id} className="border-b">
                        <td className="px-4 py-2">
                          <div className="font-medium">{msg.recipientName || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground">{msg.recipientPhone}</div>
                        </td>
                        <td className="px-4 py-2">{msg.templateName || msg.template?.templateName || "-"}</td>
                        <td className="px-4 py-2 font-mono text-xs">{msg.awbNumber || "-"}</td>
                        <td className="px-4 py-2">
                          {msg.sentAt ? new Date(msg.sentAt).toLocaleString() : "-"}
                        </td>
                        <td className="px-4 py-2">
                          {getStatusBadge(msg.status)}
                          {msg.readAt && (
                            <div className="text-xs text-muted-foreground">
                              Read: {new Date(msg.readAt).toLocaleTimeString()}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "settings" && (
        <Card>
          <CardHeader>
            <CardTitle>WhatsApp Settings</CardTitle>
            <p className="text-sm text-muted-foreground">Configure WhatsApp Business API settings</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="font-medium mb-2">Auto-Notification Rules</h3>
                <div className="space-y-2">
                  {[
                    { event: "Order Confirmed", enabled: true },
                    { event: "Out for Delivery", enabled: true },
                    { event: "Delivered", enabled: true },
                    { event: "Delivery Failed (NDR)", enabled: true },
                    { event: "RTO Initiated", enabled: false },
                  ].map((rule) => (
                    <div key={rule.event} className="flex items-center justify-between rounded-lg border p-3">
                      <span>{rule.event}</span>
                      <Badge variant={rule.enabled ? "success" : "default"}>
                        {rule.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Quiet Hours</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Don't send messages during these hours
                </p>
                <div className="flex gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">From</label>
                    <Input type="time" defaultValue="22:00" className="w-32" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">To</label>
                    <Input type="time" defaultValue="08:00" className="w-32" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
