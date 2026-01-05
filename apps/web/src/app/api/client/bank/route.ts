import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";
import { getClientFromRequest } from "@/lib/client-auth";

export async function GET(request: NextRequest) {
  try {
    const client = await getClientFromRequest(request);
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const bankAccounts = await prisma.clientBankAccount.findMany({
      where: {
        clientId: client.id,
        isActive: true,
      },
      orderBy: [
        { isPrimary: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({
      success: true,
      data: bankAccounts.map((b) => ({
        id: b.id,
        accountHolderName: b.accountHolderName,
        accountNumber: `XXXX${b.accountNumber.slice(-4)}`, // Mask account number
        ifscCode: b.ifscCode,
        bankName: b.bankName,
        branchName: b.branchName,
        accountType: b.accountType,
        isVerified: b.isVerified,
        isPrimary: b.isPrimary,
        createdAt: b.createdAt,
      })),
    });
  } catch (error) {
    console.error("Client bank error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const client = await getClientFromRequest(request);
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      branchName,
      accountType,
      isPrimary,
    } = body;

    // Validate required fields
    if (!accountHolderName || !accountNumber || !ifscCode || !bankName) {
      return NextResponse.json(
        { success: false, error: "Account holder name, account number, IFSC code and bank name are required" },
        { status: 400 }
      );
    }

    // If this is primary, unset other primary accounts
    if (isPrimary) {
      await prisma.clientBankAccount.updateMany({
        where: { clientId: client.id, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    // Check if this is the first account (make it primary by default)
    const existingCount = await prisma.clientBankAccount.count({
      where: { clientId: client.id },
    });

    const bankAccount = await prisma.clientBankAccount.create({
      data: {
        clientId: client.id,
        accountHolderName,
        accountNumber,
        ifscCode: ifscCode.toUpperCase(),
        bankName,
        branchName,
        accountType: accountType || "SAVINGS",
        isPrimary: isPrimary || existingCount === 0,
        isVerified: false, // Needs verification
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: bankAccount.id,
        accountHolderName: bankAccount.accountHolderName,
        accountNumber: `XXXX${bankAccount.accountNumber.slice(-4)}`,
        ifscCode: bankAccount.ifscCode,
        bankName: bankAccount.bankName,
        branchName: bankAccount.branchName,
        accountType: bankAccount.accountType,
        isPrimary: bankAccount.isPrimary,
        isVerified: bankAccount.isVerified,
      },
    });
  } catch (error) {
    console.error("Add bank account error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
