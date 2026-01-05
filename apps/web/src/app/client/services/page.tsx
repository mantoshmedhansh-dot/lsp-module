"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Layers,
  RefreshCw,
  Zap,
  Truck,
  Package,
  Globe,
  Box,
  CheckCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from "@cjdquick/ui";

interface Service {
  code: string;
  name: string;
  description: string;
  icon: any;
  features: string[];
  status: "ACTIVE" | "INACTIVE" | "PENDING_ACTIVATION";
}

const AVAILABLE_SERVICES: Service[] = [
  {
    code: "NEXT_DAY",
    name: "Next Day Delivery",
    description: "Get next day delivery for urgent shipments across major cities",
    icon: Zap,
    features: ["Same day pickup", "24-hour delivery", "Real-time tracking"],
    status: "INACTIVE",
  },
  {
    code: "INTRACITY",
    name: "Direct Intracity",
    description: "Hire bikes or trucks to deliver goods within the city",
    icon: Truck,
    features: ["Instant booking", "Multiple vehicle options", "Hyperlocal delivery"],
    status: "INACTIVE",
  },
  {
    code: "DOMESTIC_PARCEL",
    name: "Domestic Parcel",
    description: "Deliver faster to the remotest corners of India and get assured 7 day COD remittances",
    icon: Package,
    features: ["Pan-India coverage", "COD support", "7-day remittance"],
    status: "ACTIVE",
  },
  {
    code: "B2B_CARGO",
    name: "Domestic B2B Cargo",
    description: "Join India's fastest, most reliable Part Truck Load cargo service",
    icon: Box,
    features: ["Part truck load", "Bulk shipments", "Hub-to-hub delivery"],
    status: "ACTIVE",
  },
  {
    code: "CROSS_BORDER",
    name: "Cross Border Express",
    description: "Take your business global. Ship your products to across 220+ countries",
    icon: Globe,
    features: ["220+ countries", "Customs clearance", "International tracking"],
    status: "INACTIVE",
  },
  {
    code: "FTL",
    name: "Full Truck Load",
    description: "Book a dedicated truck in just a few clicks to move your goods",
    icon: Truck,
    features: ["Dedicated vehicle", "Direct delivery", "Flexible scheduling"],
    status: "INACTIVE",
  },
];

async function fetchClientServices() {
  const res = await fetch("/api/client/services");
  return res.json();
}

export default function ClientServicesPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["client-services"],
    queryFn: fetchClientServices,
  });

  const activateMutation = useMutation({
    mutationFn: async (serviceCode: string) => {
      const res = await fetch("/api/client/services/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceCode }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-services"] });
    },
  });

  const clientServices = data?.data || [];

  // Merge client services with available services
  const services = AVAILABLE_SERVICES.map((service) => {
    const clientService = clientServices.find(
      (cs: any) => cs.serviceCode === service.code
    );
    return {
      ...service,
      status: clientService?.status || "INACTIVE",
    };
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return { label: "Active", variant: "success", icon: CheckCircle };
      case "PENDING_ACTIVATION":
        return { label: "Pending", variant: "warning", icon: Clock };
      default:
        return { label: "Inactive", variant: "default", icon: null };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logistics Services</h1>
          <p className="text-gray-600">
            Activate and manage your shipping services
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Services Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => {
            const statusConfig = getStatusConfig(service.status);
            const ServiceIcon = service.icon;

            return (
              <Card key={service.code} className="flex flex-col">
                <CardContent className="p-6 flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                      <ServiceIcon className="h-6 w-6 text-primary-600" />
                    </div>
                    {service.status === "ACTIVE" && (
                      <Badge variant="success" size="sm">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </div>

                  <h3 className="font-semibold text-gray-900 mb-2">
                    {service.name}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    {service.description}
                  </p>

                  <ul className="space-y-2 mb-6">
                    {service.features.map((feature, index) => (
                      <li
                        key={index}
                        className="text-sm text-gray-600 flex items-center gap-2"
                      >
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto">
                    {service.status === "ACTIVE" ? (
                      <Button variant="outline" className="w-full" disabled>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Activated
                      </Button>
                    ) : service.status === "PENDING_ACTIVATION" ? (
                      <Button variant="outline" className="w-full" disabled>
                        <Clock className="h-4 w-4 mr-2" />
                        Pending Activation
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => activateMutation.mutate(service.code)}
                        isLoading={activateMutation.isPending}
                      >
                        Activate Now
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Help Section */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Layers className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">
                Need help choosing a service?
              </h3>
              <p className="text-sm text-gray-500">
                Our team can help you select the best shipping solutions for your
                business needs.
              </p>
            </div>
            <Button variant="outline">Contact Sales</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
