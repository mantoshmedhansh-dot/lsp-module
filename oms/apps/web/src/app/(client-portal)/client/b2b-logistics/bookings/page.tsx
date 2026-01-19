"use client";

import { useRouter } from "next/navigation";
import { Package, Truck, ArrowRight, Clock, CheckCircle } from "lucide-react";

export default function BookingsPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Book Shipment</h1>
        <p className="text-gray-500">Choose your shipment type</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LTL Booking */}
        <div
          onClick={() => router.push("/client/b2b-logistics/bookings/ltl")}
          className="bg-white rounded-lg border p-6 hover:border-blue-500 hover:shadow-lg cursor-pointer transition-all"
        >
          <div className="flex items-start gap-4">
            <div className="p-4 bg-blue-100 rounded-lg">
              <Package className="h-8 w-8 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold mb-2">LTL Shipment</h3>
              <p className="text-gray-500 text-sm mb-4">
                Less than Truck Load - Share truck space with other shipments for cost-effective delivery
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Ideal for 100kg - 5000kg shipments
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Cost-effective for partial loads
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Transit time: 3-7 days
                </div>
              </div>
            </div>
            <ArrowRight className="h-6 w-6 text-gray-400" />
          </div>
        </div>

        {/* FTL Booking */}
        <div
          onClick={() => router.push("/client/b2b-logistics/bookings/ftl")}
          className="bg-white rounded-lg border p-6 hover:border-green-500 hover:shadow-lg cursor-pointer transition-all"
        >
          <div className="flex items-start gap-4">
            <div className="p-4 bg-green-100 rounded-lg">
              <Truck className="h-8 w-8 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold mb-2">FTL Shipment</h3>
              <p className="text-gray-500 text-sm mb-4">
                Full Truck Load - Dedicated vehicle for your shipment with faster delivery
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Ideal for 5000kg+ shipments
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Dedicated vehicle, no sharing
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="h-4 w-4 text-green-500" />
                  Transit time: 1-3 days
                </div>
              </div>
            </div>
            <ArrowRight className="h-6 w-6 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Recent Bookings */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Recent Bookings</h2>
        </div>
        <div className="p-4">
          <p className="text-center text-gray-500 py-8">
            Your recent bookings will appear here
          </p>
        </div>
      </div>
    </div>
  );
}
