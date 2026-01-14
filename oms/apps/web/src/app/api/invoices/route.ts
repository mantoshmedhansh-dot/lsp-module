/**
 * Invoices API
 *
 * GET /api/invoices - List invoices
 * POST /api/invoices - Generate invoice for an order
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createInvoiceService } from '@/lib/services/invoice-service';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = session.user.companyId;

    if (!companyId) {
      return NextResponse.json({ error: 'Company not found' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const orderNo = searchParams.get('orderNo') || undefined;
    const invoiceNo = searchParams.get('invoiceNo') || undefined;
    const fromDate = searchParams.get('fromDate')
      ? new Date(searchParams.get('fromDate')!)
      : undefined;
    const toDate = searchParams.get('toDate')
      ? new Date(searchParams.get('toDate')!)
      : undefined;

    const invoiceService = createInvoiceService(companyId);
    const result = await invoiceService.listInvoices({
      page,
      limit,
      orderNo,
      invoiceNo,
      fromDate,
      toDate,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('List invoices error:', error);
    return NextResponse.json(
      { error: 'Failed to list invoices' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = session.user.companyId;

    if (!companyId) {
      return NextResponse.json({ error: 'Company not found' }, { status: 400 });
    }

    const body = await request.json();
    const { orderId, deliveryId, invoiceType, originalInvoiceNo } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId is required' },
        { status: 400 }
      );
    }

    const invoiceService = createInvoiceService(companyId);
    const result = await invoiceService.generateInvoice({
      orderId,
      deliveryId,
      invoiceType,
      originalInvoiceNo,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        invoiceNo: result.invoiceNo,
        invoiceData: result.invoiceData,
      },
    });
  } catch (error) {
    console.error('Generate invoice error:', error);
    return NextResponse.json(
      { error: 'Failed to generate invoice' },
      { status: 500 }
    );
  }
}
