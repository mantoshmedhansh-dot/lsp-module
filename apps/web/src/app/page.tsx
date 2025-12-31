import Link from "next/link";
import {
  Package,
  Truck,
  ClipboardCheck,
  Send,
  MapPin,
  CheckCircle,
} from "lucide-react";

const stages = [
  {
    name: "Manifestation",
    description: "Create orders, generate AWB, assign partners",
    icon: Package,
    href: "/orders/manifest",
    color: "bg-blue-500",
  },
  {
    name: "Pick",
    description: "Schedule pickups, warehouse picking",
    icon: ClipboardCheck,
    href: "/orders/pick",
    color: "bg-purple-500",
  },
  {
    name: "Pack",
    description: "Packaging, labeling, weight capture",
    icon: Package,
    href: "/orders/pack",
    color: "bg-indigo-500",
  },
  {
    name: "Dispatch",
    description: "Handover to partner, scan out",
    icon: Send,
    href: "/orders/dispatch",
    color: "bg-orange-500",
  },
  {
    name: "Delivery",
    description: "In-transit tracking, last mile",
    icon: Truck,
    href: "/orders/delivery",
    color: "bg-teal-500",
  },
  {
    name: "POD",
    description: "Proof of delivery - signature, photo, OTP",
    icon: CheckCircle,
    href: "/orders/pod",
    color: "bg-green-500",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-8 w-8 text-primary-600" />
              <span className="text-2xl font-bold text-gray-900">CJDQuick</span>
            </div>
            <nav className="flex items-center gap-6">
              <Link
                href="/dashboard"
                className="text-gray-600 hover:text-gray-900"
              >
                Dashboard
              </Link>
              <Link
                href="/orders"
                className="text-gray-600 hover:text-gray-900"
              >
                Orders
              </Link>
              <Link
                href="/partners"
                className="text-gray-600 hover:text-gray-900"
              >
                Partners
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold mb-4">
            B2B Logistics Aggregator Platform
          </h1>
          <p className="text-xl text-primary-100 max-w-2xl">
            Streamline your logistics operations from manifestation to proof of
            delivery. Aggregate multiple partners, optimize costs, and track
            every shipment in real-time.
          </p>
        </div>
      </section>

      {/* Order Flow Stages */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            Order Lifecycle
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stages.map((stage, index) => (
              <Link
                key={stage.name}
                href={stage.href}
                className="group relative bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg hover:border-primary-300 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`${stage.color} p-3 rounded-lg text-white shrink-0`}
                  >
                    <stage.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-500">
                        Stage {index + 1}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600">
                      {stage.name}
                    </h3>
                    <p className="text-gray-600 mt-1">{stage.description}</p>
                  </div>
                </div>
                {index < stages.length - 1 && (
                  <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 text-gray-300">
                    →
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="bg-white border-t py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600">5+</div>
              <div className="text-gray-600">Logistics Partners</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600">29,000+</div>
              <div className="text-gray-600">Pincodes Covered</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600">98%</div>
              <div className="text-gray-600">On-Time Delivery</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600">&lt;3%</div>
              <div className="text-gray-600">RTO Rate</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
