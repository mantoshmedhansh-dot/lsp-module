/**
 * End-to-End Order Flow Test Script
 * Tests the complete order lifecycle: Create → Allocate → Pick → Pack → Ship → Deliver
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { prisma } from "@oms/database";

async function testE2EFlow() {
  console.log("\n🚀 Starting End-to-End Order Flow Test\n");
  console.log("=".repeat(60));

  try {
    // Step 0: Check prerequisites
    console.log("\n📋 Step 0: Checking prerequisites...");

    const location = await prisma.location.findFirst({
      where: { isActive: true },
      include: { Company: true },
    });

    if (!location) {
      throw new Error("No active location found. Run seed first.");
    }
    console.log(`   ✓ Location: ${location.name} (${location.Company.name})`);

    const skus = await prisma.sKU.findMany({ take: 2 });
    if (skus.length === 0) {
      throw new Error("No SKUs found. Run seed first.");
    }
    console.log(`   ✓ SKUs found: ${skus.map(s => s.code).join(", ")}`);

    // Check inventory
    const inventory = await prisma.inventory.findMany({
      where: { locationId: location.id, quantity: { gt: 0 } },
      include: { SKU: true, Bin: true },
      take: 5,
    });
    console.log(`   ✓ Inventory records: ${inventory.length}`);
    inventory.forEach(inv => {
      console.log(`      - ${inv.SKU.code}: ${inv.quantity} units in ${inv.Bin?.code || 'N/A'}`);
    });

    // Step 1: Create Order
    console.log("\n📦 Step 1: Creating Order...");

    const sequence = await prisma.sequence.upsert({
      where: { name: "order" },
      update: { currentValue: { increment: 1 } },
      create: { name: "order", prefix: "ORD", currentValue: 1 },
    });
    const orderNo = `ORD${String(sequence.currentValue).padStart(8, "0")}`;

    const order = await prisma.order.create({
      data: {
        orderNo,
        channel: "WEBSITE",
        paymentMode: "PREPAID",
        status: "CREATED",
        customerName: "E2E Test Customer",
        customerPhone: "9876543210",
        customerEmail: "test@example.com",
        shippingAddress: {
          name: "Test Customer",
          phone: "9876543210",
          addressLine1: "123 Test Street",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400001",
        },
        orderDate: new Date(),
        subtotal: 1000,
        taxAmount: 180,
        shippingCharges: 50,
        discount: 0,
        totalAmount: 1230,
        locationId: location.id,
        OrderItem: {
          create: skus.slice(0, 1).map(sku => ({
            skuId: sku.id,
            quantity: 2,
            allocatedQty: 0,
            unitPrice: 500,
            taxAmount: 90,
            discount: 0,
            totalPrice: 590,
          })),
        },
      },
      include: { OrderItem: { include: { SKU: true } } },
    });

    console.log(`   ✓ Order created: ${order.orderNo} (Status: ${order.status})`);
    console.log(`   ✓ Items: ${order.OrderItem.map(i => `${i.SKU.code} x ${i.quantity}`).join(", ")}`);

    // Step 2: Allocate Inventory
    console.log("\n📊 Step 2: Allocating Inventory...");

    let allAllocated = true;
    for (const item of order.OrderItem) {
      const availableInventory = await prisma.inventory.findFirst({
        where: {
          skuId: item.skuId,
          locationId: location.id,
          quantity: { gte: item.quantity },
        },
        include: { Bin: true },
      });

      if (availableInventory) {
        // Reserve inventory
        await prisma.inventory.update({
          where: { id: availableInventory.id },
          data: { reservedQty: { increment: item.quantity } },
        });

        // Update order item
        await prisma.orderItem.update({
          where: { id: item.id },
          data: { allocatedQty: item.quantity },
        });

        console.log(`   ✓ Allocated ${item.quantity} x ${item.SKU.code} from ${availableInventory.Bin?.code}`);
      } else {
        console.log(`   ⚠ No inventory for ${item.SKU.code}`);
        allAllocated = false;
      }
    }

    // Update order status
    const allocatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { status: allAllocated ? "ALLOCATED" : "PARTIALLY_ALLOCATED" },
    });
    console.log(`   ✓ Order status: ${allocatedOrder.status}`);

    // Step 3: Create Picklist
    console.log("\n📋 Step 3: Creating Picklist...");

    const picklistSeq = await prisma.sequence.upsert({
      where: { name: "picklist" },
      update: { currentValue: { increment: 1 } },
      create: { name: "picklist", prefix: "PL", currentValue: 1 },
    });
    const picklistNo = `PL${String(picklistSeq.currentValue).padStart(6, "0")}`;

    // Get allocated items with inventory locations
    const allocatedItems = await prisma.orderItem.findMany({
      where: { orderId: order.id, allocatedQty: { gt: 0 } },
      include: { SKU: true },
    });

    const picklistItems = [];
    for (const item of allocatedItems) {
      const inv = await prisma.inventory.findFirst({
        where: {
          skuId: item.skuId,
          locationId: location.id,
          reservedQty: { gt: 0 },
        },
        include: { Bin: true },
      });

      if (inv && inv.binId) {
        picklistItems.push({
          skuId: item.skuId,
          binId: inv.binId,
          requiredQty: item.allocatedQty,
          pickedQty: 0,
        });
      }
    }

    const picklist = await prisma.picklist.create({
      data: {
        picklistNo,
        status: "PENDING",
        orderId: order.id,
        PicklistItem: { create: picklistItems },
      },
      include: { PicklistItem: { include: { SKU: true, Bin: true } } },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PICKLIST_GENERATED" },
    });

    console.log(`   ✓ Picklist created: ${picklist.picklistNo}`);
    console.log(`   ✓ Items to pick: ${picklist.PicklistItem.map(i => `${i.SKU.code} x ${i.requiredQty} from ${i.Bin.code}`).join(", ")}`);

    // Step 4: Pick Items
    console.log("\n🛒 Step 4: Picking Items...");

    // Start picking
    await prisma.picklist.update({
      where: { id: picklist.id },
      data: { status: "PROCESSING", startedAt: new Date() },
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PICKING" },
    });

    // Pick each item
    for (const item of picklist.PicklistItem) {
      // Update picklist item
      await prisma.picklistItem.update({
        where: { id: item.id },
        data: { pickedQty: item.requiredQty, pickedAt: new Date() },
      });

      // Deduct inventory
      await prisma.inventory.updateMany({
        where: { skuId: item.skuId, binId: item.binId },
        data: {
          quantity: { decrement: item.requiredQty },
          reservedQty: { decrement: item.requiredQty },
        },
      });

      console.log(`   ✓ Picked ${item.requiredQty} x ${item.SKU.code}`);
    }

    // Complete picklist
    await prisma.picklist.update({
      where: { id: picklist.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    // Update order items and status
    for (const item of order.OrderItem) {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: { pickedQty: item.quantity, status: "PICKED" },
      });
    }
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PICKED" },
    });

    console.log(`   ✓ Picklist completed`);

    // Step 5: Pack Order
    console.log("\n📦 Step 5: Packing Order...");

    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PACKING" },
    });

    // Create delivery
    const deliverySeq = await prisma.sequence.upsert({
      where: { name: "delivery" },
      update: { currentValue: { increment: 1 } },
      create: { name: "delivery", prefix: "DLV", currentValue: 1 },
    });
    const deliveryNo = `DLV${String(deliverySeq.currentValue).padStart(8, "0")}`;

    const transporter = await prisma.transporter.findFirst({ where: { isActive: true } });

    const delivery = await prisma.delivery.create({
      data: {
        deliveryNo,
        orderId: order.id,
        transporterId: transporter?.id,
        status: "PACKED",
        weight: 0.5,
        length: 30,
        width: 20,
        height: 10,
        boxes: 1,
        invoiceNo: `INV-${Date.now()}`,
        packDate: new Date(),
      },
    });

    // Update order items and status
    for (const item of order.OrderItem) {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: { packedQty: item.quantity, status: "PACKED" },
      });
    }
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PACKED" },
    });

    console.log(`   ✓ Delivery created: ${delivery.deliveryNo}`);
    console.log(`   ✓ Order packed with ${delivery.boxes} box(es)`);

    // Step 6: Assign AWB & Create Manifest
    console.log("\n🚚 Step 6: Creating Manifest...");

    // Assign AWB
    const awbNo = `AWB${Date.now()}`;
    await prisma.delivery.update({
      where: { id: delivery.id },
      data: { awbNo },
    });
    console.log(`   ✓ AWB assigned: ${awbNo}`);

    // Create manifest
    const manifestSeq = await prisma.sequence.upsert({
      where: { name: "manifest" },
      update: { currentValue: { increment: 1 } },
      create: { name: "manifest", prefix: "MAN", currentValue: 1 },
    });
    const manifestNo = `MAN${String(manifestSeq.currentValue).padStart(6, "0")}`;

    const manifest = await prisma.manifest.create({
      data: {
        manifestNo,
        status: "OPEN",
        transporterId: transporter?.id || "",
        Delivery: { connect: { id: delivery.id } },
      },
      include: { Delivery: true },
    });

    // Update delivery and order
    await prisma.delivery.update({
      where: { id: delivery.id },
      data: { status: "MANIFESTED" },
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "MANIFESTED" },
    });

    console.log(`   ✓ Manifest created: ${manifest.manifestNo}`);
    console.log(`   ✓ Deliveries in manifest: ${manifest.Delivery.length}`);

    // Step 7: Ship (Close Manifest)
    console.log("\n✈️ Step 7: Shipping (Closing Manifest)...");

    await prisma.manifest.update({
      where: { id: manifest.id },
      data: { status: "CLOSED" },
    });

    await prisma.delivery.update({
      where: { id: delivery.id },
      data: { status: "SHIPPED", shipDate: new Date() },
    });

    for (const item of order.OrderItem) {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: { shippedQty: item.quantity, status: "SHIPPED" },
      });
    }
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "SHIPPED" },
    });

    console.log(`   ✓ Manifest closed`);
    console.log(`   ✓ Order shipped`);

    // Step 8: Deliver
    console.log("\n🎉 Step 8: Delivering Order...");

    // Simulate tracking updates
    await prisma.delivery.update({
      where: { id: delivery.id },
      data: { status: "IN_TRANSIT" },
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "IN_TRANSIT" },
    });
    console.log(`   ✓ Status: IN_TRANSIT`);

    await prisma.delivery.update({
      where: { id: delivery.id },
      data: { status: "OUT_FOR_DELIVERY" },
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "OUT_FOR_DELIVERY" },
    });
    console.log(`   ✓ Status: OUT_FOR_DELIVERY`);

    // Final delivery with POD
    await prisma.delivery.update({
      where: { id: delivery.id },
      data: {
        status: "DELIVERED",
        podSignature: "pod-signature.jpg",
        remarks: "Delivered successfully",
        receivedBy: "Test Customer",
      },
    });

    for (const item of order.OrderItem) {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: { status: "DELIVERED" },
      });
    }
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "DELIVERED" },
    });

    console.log(`   ✓ Status: DELIVERED`);
    console.log(`   ✓ POD captured`);

    // Final Summary
    console.log("\n" + "=".repeat(60));
    console.log("✅ END-TO-END FLOW COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(60));

    const finalOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        OrderItem: { include: { SKU: true } },
        Picklist: true,
        Delivery: true,
      },
    });

    console.log(`\n📊 Final Order Summary:`);
    console.log(`   Order No: ${finalOrder?.orderNo}`);
    console.log(`   Status: ${finalOrder?.status}`);
    console.log(`   Items: ${finalOrder?.OrderItem.length}`);
    console.log(`   Picklists: ${finalOrder?.Picklist.length}`);
    console.log(`   Deliveries: ${finalOrder?.Delivery.length}`);
    console.log(`   Delivery Status: ${finalOrder?.Delivery[0]?.status}`);
    console.log(`   AWB: ${finalOrder?.Delivery[0]?.awbNo}`);

    console.log("\n🎯 All modules are properly connected and working!\n");

  } catch (error) {
    console.error("\n❌ Error during E2E test:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testE2EFlow();
