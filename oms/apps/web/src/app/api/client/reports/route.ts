import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/client/reports - Generate reports for client portal
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const report = searchParams.get("report");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const format = searchParams.get("format") || "csv";

    if (!report || !dateFrom || !dateTo) {
      return NextResponse.json(
        { error: "Report type, dateFrom, and dateTo are required" },
        { status: 400 }
      );
    }

    const startDate = new Date(dateFrom);
    const endDate = new Date(dateTo);
    endDate.setHours(23, 59, 59, 999);

    const companyId = session.user.companyId;

    let csvContent = "";
    let filename = "";

    switch (report) {
      case "sales": {
        const orders = await prisma.order.findMany({
          where: {
            orderDate: { gte: startDate, lte: endDate },
            ...(companyId ? { Location: { companyId } } : {}),
          },
          include: {
            OrderItem: { include: { SKU: true } },
            Location: true,
          },
          orderBy: { orderDate: "desc" },
        });

        const headers = [
          "Order No",
          "Order Date",
          "Channel",
          "Payment Mode",
          "Status",
          "Customer Name",
          "Subtotal",
          "Tax",
          "Discount",
          "Total Amount",
          "Location",
        ];

        const rows = orders.map((o) => [
          o.orderNo,
          new Date(o.orderDate).toISOString().split("T")[0],
          o.channel,
          o.paymentMode,
          o.status,
          o.customerName,
          o.subtotal,
          o.taxAmount,
          o.discount,
          o.totalAmount,
          o.Location.name,
        ]);

        csvContent = [
          headers.join(","),
          ...rows.map((row) =>
            row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
          ),
        ].join("\n");

        filename = `sales-report-${dateFrom}-to-${dateTo}.csv`;
        break;
      }

      case "sku-sales": {
        const orders = await prisma.order.findMany({
          where: {
            orderDate: { gte: startDate, lte: endDate },
            ...(companyId ? { Location: { companyId } } : {}),
          },
          include: {
            OrderItem: { include: { SKU: true } },
          },
        });

        const skuSales = new Map<
          string,
          {
            code: string;
            name: string;
            category: string;
            qty: number;
            amount: number;
          }
        >();

        orders.forEach((o) => {
          o.OrderItem.forEach((item) => {
            const existing = skuSales.get(item.skuId) || {
              code: item.SKU.code,
              name: item.SKU.name,
              category: item.SKU.category || "",
              qty: 0,
              amount: 0,
            };
            skuSales.set(item.skuId, {
              ...existing,
              qty: existing.qty + item.quantity,
              amount: existing.amount + Number(item.totalPrice),
            });
          });
        });

        const headers = ["SKU Code", "SKU Name", "Category", "Quantity Sold", "Total Amount"];
        const rows = Array.from(skuSales.values())
          .sort((a, b) => b.amount - a.amount)
          .map((s) => [s.code, s.name, s.category, s.qty, s.amount]);

        csvContent = [
          headers.join(","),
          ...rows.map((row) =>
            row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
          ),
        ].join("\n");

        filename = `sku-sales-report-${dateFrom}-to-${dateTo}.csv`;
        break;
      }

      case "inventory": {
        const inventory = await prisma.inventory.findMany({
          where: {
            quantity: { gt: 0 },
            ...(companyId ? { Location: { companyId } } : {}),
          },
          include: {
            SKU: true,
            Bin: { include: { Zone: true } },
            Location: true,
          },
        });

        const headers = [
          "SKU Code",
          "SKU Name",
          "Location",
          "Zone",
          "Bin",
          "Quantity",
          "Reserved",
          "Available",
          "Batch No",
          "Expiry Date",
        ];

        const rows = inventory.map((inv) => [
          inv.SKU.code,
          inv.SKU.name,
          inv.Location.name,
          inv.Bin?.Zone?.name || "",
          inv.Bin?.code || "",
          inv.quantity,
          inv.reservedQty,
          inv.quantity - inv.reservedQty,
          inv.batchNo || "",
          inv.expiryDate ? new Date(inv.expiryDate).toISOString().split("T")[0] : "",
        ]);

        csvContent = [
          headers.join(","),
          ...rows.map((row) =>
            row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
          ),
        ].join("\n");

        filename = `inventory-report-${dateFrom}-to-${dateTo}.csv`;
        break;
      }

      case "fulfillment": {
        const orders = await prisma.order.findMany({
          where: {
            orderDate: { gte: startDate, lte: endDate },
            ...(companyId ? { Location: { companyId } } : {}),
          },
          include: {
            Delivery: { include: { Transporter: true } },
            Location: true,
          },
          orderBy: { orderDate: "desc" },
        });

        const headers = [
          "Order No",
          "Order Date",
          "Channel",
          "Status",
          "Location",
          "AWB No",
          "Transporter",
          "Ship Date",
          "Delivery Date",
        ];

        const rows = orders.map((o) => {
          const delivery = o.Delivery[0];
          return [
            o.orderNo,
            new Date(o.orderDate).toISOString().split("T")[0],
            o.channel,
            o.status,
            o.Location.name,
            delivery?.awbNo || "",
            delivery?.Transporter?.name || "",
            delivery?.shipDate
              ? new Date(delivery.shipDate).toISOString().split("T")[0]
              : "",
            delivery?.deliveryDate
              ? new Date(delivery.deliveryDate).toISOString().split("T")[0]
              : "",
          ];
        });

        csvContent = [
          headers.join(","),
          ...rows.map((row) =>
            row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
          ),
        ].join("\n");

        filename = `fulfillment-report-${dateFrom}-to-${dateTo}.csv`;
        break;
      }

      case "returns": {
        const returns = await prisma.return.findMany({
          where: {
            initiatedAt: { gte: startDate, lte: endDate },
            ...(companyId ? { Order_Return_orderIdToOrder: { Location: { companyId } } } : {}),
          },
          include: {
            ReturnItem: true,
            Order_Return_orderIdToOrder: true,
          },
          orderBy: { initiatedAt: "desc" },
        });

        // Fetch SKU data for return items
        const returnSkuIds = [...new Set(returns.flatMap((r) => r.ReturnItem.map((i) => i.skuId)))];
        const returnSkus = await prisma.sKU.findMany({
          where: { id: { in: returnSkuIds } },
          select: { id: true, code: true },
        });
        const returnSkuMap = new Map(returnSkus.map((s) => [s.id, s.code]));

        const headers = [
          "Return No",
          "Order No",
          "Return Date",
          "Type",
          "Status",
          "Reason",
          "SKU Codes",
          "Quantity",
          "Refund Amount",
        ];

        const rows = returns.map((r) => [
          r.returnNo,
          r.Order_Return_orderIdToOrder?.orderNo || "",
          new Date(r.initiatedAt).toISOString().split("T")[0],
          r.type,
          r.status,
          r.reason || "",
          r.ReturnItem.map((i) => returnSkuMap.get(i.skuId) || i.skuId).join(";"),
          r.ReturnItem.reduce((sum, i) => sum + i.quantity, 0),
          r.refundAmount || 0,
        ]);

        csvContent = [
          headers.join(","),
          ...rows.map((row) =>
            row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
          ),
        ].join("\n");

        filename = `returns-report-${dateFrom}-to-${dateTo}.csv`;
        break;
      }

      case "dispatch": {
        // Dispatch report - manifested and shipped orders with transporter details
        const deliveries = await prisma.delivery.findMany({
          where: {
            shipDate: { gte: startDate, lte: endDate },
            ...(companyId ? { Order: { Location: { companyId } } } : {}),
          },
          include: {
            Order: {
              include: {
                Location: true,
                OrderItem: { include: { SKU: true } },
              },
            },
            Transporter: true,
            Manifest: true,
          },
          orderBy: { shipDate: "desc" },
        });

        const headers = [
          "AWB No",
          "Order No",
          "Ship Date",
          "Transporter",
          "Manifest No",
          "Vehicle No",
          "Driver Name",
          "Status",
          "Location",
          "Customer Name",
          "Destination City",
          "Destination Pincode",
          "Weight (kg)",
          "COD Amount",
          "Delivery Date",
        ];

        const rows = deliveries.map((d) => {
          const shippingAddr = d.Order.shippingAddress as Record<string, string> | null;
          return [
            d.awbNo || "",
            d.Order.orderNo,
            d.shipDate ? new Date(d.shipDate).toISOString().split("T")[0] : "",
            d.Transporter?.name || "",
            d.Manifest?.manifestNo || "",
            d.Manifest?.vehicleNo || "",
            d.Manifest?.driverName || "",
            d.status,
            d.Order.Location.name,
            d.Order.customerName,
            shippingAddr?.city || "",
            shippingAddr?.pincode || "",
            d.weight || "",
            d.Order.paymentMode === "COD" ? d.Order.totalAmount : 0,
            d.deliveryDate ? new Date(d.deliveryDate).toISOString().split("T")[0] : "",
          ];
        });

        csvContent = [
          headers.join(","),
          ...rows.map((row) =>
            row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
          ),
        ].join("\n");

        filename = `dispatch-report-${dateFrom}-to-${dateTo}.csv`;
        break;
      }

      case "rto": {
        // RTO (Return to Origin) analysis report
        const rtoReturns = await prisma.return.findMany({
          where: {
            type: "RTO",
            initiatedAt: { gte: startDate, lte: endDate },
            ...(companyId ? { Order_Return_orderIdToOrder: { Location: { companyId } } } : {}),
          },
          include: {
            ReturnItem: true,
            Order_Return_orderIdToOrder: {
              include: {
                Location: true,
                Delivery: { include: { Transporter: true } },
              },
            },
          },
          orderBy: { initiatedAt: "desc" },
        });

        // Fetch SKU data for RTO items
        const rtoSkuIds = [...new Set(rtoReturns.flatMap((r) => r.ReturnItem.map((i) => i.skuId)))];
        const rtoSkus = await prisma.sKU.findMany({
          where: { id: { in: rtoSkuIds } },
          select: { id: true, code: true, name: true },
        });
        const rtoSkuMap = new Map(rtoSkus.map((s) => [s.id, s]));

        const headers = [
          "Return No",
          "Order No",
          "Order Date",
          "RTO Initiated Date",
          "Channel",
          "Location",
          "Transporter",
          "AWB No",
          "RTO Reason",
          "Status",
          "SKU Codes",
          "Quantity",
          "Order Amount",
          "Days to RTO",
        ];

        const rows = rtoReturns.map((r) => {
          const delivery = r.Order_Return_orderIdToOrder?.Delivery[0];
          const orderDate = r.Order_Return_orderIdToOrder ? new Date(r.Order_Return_orderIdToOrder.orderDate) : null;
          const rtoDate = new Date(r.initiatedAt);
          const daysToRto = orderDate
            ? Math.ceil((rtoDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24))
            : "";

          return [
            r.returnNo,
            r.Order_Return_orderIdToOrder?.orderNo || "",
            orderDate ? orderDate.toISOString().split("T")[0] : "",
            rtoDate.toISOString().split("T")[0],
            r.Order_Return_orderIdToOrder?.channel || "",
            r.Order_Return_orderIdToOrder?.Location?.name || "",
            delivery?.Transporter?.name || "",
            delivery?.awbNo || "",
            r.reason || "",
            r.status,
            r.ReturnItem.map((i) => rtoSkuMap.get(i.skuId)?.code || i.skuId).join(";"),
            r.ReturnItem.reduce((sum, i) => sum + i.quantity, 0),
            r.Order_Return_orderIdToOrder?.totalAmount || 0,
            daysToRto,
          ];
        });

        csvContent = [
          headers.join(","),
          ...rows.map((row) =>
            row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
          ),
        ].join("\n");

        filename = `rto-report-${dateFrom}-to-${dateTo}.csv`;
        break;
      }

      case "order-lifecycle": {
        // Order lifecycle report - track orders through each stage
        const orders = await prisma.order.findMany({
          where: {
            orderDate: { gte: startDate, lte: endDate },
            ...(companyId ? { Location: { companyId } } : {}),
          },
          include: {
            Location: true,
            Delivery: { include: { Transporter: true } },
            OrderItem: true,
          },
          orderBy: { orderDate: "desc" },
        });

        const headers = [
          "Order No",
          "Channel",
          "Order Date",
          "Order Time",
          "Shipped At",
          "Delivered At",
          "Current Status",
          "Location",
          "Transporter",
          "AWB No",
          "Total Amount",
          "Order to Ship (hrs)",
          "Ship to Deliver (hrs)",
        ];

        const rows = orders.map((o) => {
          const delivery = o.Delivery[0];
          const orderTime = new Date(o.orderDate);
          const shipTime = delivery?.shipDate ? new Date(delivery.shipDate) : null;
          const deliverTime = delivery?.deliveryDate ? new Date(delivery.deliveryDate) : null;

          const orderToShipHrs = shipTime
            ? Math.round((shipTime.getTime() - orderTime.getTime()) / (1000 * 60 * 60))
            : "";
          const shipToDeliverHrs = shipTime && deliverTime
            ? Math.round((deliverTime.getTime() - shipTime.getTime()) / (1000 * 60 * 60))
            : "";

          return [
            o.orderNo,
            o.channel,
            orderTime.toISOString().split("T")[0],
            orderTime.toISOString().split("T")[1].split(".")[0],
            delivery?.shipDate ? new Date(delivery.shipDate).toISOString().replace("T", " ").split(".")[0] : "",
            delivery?.deliveryDate ? new Date(delivery.deliveryDate).toISOString().replace("T", " ").split(".")[0] : "",
            o.status,
            o.Location.name,
            delivery?.Transporter?.name || "",
            delivery?.awbNo || "",
            o.totalAmount,
            orderToShipHrs,
            shipToDeliverHrs,
          ];
        });

        csvContent = [
          headers.join(","),
          ...rows.map((row) =>
            row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
          ),
        ].join("\n");

        filename = `order-lifecycle-report-${dateFrom}-to-${dateTo}.csv`;
        break;
      }

      case "inventory-ageing": {
        // Inventory ageing report - age analysis of stock
        const inventory = await prisma.inventory.findMany({
          where: {
            quantity: { gt: 0 },
            ...(companyId ? { Location: { companyId } } : {}),
          },
          include: {
            SKU: true,
            Bin: { include: { Zone: true } },
            Location: true,
          },
        });

        const now = new Date();

        const headers = [
          "SKU Code",
          "SKU Name",
          "Category",
          "Location",
          "Zone",
          "Bin",
          "Quantity",
          "Received Date",
          "Age (Days)",
          "Age Bucket",
          "Batch No",
          "Expiry Date",
          "Days to Expiry",
          "Expiry Status",
        ];

        const rows = inventory.map((inv) => {
          const receivedDate = inv.createdAt;
          const ageDays = Math.ceil((now.getTime() - receivedDate.getTime()) / (1000 * 60 * 60 * 24));

          let ageBucket = "";
          if (ageDays <= 30) ageBucket = "0-30 days";
          else if (ageDays <= 60) ageBucket = "31-60 days";
          else if (ageDays <= 90) ageBucket = "61-90 days";
          else if (ageDays <= 180) ageBucket = "91-180 days";
          else ageBucket = "180+ days";

          let daysToExpiry: number | string = "";
          let expiryStatus = "";
          if (inv.expiryDate) {
            const expiryDate = new Date(inv.expiryDate);
            daysToExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (daysToExpiry < 0) expiryStatus = "EXPIRED";
            else if (daysToExpiry <= 30) expiryStatus = "EXPIRING SOON";
            else if (daysToExpiry <= 90) expiryStatus = "APPROACHING EXPIRY";
            else expiryStatus = "OK";
          }

          return [
            inv.SKU.code,
            inv.SKU.name,
            inv.SKU.category || "",
            inv.Location.name,
            inv.Bin?.Zone?.name || "",
            inv.Bin?.code || "",
            inv.quantity,
            receivedDate.toISOString().split("T")[0],
            ageDays,
            ageBucket,
            inv.batchNo || "",
            inv.expiryDate ? new Date(inv.expiryDate).toISOString().split("T")[0] : "",
            daysToExpiry,
            expiryStatus,
          ];
        });

        csvContent = [
          headers.join(","),
          ...rows.map((row) =>
            row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
          ),
        ].join("\n");

        filename = `inventory-ageing-report-${dateFrom}-to-${dateTo}.csv`;
        break;
      }

      default:
        return NextResponse.json(
          { error: "Invalid report type" },
          { status: 400 }
        );
    }

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
