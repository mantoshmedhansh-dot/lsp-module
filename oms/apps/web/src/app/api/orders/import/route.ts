import { NextRequest, NextResponse } from "next/server";
import { prisma, Channel, PaymentMode, ImportStatus } from "@oms/database";
import { auth } from "@/lib/auth";

interface OrderCSVRow {
  order_no: string;
  order_date: string;
  channel?: string;
  payment_mode: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  shipping_address_line1: string;
  shipping_address_line2?: string;
  shipping_city: string;
  shipping_state: string;
  shipping_pincode: string;
  sku_code: string;
  quantity: number;
  unit_price: number;
  tax_amount?: number;
  discount?: number;
  shipping_charges?: number;
  cod_charges?: number;
  external_order_no?: string;
  remarks?: string;
  priority?: number;
}

// POST /api/orders/import - Import orders from CSV
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { locationId, rows, fileName } = body;

    if (!locationId || !rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "Location ID and rows are required" },
        { status: 400 }
      );
    }

    // Generate import number
    const sequence = await prisma.sequence.upsert({
      where: { name: "order_import" },
      update: { currentValue: { increment: 1 } },
      create: { name: "order_import", prefix: "IMP", currentValue: 1 },
    });

    const importNo = `IMP${String(sequence.currentValue).padStart(6, "0")}`;

    // Create import record
    const orderImport = await prisma.orderImport.create({
      data: {
        importNo,
        fileName: fileName || `import_${importNo}.csv`,
        status: "PROCESSING" as ImportStatus,
        totalRows: rows.length,
        locationId,
        importedById: session.user.id!,
        startedAt: new Date(),
      },
    });

    const errors: { row: number; field?: string; message: string }[] = [];
    const createdOrders: string[] = [];

    // Group rows by order number
    const orderGroups = new Map<string, OrderCSVRow[]>();
    rows.forEach((row: OrderCSVRow, index: number) => {
      if (!row.order_no) {
        errors.push({ row: index + 1, field: "order_no", message: "Order number is required" });
        return;
      }
      const existing = orderGroups.get(row.order_no) || [];
      existing.push(row);
      orderGroups.set(row.order_no, existing);
    });

    // Process each order
    for (const [orderNo, orderRows] of orderGroups) {
      try {
        const firstRow = orderRows[0];

        // Validate required fields
        if (!firstRow.customer_name) {
          errors.push({ row: rows.indexOf(firstRow) + 1, field: "customer_name", message: "Customer name is required" });
          continue;
        }

        if (!firstRow.customer_phone || firstRow.customer_phone.length < 10) {
          errors.push({ row: rows.indexOf(firstRow) + 1, field: "customer_phone", message: "Valid phone number is required" });
          continue;
        }

        if (!firstRow.shipping_pincode) {
          errors.push({ row: rows.indexOf(firstRow) + 1, field: "shipping_pincode", message: "Pincode is required" });
          continue;
        }

        // Check if order already exists
        const existingOrder = await prisma.order.findFirst({
          where: {
            OR: [
              { orderNo },
              { externalOrderNo: orderNo },
            ],
          },
        });

        if (existingOrder) {
          errors.push({ row: rows.indexOf(firstRow) + 1, message: `Order ${orderNo} already exists` });
          continue;
        }

        // Validate and get SKUs
        const skuCodes = orderRows.map((r) => r.sku_code);
        const skus = await prisma.sKU.findMany({
          where: { code: { in: skuCodes } },
        });

        const skuMap = new Map(skus.map((s) => [s.code, s]));
        const missingSKUs = skuCodes.filter((code) => !skuMap.has(code));

        if (missingSKUs.length > 0) {
          errors.push({
            row: rows.indexOf(firstRow) + 1,
            field: "sku_code",
            message: `SKUs not found: ${missingSKUs.join(", ")}`,
          });
          continue;
        }

        // Calculate totals
        let subtotal = 0;
        let totalTax = 0;
        let totalDiscount = 0;

        const items = orderRows.map((row) => {
          const sku = skuMap.get(row.sku_code)!;
          const quantity = row.quantity;
          const unitPrice = row.unit_price;
          const taxAmount = row.tax_amount || 0;
          const discount = row.discount || 0;
          const totalPrice = quantity * unitPrice + taxAmount - discount;

          subtotal += quantity * unitPrice;
          totalTax += taxAmount;
          totalDiscount += discount;

          return {
            skuId: sku.id,
            quantity,
            unitPrice,
            taxAmount,
            discount,
            totalPrice,
          };
        });

        const shippingCharges = firstRow.shipping_charges || 0;
        const codCharges = firstRow.cod_charges || 0;
        const totalAmount = subtotal + totalTax + shippingCharges + codCharges - totalDiscount;

        // Generate order number for system
        const orderSequence = await prisma.sequence.upsert({
          where: { name: "order" },
          update: { currentValue: { increment: 1 } },
          create: { name: "order", prefix: "ORD", currentValue: 1 },
        });

        const systemOrderNo = `ORD${String(orderSequence.currentValue).padStart(8, "0")}`;

        // Validate channel
        const channelValue = (firstRow.channel?.toUpperCase() || "MANUAL") as Channel;
        const validChannels = ["AMAZON", "FLIPKART", "MYNTRA", "AJIO", "MEESHO", "SHOPIFY", "WOOCOMMERCE", "WEBSITE", "MANUAL"];
        const channel = validChannels.includes(channelValue) ? channelValue : "MANUAL";

        // Create order
        const order = await prisma.order.create({
          data: {
            orderNo: systemOrderNo,
            externalOrderNo: orderNo,
            channel: channel as Channel,
            paymentMode: (firstRow.payment_mode?.toUpperCase() === "COD" ? "COD" : "PREPAID") as PaymentMode,
            customerName: firstRow.customer_name,
            customerPhone: firstRow.customer_phone,
            customerEmail: firstRow.customer_email,
            shippingAddress: {
              name: firstRow.customer_name,
              phone: firstRow.customer_phone,
              addressLine1: firstRow.shipping_address_line1,
              addressLine2: firstRow.shipping_address_line2,
              city: firstRow.shipping_city,
              state: firstRow.shipping_state,
              pincode: firstRow.shipping_pincode,
              country: "India",
            },
            orderDate: new Date(firstRow.order_date),
            subtotal,
            taxAmount: totalTax,
            shippingCharges,
            discount: totalDiscount,
            codCharges,
            totalAmount,
            locationId,
            importId: orderImport.id,
            csvLineNumber: rows.indexOf(firstRow) + 1,
            dataSourceType: "CSV_IMPORT",
            priority: firstRow.priority || 0,
            remarks: firstRow.remarks,
            OrderItem: {
              create: items,
            },
          },
        });

        createdOrders.push(order.id);
      } catch (orderError) {
        errors.push({
          row: rows.indexOf(orderRows[0]) + 1,
          message: orderError instanceof Error ? orderError.message : "Unknown error",
        });
      }
    }

    // Update import record
    const finalStatus: ImportStatus = errors.length === 0
      ? "COMPLETED"
      : createdOrders.length === 0
        ? "FAILED"
        : "PARTIAL";

    await prisma.orderImport.update({
      where: { id: orderImport.id },
      data: {
        status: finalStatus,
        processedRows: rows.length,
        successCount: createdOrders.length,
        errorCount: errors.length,
        errors: errors.length > 0 ? errors : undefined,
        completedAt: new Date(),
        summary: {
          totalOrders: orderGroups.size,
          createdOrders: createdOrders.length,
          failedOrders: orderGroups.size - createdOrders.length,
        },
      },
    });

    return NextResponse.json({
      success: errors.length === 0,
      importId: orderImport.id,
      importNo,
      status: finalStatus,
      summary: {
        totalRows: rows.length,
        totalOrders: orderGroups.size,
        createdOrders: createdOrders.length,
        failedOrders: errors.length,
      },
      errors: errors.length > 0 ? errors.slice(0, 100) : undefined, // Limit errors in response
    });
  } catch (error) {
    console.error("Error importing orders:", error);
    return NextResponse.json(
      { error: "Failed to import orders" },
      { status: 500 }
    );
  }
}

// GET /api/orders/import - Get import history
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (session.user.locationAccess && session.user.locationAccess.length > 0) {
      where.locationId = { in: session.user.locationAccess };
    }

    const [imports, total] = await Promise.all([
      prisma.orderImport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.orderImport.count({ where }),
    ]);

    return NextResponse.json({
      data: imports,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching imports:", error);
    return NextResponse.json(
      { error: "Failed to fetch imports" },
      { status: 500 }
    );
  }
}
