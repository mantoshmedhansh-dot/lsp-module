"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Warehouse,
  Plus,
  RefreshCw,
  MapPin,
  Phone,
  CheckCircle,
  XCircle,
  Edit,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from "@cjdquick/ui";

interface Facility {
  id: string;
  name: string;
  code: string;
  address: string;
  pincode: string;
  city: string;
  state: string;
  contactName: string;
  contactPhone: string;
  isActive: boolean;
  createdAt: string;
}

async function fetchFacilities() {
  const res = await fetch("/api/client/warehouses");
  return res.json();
}

export default function ClientFacilitiesPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["client-facilities"],
    queryFn: fetchFacilities,
  });

  const facilities: Facility[] = data?.data || [];
  const activeFacilities = facilities.filter((f) => f.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Facilities</h1>
          <p className="text-gray-600">
            Manage your pickup locations and warehouses
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Link href="/client/facilities/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add New Pickup Location
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Warehouse className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{facilities.length}</p>
              <p className="text-sm text-gray-500">Total Locations</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeFacilities.length}</p>
              <p className="text-sm text-gray-500">Active</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <XCircle className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {facilities.length - activeFacilities.length}
              </p>
              <p className="text-sm text-gray-500">Inactive</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Facilities List */}
      <Card>
        <CardHeader>
          <CardTitle>Pickup Locations</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
            </div>
          ) : facilities.length === 0 ? (
            <div className="text-center py-12">
              <Warehouse className="h-12 w-12 mx-auto text-gray-300" />
              <p className="mt-4 text-gray-500">No pickup locations added yet</p>
              <Link href="/client/facilities/new">
                <Button variant="outline" className="mt-4">
                  Add Your First Location
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Location
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Address
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Contact
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Added On
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {facilities.map((facility) => (
                    <tr key={facility.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">
                            {facility.name}
                          </p>
                          <p className="text-sm text-gray-500">{facility.code}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-gray-900 line-clamp-1">
                              {facility.address}
                            </p>
                            <p className="text-xs text-gray-500">
                              {facility.city}, {facility.state} -{" "}
                              {facility.pincode}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <Phone className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-gray-900">
                              {facility.contactName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {facility.contactPhone}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={facility.isActive ? "success" : "default"}
                          size="sm"
                        >
                          {facility.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(facility.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Link href={`/client/facilities/${facility.id}`}>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
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
