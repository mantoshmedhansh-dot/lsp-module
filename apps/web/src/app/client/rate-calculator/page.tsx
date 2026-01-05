"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Calculator,
  MapPin,
  Package,
  Truck,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Badge,
} from "@cjdquick/ui";

interface RateResult {
  serviceable: boolean;
  originCity: string;
  destinationCity: string;
  rates: {
    serviceType: string;
    baseRate: number;
    weightCharge: number;
    fuelSurcharge: number;
    totalRate: number;
    estimatedDays: number;
    codAvailable: boolean;
    codCharge: number;
  }[];
  message?: string;
}

export default function RateCalculatorPage() {
  const [originPincode, setOriginPincode] = useState("");
  const [destinationPincode, setDestinationPincode] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [codAmount, setCodAmount] = useState("");

  const calculateMutation = useMutation({
    mutationFn: async (): Promise<{ data: RateResult }> => {
      const params = new URLSearchParams({
        originPincode,
        destinationPincode,
        weightKg,
        ...(codAmount && { codAmount }),
      });
      const res = await fetch(`/api/client/rate-calculator?${params.toString()}`);
      return res.json();
    },
  });

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    calculateMutation.mutate();
  };

  const result = calculateMutation.data?.data;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Serviceability & Rate Calculator
        </h1>
        <p className="text-gray-600">
          Check serviceability and get shipping rates instantly
        </p>
      </div>

      {/* Calculator Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary-600" />
            Calculate Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCalculate} className="space-y-6">
            {/* Pincodes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative">
                <div className="absolute left-3 top-9 w-3 h-3 bg-green-500 rounded-full"></div>
                <Input
                  label="Pickup Pincode"
                  placeholder="Enter origin pincode"
                  value={originPincode}
                  onChange={(e) => setOriginPincode(e.target.value)}
                  maxLength={6}
                  className="pl-8"
                  required
                />
              </div>
              <div className="relative">
                <div className="absolute left-3 top-9 w-3 h-3 bg-red-500 rounded-full"></div>
                <Input
                  label="Delivery Pincode"
                  placeholder="Enter destination pincode"
                  value={destinationPincode}
                  onChange={(e) => setDestinationPincode(e.target.value)}
                  maxLength={6}
                  className="pl-8"
                  required
                />
              </div>
            </div>

            {/* Weight & COD */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Weight (kg)"
                type="number"
                step="0.1"
                placeholder="Enter package weight"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                required
              />
              <Input
                label="COD Amount (optional)"
                type="number"
                placeholder="Enter COD amount if applicable"
                value={codAmount}
                onChange={(e) => setCodAmount(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              isLoading={calculateMutation.isPending}
            >
              <Calculator className="h-4 w-4 mr-2" />
              Calculate Rates
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.serviceable ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              {result.serviceable ? "Service Available" : "Service Not Available"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.serviceable ? (
              <div className="space-y-6">
                {/* Route Info */}
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <MapPin className="h-5 w-5 text-green-600" />
                  <div className="flex-1">
                    <p className="font-medium">{result.originCity}</p>
                    <p className="text-sm text-gray-500">{originPincode}</p>
                  </div>
                  <div className="flex-1 border-t border-dashed border-gray-300 mx-4"></div>
                  <div className="flex-1 text-right">
                    <p className="font-medium">{result.destinationCity}</p>
                    <p className="text-sm text-gray-500">{destinationPincode}</p>
                  </div>
                  <MapPin className="h-5 w-5 text-red-600" />
                </div>

                {/* Rate Options */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">Available Services</h3>
                  {result.rates.map((rate, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-4 hover:border-primary-300 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Truck className="h-5 w-5 text-primary-600" />
                          <div>
                            <p className="font-medium text-gray-900">
                              {rate.serviceType}
                            </p>
                            <p className="text-sm text-gray-500 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {rate.estimatedDays} days delivery
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary-600">
                            ₹{rate.totalRate.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">
                            for {weightKg} kg
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 text-sm">
                        <div className="flex items-center gap-1 text-gray-500">
                          Base: ₹{rate.baseRate.toFixed(2)}
                        </div>
                        <span className="text-gray-300">|</span>
                        <div className="flex items-center gap-1 text-gray-500">
                          Weight: ₹{rate.weightCharge.toFixed(2)}
                        </div>
                        <span className="text-gray-300">|</span>
                        <div className="flex items-center gap-1 text-gray-500">
                          Fuel: ₹{rate.fuelSurcharge.toFixed(2)}
                        </div>
                        {rate.codAvailable && codAmount && (
                          <>
                            <span className="text-gray-300">|</span>
                            <div className="flex items-center gap-1 text-gray-500">
                              COD: ₹{rate.codCharge.toFixed(2)}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex gap-2 mt-3">
                        {rate.codAvailable ? (
                          <Badge variant="success" size="sm">
                            COD Available
                          </Badge>
                        ) : (
                          <Badge variant="default" size="sm">
                            Prepaid Only
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-gray-500 p-3 bg-amber-50 rounded-lg">
                  Note: Rates shown are indicative and may vary based on actual
                  weight, dimensions, and additional charges. Final charges will
                  be calculated at the time of booking.
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 mx-auto text-red-400 mb-4" />
                <p className="text-gray-500">
                  {result.message ||
                    "This route is currently not serviceable. Please contact support for alternatives."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
