"use client";

import { useState } from "react";
import {
  Package,
  AlertTriangle,
  TrendingDown,
  Search,
  Filter,
  Download,
  MapPin,
} from "lucide-react";

interface StockItem {
  id: string;
  skuCode: string;
  skuName: string;
  category: string;
  location: string;
  totalStock: number;
  availableStock: number;
  reservedStock: number;
  reorderLevel: number;
  status: "healthy" | "low" | "critical" | "out_of_stock";
  lastUpdated: string;
}

const mockStock: StockItem[] = [
  {
    id: "1",
    skuCode: "SKU-001",
    skuName: "Premium Cotton T-Shirt",
    category: "Apparel",
    location: "Mumbai Warehouse",
    totalStock: 500,
    availableStock: 420,
    reservedStock: 80,
    reorderLevel: 100,
    status: "healthy",
    lastUpdated: "2024-01-18T10:30:00",
  },
  {
    id: "2",
    skuCode: "SKU-002",
    skuName: "Wireless Earbuds Pro",
    category: "Electronics",
    location: "Delhi Hub",
    totalStock: 85,
    availableStock: 45,
    reservedStock: 40,
    reorderLevel: 50,
    status: "low",
    lastUpdated: "2024-01-18T09:15:00",
  },
  {
    id: "3",
    skuCode: "SKU-003",
    skuName: "Organic Face Cream",
    category: "Beauty",
    location: "Bangalore Center",
    totalStock: 20,
    availableStock: 8,
    reservedStock: 12,
    reorderLevel: 30,
    status: "critical",
    lastUpdated: "2024-01-18T11:00:00",
  },
  {
    id: "4",
    skuCode: "SKU-004",
    skuName: "Running Shoes Elite",
    category: "Footwear",
    location: "Mumbai Warehouse",
    totalStock: 0,
    availableStock: 0,
    reservedStock: 0,
    reorderLevel: 25,
    status: "out_of_stock",
    lastUpdated: "2024-01-17T15:45:00",
  },
  {
    id: "5",
    skuCode: "SKU-005",
    skuName: "Smart Watch Series 5",
    category: "Electronics",
    location: "Chennai Warehouse",
    totalStock: 150,
    availableStock: 120,
    reservedStock: 30,
    reorderLevel: 40,
    status: "healthy",
    lastUpdated: "2024-01-18T08:00:00",
  },
];

const statusConfig = {
  healthy: { label: "Healthy", color: "bg-green-100 text-green-700" },
  low: { label: "Low Stock", color: "bg-yellow-100 text-yellow-700" },
  critical: { label: "Critical", color: "bg-orange-100 text-orange-700" },
  out_of_stock: { label: "Out of Stock", color: "bg-red-100 text-red-700" },
};

export default function StockLevelsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");

  const locations = [...new Set(mockStock.map((s) => s.location))];

  const filteredStock = mockStock.filter((item) => {
    const matchesSearch =
      item.skuCode.toLowerCase().includes(search.toLowerCase()) ||
      item.skuName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;
    const matchesLocation =
      locationFilter === "all" || item.location === locationFilter;
    return matchesSearch && matchesStatus && matchesLocation;
  });

  const statusCounts = {
    healthy: mockStock.filter((s) => s.status === "healthy").length,
    low: mockStock.filter((s) => s.status === "low").length,
    critical: mockStock.filter((s) => s.status === "critical").length,
    out_of_stock: mockStock.filter((s) => s.status === "out_of_stock").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Levels</h1>
          <p className="text-gray-600">Monitor inventory across all locations</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total SKUs</p>
              <p className="text-2xl font-bold">{mockStock.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Low Stock</p>
              <p className="text-2xl font-bold text-yellow-600">
                {statusCounts.low}
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Critical</p>
              <p className="text-2xl font-bold text-orange-600">
                {statusCounts.critical}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Out of Stock</p>
              <p className="text-2xl font-bold text-red-600">
                {statusCounts.out_of_stock}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Table */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-4 border-b flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by SKU code or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="healthy">Healthy</option>
            <option value="low">Low Stock</option>
            <option value="critical">Critical</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Locations</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-600">
                  SKU
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">
                  Location
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">
                  Total Stock
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">
                  Available
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">
                  Reserved
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">
                  Reorder Level
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStock.map((item) => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div>
                      <p className="font-medium text-gray-900">{item.skuCode}</p>
                      <p className="text-sm text-gray-500">{item.skuName}</p>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <MapPin className="w-4 h-4" />
                      {item.location}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right font-medium">
                    {item.totalStock.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-right font-medium text-green-600">
                    {item.availableStock.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-right font-medium text-blue-600">
                    {item.reservedStock.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-right text-gray-500">
                    {item.reorderLevel.toLocaleString()}
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        statusConfig[item.status].color
                      }`}
                    >
                      {statusConfig[item.status].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredStock.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No stock items found matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
}
