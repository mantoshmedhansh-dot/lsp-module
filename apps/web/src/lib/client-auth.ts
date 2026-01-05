import { NextRequest } from "next/server";
import { prisma } from "@cjdquick/database";

export interface ClientContext {
  id: string;
  companyName: string;
  userId: string;
  clientUserId: string;
  clientUserName: string;
  clientUserEmail: string;
  clientUserRole: string;
}

export async function getClientFromRequest(
  request: NextRequest
): Promise<ClientContext | null> {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.substring(7);

    const session = await prisma.clientUserSession.findUnique({
      where: { token },
      include: {
        clientUser: {
          include: {
            client: true,
          },
        },
      },
    });

    if (!session || !session.isActive || session.expiresAt < new Date()) {
      return null;
    }

    if (!session.clientUser.isActive) {
      return null;
    }

    const { clientUser } = session;
    const { client } = clientUser;

    return {
      id: client.id,
      companyName: client.companyName,
      userId: client.userId,
      clientUserId: clientUser.id,
      clientUserName: clientUser.name,
      clientUserEmail: clientUser.email,
      clientUserRole: clientUser.role,
    };
  } catch (error) {
    console.error("Client auth error:", error);
    return null;
  }
}

export async function requireClient(
  request: NextRequest
): Promise<ClientContext> {
  const client = await getClientFromRequest(request);
  if (!client) {
    throw new Error("Unauthorized");
  }
  return client;
}
