/**
 * Invoice Detail API
 *
 * GET /api/invoices/[id] - Get invoice details
 * GET /api/invoices/[id]?format=pdf - Download invoice PDF
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@oms/database';
import { createInvoiceService } from '@/lib/services/invoice-service';
import PDFDocument from 'pdfkit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = session.user.companyId;

    if (!companyId) {
      return NextResponse.json({ error: 'Company not found' }, { status: 400 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');

    // Get delivery with invoice details
    const delivery = await prisma.delivery.findFirst({
      where: {
        OR: [
          { id },
          { invoiceNo: id },
        ],
        order: {
          location: {
            companyId,
          },
        },
      },
      include: {
        order: {
          include: {
            items: {
              include: {
                sku: true,
              },
            },
            location: {
              include: {
                company: true,
              },
            },
          },
        },
      },
    });

    if (!delivery || !delivery.invoiceNo) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // If PDF format requested
    if (format === 'pdf') {
      const invoiceService = createInvoiceService(companyId);
      const result = await invoiceService.generateInvoice({
        orderId: delivery.orderId,
        deliveryId: delivery.id,
      });

      if (!result.success || !result.invoiceData) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      const pdfBuffer = await generateGSTInvoicePDF(result.invoiceData);

      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="invoice_${delivery.invoiceNo}.pdf"`,
        },
      });
    }

    // Return JSON data
    const invoiceService = createInvoiceService(companyId);
    const result = await invoiceService.generateInvoice({
      orderId: delivery.orderId,
      deliveryId: delivery.id,
    });

    return NextResponse.json({
      success: true,
      data: {
        invoiceNo: delivery.invoiceNo,
        invoiceDate: delivery.invoiceDate,
        orderNo: delivery.order.orderNo,
        customerName: delivery.order.customerName,
        awbNo: delivery.awbNo,
        invoiceData: result.invoiceData,
      },
    });
  } catch (error) {
    console.error('Get invoice error:', error);
    return NextResponse.json(
      { error: 'Failed to get invoice' },
      { status: 500 }
    );
  }
}

interface InvoiceData {
  invoiceNo: string;
  invoiceDate: Date;
  invoiceType: string;
  sellerName: string;
  sellerGstin: string;
  sellerAddress: string;
  sellerState: string;
  buyerName: string;
  buyerGstin?: string;
  buyerAddress: string;
  buyerState: string;
  buyerPhone: string;
  orderNo: string;
  orderDate: Date;
  awbNo?: string;
  transporterName?: string;
  items: Array<{
    skuCode: string;
    skuName: string;
    hsnCode: string;
    quantity: number;
    unitPrice: number;
    taxableValue: number;
    gstRate: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalAmount: number;
  }>;
  totalQuantity: number;
  subtotal: number;
  totalTaxableValue: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalGst: number;
  shippingCharges: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string;
  isInterState: boolean;
}

async function generateGSTInvoicePDF(invoiceData: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(16).font('Helvetica-Bold').text(invoiceData.sellerName, { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(invoiceData.sellerAddress, { align: 'center' });
      doc.text(`GSTIN: ${invoiceData.sellerGstin}`, { align: 'center' });

      doc.moveDown();
      doc.fontSize(14).font('Helvetica-Bold').text('TAX INVOICE', { align: 'center' });
      doc.moveDown();

      // Invoice details in box
      const startY = doc.y;
      doc.rect(40, startY, 515, 60).stroke();

      doc.fontSize(9).font('Helvetica');
      doc.text(`Invoice No: ${invoiceData.invoiceNo}`, 50, startY + 10);
      doc.text(`Invoice Date: ${new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN')}`, 50, startY + 25);
      doc.text(`Order No: ${invoiceData.orderNo}`, 50, startY + 40);

      doc.text(`Order Date: ${new Date(invoiceData.orderDate).toLocaleDateString('en-IN')}`, 300, startY + 10);
      if (invoiceData.awbNo) {
        doc.text(`AWB No: ${invoiceData.awbNo}`, 300, startY + 25);
      }
      if (invoiceData.transporterName) {
        doc.text(`Transporter: ${invoiceData.transporterName}`, 300, startY + 40);
      }

      doc.y = startY + 70;

      // Buyer details
      doc.font('Helvetica-Bold').text('Bill To / Ship To:', 50);
      doc.font('Helvetica')
        .text(invoiceData.buyerName)
        .text(invoiceData.buyerAddress)
        .text(`Phone: ${invoiceData.buyerPhone}`);

      if (invoiceData.buyerGstin) {
        doc.text(`GSTIN: ${invoiceData.buyerGstin}`);
      }

      doc.moveDown();

      // Items table
      const tableTop = doc.y;
      const tableLeft = 40;

      // Table header
      doc.font('Helvetica-Bold').fontSize(8);
      doc.rect(tableLeft, tableTop, 515, 18).fillAndStroke('#f0f0f0', '#000');

      doc.fillColor('#000');
      doc.text('S.No', tableLeft + 5, tableTop + 5, { width: 25 });
      doc.text('HSN', tableLeft + 30, tableTop + 5, { width: 40 });
      doc.text('Description', tableLeft + 75, tableTop + 5, { width: 120 });
      doc.text('Qty', tableLeft + 200, tableTop + 5, { width: 30, align: 'right' });
      doc.text('Rate', tableLeft + 235, tableTop + 5, { width: 45, align: 'right' });
      doc.text('Taxable', tableLeft + 285, tableTop + 5, { width: 50, align: 'right' });
      doc.text('GST%', tableLeft + 340, tableTop + 5, { width: 30, align: 'right' });
      doc.text(invoiceData.isInterState ? 'IGST' : 'CGST', tableLeft + 375, tableTop + 5, { width: 40, align: 'right' });
      if (!invoiceData.isInterState) {
        doc.text('SGST', tableLeft + 420, tableTop + 5, { width: 40, align: 'right' });
      }
      doc.text('Total', tableLeft + 465, tableTop + 5, { width: 45, align: 'right' });

      // Table rows
      let y = tableTop + 20;
      doc.font('Helvetica').fontSize(8);

      invoiceData.items.forEach((item, index) => {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }

        doc.text((index + 1).toString(), tableLeft + 5, y, { width: 25 });
        doc.text(item.hsnCode, tableLeft + 30, y, { width: 40 });
        doc.text(item.skuName.substring(0, 25), tableLeft + 75, y, { width: 120 });
        doc.text(item.quantity.toString(), tableLeft + 200, y, { width: 30, align: 'right' });
        doc.text(item.unitPrice.toFixed(2), tableLeft + 235, y, { width: 45, align: 'right' });
        doc.text(item.taxableValue.toFixed(2), tableLeft + 285, y, { width: 50, align: 'right' });
        doc.text(`${item.gstRate}%`, tableLeft + 340, y, { width: 30, align: 'right' });

        if (invoiceData.isInterState) {
          doc.text(item.igstAmount.toFixed(2), tableLeft + 375, y, { width: 40, align: 'right' });
        } else {
          doc.text(item.cgstAmount.toFixed(2), tableLeft + 375, y, { width: 40, align: 'right' });
          doc.text(item.sgstAmount.toFixed(2), tableLeft + 420, y, { width: 40, align: 'right' });
        }

        doc.text(item.totalAmount.toFixed(2), tableLeft + 465, y, { width: 45, align: 'right' });
        y += 15;
      });

      // Draw table border
      doc.rect(tableLeft, tableTop, 515, y - tableTop + 5).stroke();

      y += 15;

      // Totals section
      const totalsX = 380;
      doc.font('Helvetica').fontSize(9);

      doc.text('Taxable Value:', totalsX, y);
      doc.text(invoiceData.totalTaxableValue.toFixed(2), totalsX + 80, y, { align: 'right', width: 70 });

      if (invoiceData.isInterState) {
        y += 15;
        doc.text('IGST:', totalsX, y);
        doc.text(invoiceData.totalIgst.toFixed(2), totalsX + 80, y, { align: 'right', width: 70 });
      } else {
        y += 15;
        doc.text('CGST:', totalsX, y);
        doc.text(invoiceData.totalCgst.toFixed(2), totalsX + 80, y, { align: 'right', width: 70 });

        y += 15;
        doc.text('SGST:', totalsX, y);
        doc.text(invoiceData.totalSgst.toFixed(2), totalsX + 80, y, { align: 'right', width: 70 });
      }

      if (invoiceData.shippingCharges > 0) {
        y += 15;
        doc.text('Shipping:', totalsX, y);
        doc.text(invoiceData.shippingCharges.toFixed(2), totalsX + 80, y, { align: 'right', width: 70 });
      }

      if (invoiceData.roundOff !== 0) {
        y += 15;
        doc.text('Round Off:', totalsX, y);
        doc.text(invoiceData.roundOff.toFixed(2), totalsX + 80, y, { align: 'right', width: 70 });
      }

      y += 20;
      doc.font('Helvetica-Bold');
      doc.text('Grand Total:', totalsX, y);
      doc.text(`Rs. ${invoiceData.grandTotal.toFixed(2)}`, totalsX + 80, y, { align: 'right', width: 70 });

      // Amount in words
      y += 25;
      doc.font('Helvetica').fontSize(9);
      doc.text(`Amount in Words: ${invoiceData.amountInWords}`, 50, y, { width: 450 });

      // Footer
      doc.fontSize(8).text('This is a computer generated invoice', 40, 780, { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
