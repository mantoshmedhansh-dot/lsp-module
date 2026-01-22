"use client";

export default function B2BHomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center">
      <div className="text-center text-white">
        <h1 className="text-5xl font-bold mb-4">CJDQuick B2B Logistics</h1>
        <p className="text-xl mb-8 opacity-80">FTL & PTL Transport Services</p>

        <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 hover:bg-white/20 transition cursor-pointer">
            <div className="text-4xl mb-3">🚚</div>
            <h3 className="text-lg font-semibold">FTL Bookings</h3>
            <p className="text-sm opacity-70">Full Truck Load</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 hover:bg-white/20 transition cursor-pointer">
            <div className="text-4xl mb-3">📦</div>
            <h3 className="text-lg font-semibold">LTL/PTL Bookings</h3>
            <p className="text-sm opacity-70">Part Truck Load</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 hover:bg-white/20 transition cursor-pointer">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="text-lg font-semibold">LR Management</h3>
            <p className="text-sm opacity-70">Lorry Receipts</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 hover:bg-white/20 transition cursor-pointer">
            <div className="text-4xl mb-3">📍</div>
            <h3 className="text-lg font-semibold">Consignees</h3>
            <p className="text-sm opacity-70">Delivery Points</p>
          </div>
        </div>

        <p className="mt-8 text-sm opacity-60">
          Module under development - Port 3001
        </p>
      </div>
    </div>
  );
}
