"use client";

export default function ClientPortalHomePage() {
  // Use environment variables for URLs (with fallbacks for local dev)
  const omsUrl = process.env.NEXT_PUBLIC_OMS_URL || "http://localhost:3000";
  const b2bUrl = process.env.NEXT_PUBLIC_B2B_URL || "http://localhost:3001";
  const b2cUrl = process.env.NEXT_PUBLIC_B2C_URL || "http://localhost:3002";

  const modules = [
    {
      name: "OMS + WMS",
      description: "Order Management & Warehouse Management System",
      icon: "📦",
      color: "from-purple-600 to-purple-800",
      url: omsUrl,
      features: ["Order Management", "Wave Planning", "Inventory Control", "WMS Operations"],
    },
    {
      name: "B2C Courier",
      description: "Direct-to-Consumer Parcel Delivery Services",
      icon: "🚚",
      color: "from-green-600 to-green-800",
      url: b2cUrl,
      features: ["Shipment Creation", "NDR Management", "COD Reconciliation", "Tracking"],
    },
    {
      name: "B2B Logistics",
      description: "B2B Freight Transport Services (FTL/PTL)",
      icon: "🏭",
      color: "from-blue-600 to-blue-800",
      url: b2bUrl,
      features: ["FTL Bookings", "LTL/PTL Bookings", "LR Management", "Consignees"],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <header className="py-8 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            CJDQuick
          </h1>
          <p className="text-lg text-slate-300">
            Choose your service to continue
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 pb-12">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {modules.map((module) => (
              <a
                key={module.name}
                href={module.url}
                className={`
                  relative overflow-hidden rounded-2xl p-6
                  bg-gradient-to-br ${module.color}
                  hover:scale-105 transition-transform duration-300
                  shadow-xl hover:shadow-2xl
                  cursor-pointer
                `}
              >
                {/* Icon */}
                <div className="text-6xl mb-4">{module.icon}</div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-white mb-2">
                  {module.name}
                </h2>

                {/* Description */}
                <p className="text-white/80 mb-4 text-sm">
                  {module.description}
                </p>

                {/* Features */}
                <ul className="space-y-1">
                  {module.features.map((feature) => (
                    <li
                      key={feature}
                      className="text-white/70 text-xs flex items-center gap-2"
                    >
                      <span className="w-1 h-1 bg-white/60 rounded-full"></span>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* Arrow */}
                <div className="absolute bottom-4 right-4 text-white/60">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                </div>
              </a>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-slate-500 text-sm">
        <p>CJDQuick Client Portal</p>
      </footer>
    </div>
  );
}
