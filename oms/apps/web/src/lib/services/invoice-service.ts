/**
 * GST Invoice Service
 *
 * Handles GST-compliant invoice generation for Indian OMS
 * Supports:
 * - CGST/SGST (intra-state) and IGST (inter-state) calculations
 * - HSN code-based tax rates
 * - E-way bill integration
 * - Credit notes for returns
 * - Invoice numbering sequences
 */

import { prisma } from '@oms/database';

// GST Rate by HSN Chapter
const HSN_TAX_RATES: Record<string, number> = {
  // Default rates - actual rates depend on specific HSN codes
  '61': 12, // Articles of apparel (knitted)
  '62': 12, // Articles of apparel (not knitted)
  '63': 12, // Textile articles
  '64': 18, // Footwear
  '65': 18, // Headgear
  '71': 3,  // Jewellery
  '84': 18, // Machinery
  '85': 18, // Electrical machinery
  '90': 18, // Optical/medical instruments
  '94': 18, // Furniture
  '95': 18, // Toys and games
  '96': 18, // Miscellaneous manufactured articles
};

// State codes for GSTIN validation
const STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli, Daman & Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar',
  '36': 'Telangana',
  '37': 'Andhra Pradesh (New)',
};

export interface InvoiceLineItem {
  skuId: string;
  skuCode: string;
  skuName: string;
  hsnCode: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxableValue: number;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

export interface InvoiceData {
  invoiceNo: string;
  invoiceDate: Date;
  invoiceType: 'TAX_INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';

  // Seller details
  sellerName: string;
  sellerGstin: string;
  sellerAddress: string;
  sellerState: string;
  sellerStateCode: string;

  // Buyer details
  buyerName: string;
  buyerGstin?: string;
  buyerAddress: string;
  buyerState: string;
  buyerStateCode: string;
  buyerPhone: string;
  buyerEmail?: string;

  // Order reference
  orderId: string;
  orderNo: string;
  orderDate: Date;

  // Shipment reference
  awbNo?: string;
  transporterName?: string;
  vehicleNo?: string;
  ewayBillNo?: string;

  // Line items
  items: InvoiceLineItem[];

  // Totals
  totalQuantity: number;
  subtotal: number;
  totalDiscount: number;
  totalTaxableValue: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalGst: number;
  shippingCharges: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string;

  // Flags
  isInterState: boolean;
  isReverseCharge: boolean;

  // Linked invoice (for credit notes)
  originalInvoiceNo?: string;
  originalInvoiceDate?: Date;
}

export interface GenerateInvoiceRequest {
  orderId: string;
  deliveryId?: string;
  invoiceType?: 'TAX_INVOICE' | 'CREDIT_NOTE';
  originalInvoiceNo?: string;
}

export interface GenerateInvoiceResponse {
  success: boolean;
  invoiceNo?: string;
  invoiceData?: InvoiceData;
  error?: string;
}

class InvoiceService {
  private companyId: string;

  constructor(companyId: string) {
    this.companyId = companyId;
  }

  /**
   * Generate a GST-compliant invoice
   */
  async generateInvoice(request: GenerateInvoiceRequest): Promise<GenerateInvoiceResponse> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: request.orderId },
        include: {
          OrderItem: {
            include: {
              SKU: true,
            },
          },
          Location: {
            include: {
              Company: true,
            },
          },
          Delivery: {
            where: request.deliveryId ? { id: request.deliveryId } : undefined,
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: {
              Transporter: {
                select: { name: true },
              },
            },
          },
        },
      });

      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      const company = order.Location.Company;
      const delivery = order.Delivery[0];

      // Validate company GST
      if (!company.gst) {
        return { success: false, error: 'Company GSTIN not configured' };
      }

      // Generate invoice number
      const invoiceNo = await this.getNextInvoiceNumber(
        request.invoiceType === 'CREDIT_NOTE' ? 'CN' : 'INV'
      );

      // Determine if inter-state transaction
      const sellerStateCode = company.gst.substring(0, 2);
      const shippingAddress = order.shippingAddress as {
        state?: string;
        pincode?: string;
      };
      const buyerStateCode = this.getStateCodeFromPincode(shippingAddress.pincode || '');
      const isInterState = sellerStateCode !== buyerStateCode;

      // Calculate line items with GST
      const lineItems = this.calculateLineItems(
        order.OrderItem as Array<{
          SKU: { id: string; code: string; name: string; hsn?: string | null };
          quantity: number;
          unitPrice: { toNumber(): number };
          discount: { toNumber(): number };
          totalPrice: { toNumber(): number };
        }>,
        isInterState
      );

      // Calculate totals
      const totals = this.calculateTotals(lineItems, order.shippingCharges.toNumber());

      // Build invoice data
      const companyAddress = company.address as { city?: string; state?: string; pincode?: string } | null;

      const invoiceData: InvoiceData = {
        invoiceNo,
        invoiceDate: new Date(),
        invoiceType: request.invoiceType || 'TAX_INVOICE',

        sellerName: company.legalName || company.name,
        sellerGstin: company.gst,
        sellerAddress: `${companyAddress?.city || ''}, ${companyAddress?.state || ''} - ${companyAddress?.pincode || ''}`,
        sellerState: companyAddress?.state || '',
        sellerStateCode,

        buyerName: order.customerName,
        buyerGstin: undefined, // B2C typically doesn't have GSTIN
        buyerAddress: `${(shippingAddress as { addressLine1?: string }).addressLine1 || ''}, ${(shippingAddress as { city?: string }).city || ''}, ${shippingAddress.state || ''} - ${shippingAddress.pincode || ''}`,
        buyerState: shippingAddress.state || '',
        buyerStateCode,
        buyerPhone: order.customerPhone,
        buyerEmail: order.customerEmail || undefined,

        orderId: order.id,
        orderNo: order.orderNo,
        orderDate: order.orderDate,

        awbNo: delivery?.awbNo || undefined,
        transporterName: delivery?.Transporter?.name || undefined,
        vehicleNo: undefined,
        ewayBillNo: undefined,

        items: lineItems,

        totalQuantity: totals.totalQuantity,
        subtotal: totals.subtotal,
        totalDiscount: totals.totalDiscount,
        totalTaxableValue: totals.totalTaxableValue,
        totalCgst: totals.totalCgst,
        totalSgst: totals.totalSgst,
        totalIgst: totals.totalIgst,
        totalGst: totals.totalGst,
        shippingCharges: order.shippingCharges.toNumber(),
        roundOff: totals.roundOff,
        grandTotal: totals.grandTotal,
        amountInWords: this.numberToWords(totals.grandTotal),

        isInterState,
        isReverseCharge: false,

        originalInvoiceNo: request.originalInvoiceNo,
        originalInvoiceDate: request.invoiceType === 'CREDIT_NOTE' ? new Date() : undefined,
      };

      // Update delivery with invoice details
      if (delivery) {
        await prisma.delivery.update({
          where: { id: delivery.id },
          data: {
            invoiceNo,
            invoiceDate: invoiceData.invoiceDate,
          },
        });
      }

      return {
        success: true,
        invoiceNo,
        invoiceData,
      };
    } catch (error) {
      console.error('Invoice generation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Calculate line items with GST breakdown
   */
  private calculateLineItems(
    items: Array<{
      SKU: { id: string; code: string; name: string; hsn?: string | null };
      quantity: number;
      unitPrice: { toNumber(): number };
      discount: { toNumber(): number };
      totalPrice: { toNumber(): number };
    }>,
    isInterState: boolean
  ): InvoiceLineItem[] {
    return items.map((item) => {
      const hsnCode = item.SKU.hsn || '62';
      const hsnChapter = hsnCode.substring(0, 2);
      const gstRate = HSN_TAX_RATES[hsnChapter] || 18;

      const unitPrice = item.unitPrice.toNumber();
      const discount = item.discount.toNumber();
      const taxableValue = unitPrice * item.quantity - discount;
      const gstAmount = (taxableValue * gstRate) / 100;

      return {
        skuId: item.SKU.id,
        skuCode: item.SKU.code,
        skuName: item.SKU.name,
        hsnCode,
        quantity: item.quantity,
        unitPrice,
        discount,
        taxableValue,
        gstRate,
        cgstAmount: isInterState ? 0 : gstAmount / 2,
        sgstAmount: isInterState ? 0 : gstAmount / 2,
        igstAmount: isInterState ? gstAmount : 0,
        totalAmount: taxableValue + gstAmount,
      };
    });
  }

  /**
   * Calculate invoice totals
   */
  private calculateTotals(
    items: InvoiceLineItem[],
    shippingCharges: number
  ): {
    totalQuantity: number;
    subtotal: number;
    totalDiscount: number;
    totalTaxableValue: number;
    totalCgst: number;
    totalSgst: number;
    totalIgst: number;
    totalGst: number;
    roundOff: number;
    grandTotal: number;
  } {
    const totals = items.reduce(
      (acc, item) => ({
        totalQuantity: acc.totalQuantity + item.quantity,
        subtotal: acc.subtotal + item.unitPrice * item.quantity,
        totalDiscount: acc.totalDiscount + item.discount,
        totalTaxableValue: acc.totalTaxableValue + item.taxableValue,
        totalCgst: acc.totalCgst + item.cgstAmount,
        totalSgst: acc.totalSgst + item.sgstAmount,
        totalIgst: acc.totalIgst + item.igstAmount,
        totalGst: acc.totalGst + item.cgstAmount + item.sgstAmount + item.igstAmount,
      }),
      {
        totalQuantity: 0,
        subtotal: 0,
        totalDiscount: 0,
        totalTaxableValue: 0,
        totalCgst: 0,
        totalSgst: 0,
        totalIgst: 0,
        totalGst: 0,
      }
    );

    const totalBeforeRounding = totals.totalTaxableValue + totals.totalGst + shippingCharges;
    const grandTotal = Math.round(totalBeforeRounding);
    const roundOff = grandTotal - totalBeforeRounding;

    return {
      ...totals,
      roundOff: Math.round(roundOff * 100) / 100,
      grandTotal,
    };
  }

  /**
   * Get next invoice number in sequence
   */
  private async getNextInvoiceNumber(prefix: string): Promise<string> {
    const financialYear = this.getCurrentFinancialYear();
    const sequenceName = `invoice_${prefix}_${this.companyId}_${financialYear}`;

    // Use upsert to atomically get and increment the sequence
    const sequence = await prisma.sequence.upsert({
      where: { name: sequenceName },
      update: { currentValue: { increment: 1 } },
      create: {
        name: sequenceName,
        prefix: prefix,
        currentValue: 1,
        paddingLength: 6,
      },
    });

    return `${prefix}/${financialYear}/${sequence.currentValue.toString().padStart(6, '0')}`;
  }

  /**
   * Get current financial year (April to March)
   */
  private getCurrentFinancialYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    // Financial year starts in April (month 3)
    if (month >= 3) {
      return `${year}-${(year + 1).toString().slice(-2)}`;
    } else {
      return `${year - 1}-${year.toString().slice(-2)}`;
    }
  }

  /**
   * Get state code from pincode
   */
  private getStateCodeFromPincode(pincode: string): string {
    if (!pincode || pincode.length < 2) return '07'; // Default to Delhi

    const firstTwo = pincode.substring(0, 2);
    const pincodeStateMap: Record<string, string> = {
      '11': '07', // Delhi
      '12': '06', // Haryana
      '13': '06', // Haryana
      '14': '03', // Punjab
      '15': '03', // Punjab
      '16': '03', // Punjab
      '17': '02', // Himachal Pradesh
      '18': '01', // J&K
      '19': '01', // J&K
      '20': '09', // UP
      '21': '09', // UP
      '22': '09', // UP
      '23': '09', // UP
      '24': '09', // UP
      '25': '09', // UP
      '26': '05', // Uttarakhand
      '27': '09', // UP
      '28': '09', // UP
      '30': '08', // Rajasthan
      '31': '08', // Rajasthan
      '32': '08', // Rajasthan
      '33': '08', // Rajasthan
      '34': '08', // Rajasthan
      '36': '24', // Gujarat
      '37': '24', // Gujarat
      '38': '24', // Gujarat
      '39': '24', // Gujarat
      '40': '27', // Maharashtra
      '41': '27', // Maharashtra
      '42': '27', // Maharashtra
      '43': '27', // Maharashtra
      '44': '27', // Maharashtra
      '45': '23', // MP
      '46': '23', // MP
      '47': '23', // MP
      '48': '23', // MP
      '49': '22', // Chhattisgarh
      '50': '36', // Telangana
      '51': '36', // Telangana
      '52': '28', // AP
      '53': '28', // AP
      '56': '29', // Karnataka
      '57': '29', // Karnataka
      '58': '29', // Karnataka
      '59': '29', // Karnataka
      '60': '33', // Tamil Nadu
      '61': '33', // Tamil Nadu
      '62': '33', // Tamil Nadu
      '63': '33', // Tamil Nadu
      '64': '33', // Tamil Nadu
      '67': '32', // Kerala
      '68': '32', // Kerala
      '69': '32', // Kerala
      '70': '19', // West Bengal
      '71': '19', // West Bengal
      '72': '19', // West Bengal
      '73': '19', // West Bengal
      '74': '19', // West Bengal
      '75': '21', // Odisha
      '76': '21', // Odisha
      '77': '21', // Odisha
      '78': '18', // Assam
      '79': '18', // Assam
      '80': '10', // Bihar
      '81': '10', // Bihar
      '82': '10', // Bihar
      '83': '20', // Jharkhand
      '84': '10', // Bihar
      '85': '10', // Bihar
    };

    return pincodeStateMap[firstTwo] || '07';
  }

  /**
   * Convert number to words (Indian format)
   */
  private numberToWords(num: number): string {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

    const convertHundreds = (n: number): string => {
      if (n === 0) return '';
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertHundreds(n % 100) : '');
    };

    if (num === 0) return 'Zero Rupees Only';

    const rupees = Math.floor(num);
    const paise = Math.round((num - rupees) * 100);

    let result = '';

    if (rupees >= 10000000) {
      result += convertHundreds(Math.floor(rupees / 10000000)) + ' Crore ';
      num = rupees % 10000000;
    }

    if (rupees >= 100000) {
      result += convertHundreds(Math.floor((rupees % 10000000) / 100000)) + ' Lakh ';
    }

    if (rupees >= 1000) {
      result += convertHundreds(Math.floor((rupees % 100000) / 1000)) + ' Thousand ';
    }

    if (rupees % 1000 > 0) {
      result += convertHundreds(rupees % 1000);
    }

    result = result.trim() + ' Rupees';

    if (paise > 0) {
      result += ' and ' + convertHundreds(paise) + ' Paise';
    }

    return result + ' Only';
  }

  /**
   * List invoices for a company
   */
  async listInvoices(params: {
    page?: number;
    limit?: number;
    fromDate?: Date;
    toDate?: Date;
    orderNo?: string;
    invoiceNo?: string;
  }): Promise<{
    invoices: Array<{
      id: string;
      invoiceNo: string;
      invoiceDate: Date;
      orderNo: string;
      customerName: string;
      totalAmount: number;
      awbNo?: string;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      Order: {
        Location: {
          companyId: this.companyId,
        },
      },
      invoiceNo: { not: null },
    };

    if (params.fromDate) {
      where.invoiceDate = { gte: params.fromDate };
    }
    if (params.toDate) {
      where.invoiceDate = { ...(where.invoiceDate as object), lte: params.toDate };
    }
    if (params.orderNo) {
      where.Order = { ...(where.Order as object), orderNo: { contains: params.orderNo, mode: 'insensitive' } };
    }
    if (params.invoiceNo) {
      where.invoiceNo = { contains: params.invoiceNo, mode: 'insensitive' };
    }

    const [deliveries, total] = await Promise.all([
      prisma.delivery.findMany({
        where,
        skip,
        take: limit,
        orderBy: { invoiceDate: 'desc' },
        include: {
          Order: {
            select: {
              orderNo: true,
              customerName: true,
              totalAmount: true,
            },
          },
        },
      }),
      prisma.delivery.count({ where }),
    ]);

    return {
      invoices: deliveries.map((d) => ({
        id: d.id,
        invoiceNo: d.invoiceNo!,
        invoiceDate: d.invoiceDate!,
        orderNo: d.Order.orderNo,
        customerName: d.Order.customerName,
        totalAmount: d.Order.totalAmount.toNumber(),
        awbNo: d.awbNo || undefined,
      })),
      total,
      page,
      limit,
    };
  }
}

/**
 * Factory function to create an invoice service
 */
export function createInvoiceService(companyId: string): InvoiceService {
  return new InvoiceService(companyId);
}
