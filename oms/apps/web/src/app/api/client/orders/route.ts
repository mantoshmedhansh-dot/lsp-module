import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/client/orders - Get orders for client portal
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const channel = searchParams.get("channel") || "";
    const paymentMode = searchParams.get("paymentMode") || "";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";
    const exportCsv = searchParams.get("export") === "csv";

    // Get user's company ID for filtering
    const companyId = session.user.companyId;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (companyId) {
      where.Location = { companyId };
    }

    if (search) {
      where.OR = [
        { orderNo: { contains: search, mode: "insensitive" } },
        { externalOrderNo: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search } },
        { Delivery: { some: { awbNo: { contains: search } } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (channel) {
      where.channel = channel;
    }

    if (paymentMode) {
      where.paymentMode = paymentMode;
    }

    if (dateFrom || dateTo) {
      where.orderDate = {};
      if (dateFrom) {
        (where.orderDate as Record<string, Date>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        (where.orderDate as Record<string, Date>).lte = endDate;
      }
    }

    // Get total count
    const totalCount = await prisma.order.count({ where });
    const totalPages = Math.ceil(totalCount / pageSize);

    // If export, get all orders
    if (exportCsv) {
      const allOrders = await prisma.order.findMany({
        where,
        include: {
          OrderItem: { include: { SKU: true } },
          Delivery: true,
          Location: true,
        },
        orderBy: { orderDate: "desc" },
      });

      // Generate CSV
      const headers = [
        "Order No",
        "External Order No",
        "Order Date",
        "Channel",
        "Payment Mode",
        "Status",
        "Customer Name",
        "Customer Phone",
        "Customer Email",
        "SKU Codes",
        "Qty",
        "Subtotal",
        "Tax",
        "Discount",
        "Total Amount",
        "AWB No",
        "Delivery Status",
        "Location",
      ];

      const rows = allOrders.map((order) => [
        order.orderNo,
        order.externalOrderNo || "",
        new Date(order.orderDate).toISOString().split("T")[0],
        order.channel,
        order.paymentMode,
        order.status,
        order.customerName,
        order.customerPhone,
        order.customerEmail || "",
        order.OrderItem.map((i) => i.SKU.code).join(";"),
        order.OrderItem.reduce((sum, i) => sum + i.quantity, 0),
        order.subtotal,
        order.taxAmount,
        order.discount,
        order.totalAmount,
        order.Delivery[0]?.awbNo || "",
        order.Delivery[0]?.status || "",
        order.Location.name,
      ]);

      const csv = [
        headers.join(","),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
        ),
      ].join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // Get paginated orders
    const orders = await prisma.order.findMany({
      where,
      include: {
        OrderItem: {
          include: {
            SKU: { select: { id: true, code: true, name: true } },
          },
        },
        Delivery: {
          select: { id: true, awbNo: true, status: true },
        },
      },
      orderBy: { orderDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return NextResponse.json({
      orders,
      page,
      pageSize,
      totalCount,
      totalPages,
    });
  } catch (error) {
    console.error("Error fetching client orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
