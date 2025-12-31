import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@cjdquick/database";
import { selectOptimalPartner } from "@/lib/partner-selection";
import { z } from "zod";

const selectPartnerSchema = z.object({
  originPincode: z.string().regex(/^\d{6}$/),
  destinationPincode: z.string().regex(/^\d{6}$/),
  weightKg: z.coerce.number().min(0.01),
  isCod: z.boolean().default(false),
  codAmount: z.coerce.number().default(0),
  clientWeights: z
    .object({
      cost: z.number().min(0).max(1),
      speed: z.number().min(0).max(1),
      reliability: z.number().min(0).max(1),
    })
    .optional(),
});

// POST /api/partners/select - Get partner recommendations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = selectPartnerSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: validated.error.errors[0].message,
          },
        },
        { status: 400 }
      );
    }

    const data = validated.data;

    // Get client weights from header or use defaults
    const clientId = request.headers.get("x-client-id");
    let clientWeights = data.clientWeights || { cost: 0.4, speed: 0.3, reliability: 0.3 };

    if (clientId && !data.clientWeights) {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: {
          weightCost: true,
          weightSpeed: true,
          weightReliability: true,
        },
      });

      if (client) {
        clientWeights = {
          cost: Number(client.weightCost),
          speed: Number(client.weightSpeed),
          reliability: Number(client.weightReliability),
        };
      }
    }

    const result = await selectOptimalPartner({
      originPincode: data.originPincode,
      destinationPincode: data.destinationPincode,
      weightKg: data.weightKg,
      isCod: data.isCod,
      codAmount: data.codAmount,
      clientWeights,
    });

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NO_SERVICE",
            message: "No serviceable partners found for this route",
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Error selecting partner:", error);
    return NextResponse.json(
      { success: false, error: { code: "SELECT_ERROR", message: "Failed to select partner" } },
      { status: 500 }
    );
  }
}
