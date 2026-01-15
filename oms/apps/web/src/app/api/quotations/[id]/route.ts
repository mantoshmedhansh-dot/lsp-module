import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/quotations/[id] - Get quotation details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        Customer: {
          include: {
            CustomerGroup: true,
          },
        },
        QuotationItem: {
          include: {
            SKU: {
              select: { id: true, code: true, name: true, barcodes: true },
            },
          },
        },
        Order: {
          select: { id: true, orderNo: true, status: true },
        },
      },
    });

    if (!quotation) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    return NextResponse.json(quotation);
  } catch (error) {
    console.error("Error fetching quotation:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotation" },
      { status: 500 }
    );
  }
}

// PATCH /api/quotations/[id] - Update quotation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: { Customer: true },
    });

    if (!quotation) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    const body = await request.json();
    const { action, validUntil, remarks, specialTerms, rejectionReason, items } = body;

    // Handle status transitions
    if (action) {
      switch (action) {
        case "submit":
          if (quotation.status !== "DRAFT") {
            return NextResponse.json(
              { error: "Only draft quotations can be submitted" },
              { status: 400 }
            );
          }

          const submittedQuotation = await prisma.quotation.update({
            where: { id },
            data: { status: "PENDING_APPROVAL" },
            include: { Customer: true, QuotationItem: { include: { SKU: true } } },
          });
          return NextResponse.json(submittedQuotation);

        case "approve":
          if (quotation.status !== "PENDING_APPROVAL") {
            return NextResponse.json(
              { error: "Only pending quotations can be approved" },
              { status: 400 }
            );
          }

          const approvedQuotation = await prisma.quotation.update({
            where: { id },
            data: {
              status: "APPROVED",
              approvedById: session.user.id,
              approvedAt: new Date(),
            },
            include: { Customer: true, QuotationItem: { include: { SKU: true } } },
          });
          return NextResponse.json(approvedQuotation);

        case "reject":
          if (quotation.status !== "PENDING_APPROVAL") {
            return NextResponse.json(
              { error: "Only pending quotations can be rejected" },
              { status: 400 }
            );
          }

          const rejectedQuotation = await prisma.quotation.update({
            where: { id },
            data: {
              status: "REJECTED",
              rejectionReason,
            },
            include: { Customer: true, QuotationItem: { include: { SKU: true } } },
          });
          return NextResponse.json(rejectedQuotation);

        case "convert":
          if (quotation.status !== "APPROVED") {
            return NextResponse.json(
              { error: "Only approved quotations can be converted to orders" },
              { status: 400 }
            );
          }

          // Check if already converted
          if (quotation.convertedOrderId) {
            return NextResponse.json(
              { error: "Quotation already converted to order" },
              { status: 400 }
            );
          }

          // Convert to order in transaction
          const result = await prisma.$transaction(async (tx) => {
            // Generate order number
            const orderSequence = await tx.sequence.upsert({
              where: { name: "order" },
              update: { currentValue: { increment: 1 } },
              create: { name: "order", prefix: "ORD", currentValue: 1, paddingLength: 8 },
            });
            const orderNo = `${orderSequence.prefix}${String(orderSequence.currentValue).padStart(orderSequence.paddingLength, "0")}`;

            // Get quotation items
            const quotationItems = await tx.quotationItem.findMany({
              where: { quotationId: id },
              include: { SKU: true },
            });

            // Create order
            const order = await tx.order.create({
              data: {
                orderNo,
                channel: "B2B",
                status: "CONFIRMED",
                paymentMode: "CREDIT",
                customerId: quotation.customerId,
                customerName: quotation.Customer.name,
                customerPhone: quotation.Customer.phone,
                shippingAddress: quotation.Customer.billingAddress as object,
                orderDate: new Date(),
                locationId: quotation.Customer.companyId, // Default to company's main location
                paymentTermType: quotation.Customer.paymentTermType,
                paymentTermDays: quotation.Customer.paymentTermDays,
                subtotal: quotation.subtotal,
                taxAmount: quotation.taxAmount,
                discount: quotation.discountAmount,
                totalAmount: quotation.totalAmount,
                OrderItem: {
                  create: quotationItems.map((item) => ({
                    skuId: item.skuId,
                    skuCode: item.SKU.code,
                    skuName: item.SKU.name,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: item.discountAmount,
                    taxAmount: item.taxAmount,
                    totalPrice: item.totalPrice,
                  })),
                },
              },
            });

            // Update quotation
            await tx.quotation.update({
              where: { id },
              data: {
                status: "CONVERTED",
                convertedOrderId: order.id,
                convertedAt: new Date(),
              },
            });

            // Update customer credit if credit is enabled
            if (quotation.Customer.creditEnabled) {
              await tx.customer.update({
                where: { id: quotation.customerId },
                data: {
                  creditUsed: { increment: quotation.totalAmount },
                },
              });

              // Create credit transaction
              const txSequence = await tx.sequence.upsert({
                where: { name: "credit_transaction" },
                update: { currentValue: { increment: 1 } },
                create: { name: "credit_transaction", prefix: "CTX", currentValue: 1, paddingLength: 8 },
              });
              const transactionNo = `${txSequence.prefix}${String(txSequence.currentValue).padStart(txSequence.paddingLength, "0")}`;

              await tx.b2BCreditTransaction.create({
                data: {
                  transactionNo,
                  customerId: quotation.customerId,
                  type: "ORDER_DEBIT",
                  amount: quotation.totalAmount,
                  balanceBefore: quotation.Customer.creditLimit.minus(quotation.Customer.creditUsed),
                  balanceAfter: quotation.Customer.creditLimit.minus(quotation.Customer.creditUsed).minus(quotation.totalAmount),
                  orderId: order.id,
                  quotationId: id,
                  remarks: `Order created from quotation ${quotation.quotationNo}`,
                  createdById: session.user.id,
                },
              });
            }

            return order;
          });

          return NextResponse.json({
            success: true,
            order: result,
            message: "Quotation converted to order successfully",
          });

        case "cancel":
          if (["CONVERTED", "CANCELLED", "EXPIRED"].includes(quotation.status)) {
            return NextResponse.json(
              { error: "Cannot cancel this quotation" },
              { status: 400 }
            );
          }

          const cancelledQuotation = await prisma.quotation.update({
            where: { id },
            data: { status: "CANCELLED" },
            include: { Customer: true, QuotationItem: { include: { SKU: true } } },
          });
          return NextResponse.json(cancelledQuotation);

        default:
          return NextResponse.json(
            { error: `Unknown action: ${action}` },
            { status: 400 }
          );
      }
    }

    // Regular update (only for DRAFT quotations)
    if (quotation.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft quotations can be edited" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (validUntil !== undefined) updateData.validUntil = new Date(validUntil);
    if (remarks !== undefined) updateData.remarks = remarks;
    if (specialTerms !== undefined) updateData.specialTerms = specialTerms;

    // Update items if provided
    if (items && Array.isArray(items)) {
      await prisma.$transaction(async (tx) => {
        // Delete existing items
        await tx.quotationItem.deleteMany({ where: { quotationId: id } });

        // Calculate new totals
        let subtotal = 0;
        let taxAmount = 0;
        let discountAmount = 0;

        for (const item of items) {
          const lineTotal = item.quantity * item.unitPrice;
          const lineDiscount = lineTotal * ((item.discountPercent || 0) / 100);
          const lineTaxable = lineTotal - lineDiscount;
          const lineTax = lineTaxable * ((item.taxRate || 18) / 100);

          subtotal += lineTotal;
          discountAmount += lineDiscount;
          taxAmount += lineTax;

          await tx.quotationItem.create({
            data: {
              quotationId: id,
              skuId: item.skuId,
              quantity: item.quantity,
              listPrice: item.unitPrice,
              unitPrice: item.unitPrice,
              discountPercent: item.discountPercent || 0,
              discountAmount: lineDiscount,
              taxPercent: item.taxRate || 18,
              taxAmount: lineTax,
              totalPrice: lineTaxable + lineTax,
            },
          });
        }

        updateData.subtotal = subtotal;
        updateData.discountAmount = discountAmount;
        updateData.taxAmount = taxAmount;
        updateData.totalAmount = subtotal - discountAmount + taxAmount;
      });
    }

    const updatedQuotation = await prisma.quotation.update({
      where: { id },
      data: updateData,
      include: {
        Customer: true,
        QuotationItem: {
          include: { SKU: { select: { id: true, code: true, name: true } } },
        },
      },
    });

    return NextResponse.json(updatedQuotation);
  } catch (error) {
    console.error("Error updating quotation:", error);
    return NextResponse.json(
      { error: "Failed to update quotation" },
      { status: 500 }
    );
  }
}

// DELETE /api/quotations/[id] - Delete quotation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const quotation = await prisma.quotation.findUnique({ where: { id } });

    if (!quotation) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    if (quotation.status === "CONVERTED") {
      return NextResponse.json(
        { error: "Cannot delete converted quotation" },
        { status: 400 }
      );
    }

    // Delete in transaction
    await prisma.$transaction(async (tx) => {
      await tx.quotationItem.deleteMany({ where: { quotationId: id } });
      await tx.quotation.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting quotation:", error);
    return NextResponse.json(
      { error: "Failed to delete quotation" },
      { status: 500 }
    );
  }
}
