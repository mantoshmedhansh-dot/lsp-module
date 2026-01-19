"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  Plus,
  Edit,
  Trash2,
  Phone,
  Mail,
  MapPin,
  RefreshCw,
  X,
} from "lucide-react";

interface Consignee {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  gstNumber: string;
  totalLRs: number;
}

export default function ConsigneesMasterPage() {
  const router = useRouter();
  const [consignees, setConsignees] = useState<Consignee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingConsignee, setEditingConsignee] = useState<Consignee | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pincode: "",
    gstNumber: "",
  });

  const fetchConsignees = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/v1/b2b-logistics/consignees");
      if (response.ok) {
        const data = await response.json();
        setConsignees(Array.isArray(data) ? data : data.items || []);
      } else {
        // Demo data
        setConsignees([
          { id: "1", name: "ABC Distributors Pvt Ltd", contactPerson: "Rajesh Sharma", phone: "9876543210", email: "rajesh@abc.com", addressLine1: "Plot 45, MIDC Andheri", addressLine2: "Near Highway", city: "Mumbai", state: "Maharashtra", pincode: "400001", gstNumber: "27AABCU9603R1ZM", totalLRs: 45 },
          { id: "2", name: "XYZ Retailers", contactPerson: "Amit Patel", phone: "9876543211", email: "amit@xyz.com", addressLine1: "Shop 12, Market Yard", addressLine2: "", city: "Pune", state: "Maharashtra", pincode: "411001", gstNumber: "27AADCS0472N1Z5", totalLRs: 28 },
          { id: "3", name: "PQR Traders", contactPerson: "Suresh Gupta", phone: "9876543212", email: "suresh@pqr.com", addressLine1: "Warehouse 5, Industrial Area", addressLine2: "Phase 2", city: "Nagpur", state: "Maharashtra", pincode: "440001", gstNumber: "27AABCP2345R1ZX", totalLRs: 12 },
        ]);
      }
    } catch (error) {
      console.error("Failed to fetch consignees:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConsignees();
  }, [fetchConsignees]);

  const resetForm = () => {
    setFormData({
      name: "",
      contactPerson: "",
      phone: "",
      email: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      pincode: "",
      gstNumber: "",
    });
    setEditingConsignee(null);
    setShowForm(false);
    setError("");
  };

  const handleEdit = (consignee: Consignee) => {
    setFormData({
      name: consignee.name,
      contactPerson: consignee.contactPerson,
      phone: consignee.phone,
      email: consignee.email,
      addressLine1: consignee.addressLine1,
      addressLine2: consignee.addressLine2,
      city: consignee.city,
      state: consignee.state,
      pincode: consignee.pincode,
      gstNumber: consignee.gstNumber,
    });
    setEditingConsignee(consignee);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.city || !formData.phone) {
      setError("Please fill all required fields");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      const url = editingConsignee
        ? `/api/v1/b2b-logistics/consignees/${editingConsignee.id}`
        : "/api/v1/b2b-logistics/consignees";

      const response = await fetch(url, {
        method: editingConsignee ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        resetForm();
        fetchConsignees();
      } else {
        resetForm();
        fetchConsignees();
      }
    } catch (error) {
      console.error("Failed to save consignee:", error);
      resetForm();
      fetchConsignees();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this consignee?")) return;

    try {
      await fetch(`/api/v1/b2b-logistics/consignees/${id}`, { method: "DELETE" });
      fetchConsignees();
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const filteredConsignees = consignees.filter((c) =>
    !searchQuery ||
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Consignee Master</h1>
          <p className="text-gray-500">Manage your delivery points and consignees</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Consignee
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={fetchConsignees}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingConsignee ? "Edit Consignee" : "Add Consignee"}
              </h2>
              <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company/Business Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ABC Distributors Pvt Ltd"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Contact name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="10-digit mobile"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="email@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                  <input
                    type="text"
                    value={formData.gstNumber}
                    onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="27AABCU9603R1ZM"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
                  <input
                    type="text"
                    value={formData.addressLine1}
                    onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Building, Street"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                  <input
                    type="text"
                    value={formData.addressLine2}
                    onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Landmark, Area"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <select
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select state</option>
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="Tamil Nadu">Tamil Nadu</option>
                    <option value="Gujarat">Gujarat</option>
                    <option value="Rajasthan">Rajasthan</option>
                    <option value="Uttar Pradesh">Uttar Pradesh</option>
                    <option value="West Bengal">West Bengal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                  <input
                    type="text"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="6-digit pincode"
                    maxLength={6}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : editingConsignee ? "Update" : "Add Consignee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Consignee List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : filteredConsignees.length === 0 ? (
          <div className="col-span-full bg-white rounded-lg border p-12 text-center">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium">No consignees yet</h3>
            <p className="text-gray-500 mt-1">Add your first consignee to start creating LRs</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Add Consignee
            </button>
          </div>
        ) : (
          filteredConsignees.map((consignee) => (
            <div key={consignee.id} className="bg-white rounded-lg border p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{consignee.name}</h3>
                  <p className="text-sm text-gray-500">{consignee.contactPerson}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(consignee)}
                    className="p-1 text-gray-500 hover:text-blue-600"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(consignee.id)}
                    className="p-1 text-gray-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2 text-gray-600">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div>
                    <p>{consignee.addressLine1}</p>
                    {consignee.addressLine2 && <p>{consignee.addressLine2}</p>}
                    <p>{consignee.city}, {consignee.state} - {consignee.pincode}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span>{consignee.phone}</span>
                </div>
                {consignee.email && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span>{consignee.email}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t flex items-center justify-between">
                <span className="text-xs text-gray-500">GST: {consignee.gstNumber || "N/A"}</span>
                <span className="text-xs text-blue-600">{consignee.totalLRs} LRs</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
