import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { getAuthOrInternal } from "@/lib/internal-auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/ai-actions/[id] - Get single AI action details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuthOrInternal(request);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const action = await prisma.aIActionLog.findUnique({
      where: { id },
      include: {
        NDR: {
          select: {
            id: true,
            ndrCode: true,
            status: true,
            reason: true,
            priority: true,
            Order: {
              select: {
                orderNo: true,
                customerName: true,
              },
            },
          },
        },
      },
    });

    if (!action) {
      return NextResponse.json({ error: "AI action not found" }, { status: 404 });
    }

    return NextResponse.json(action);
  } catch (error) {
    console.error("Error fetching AI action:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI action" },
      { status: 500 }
    );
  }
}

// DELETE /api/ai-actions/[id] - Delete an AI action log (admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAuthOrInternal(request);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only allow super admin to delete logs
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    await prisma.aIActionLog.delete({
      where: { id },
    });

    return NextResponse.json({ message: "AI action log deleted" });
  } catch (error) {
    console.error("Error deleting AI action:", error);
    return NextResponse.json(
      { error: "Failed to delete AI action" },
      { status: 500 }
    );
  }
}
