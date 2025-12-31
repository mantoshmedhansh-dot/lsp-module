import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | any;
  var useMockDb: boolean | undefined;
}

// Try to use real Prisma, fall back to mock DB on Windows ARM64
let prismaInstance: PrismaClient | any;

async function initPrisma() {
  // If already initialized, return existing instance
  if (prismaInstance) return prismaInstance;

  try {
    const client = new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["error", "warn"]
          : ["error"],
    });

    // Test the connection
    await client.$connect();
    prismaInstance = client;
    console.log("Using Prisma with SQLite");
    return prismaInstance;
  } catch (error: any) {
    // If Prisma fails (e.g., on Windows ARM64), use mock database
    if (error.message?.includes("not a valid Win32 application") ||
        error.message?.includes("Unable to require")) {
      console.log("Prisma not compatible with this platform, using mock database");
      const { mockPrisma } = await import("./mock-db");
      prismaInstance = mockPrisma;
      global.useMockDb = true;
      return prismaInstance;
    }
    throw error;
  }
}

// For synchronous access (backward compatibility)
// In production, prefer using getPrisma() for proper initialization
function createLazyProxy() {
  const handler: ProxyHandler<any> = {
    get(target, prop) {
      if (prismaInstance) {
        return (prismaInstance as any)[prop];
      }

      // Return a proxy that initializes on first real operation
      return new Proxy({}, {
        get(_, method) {
          return async (...args: any[]) => {
            if (!prismaInstance) {
              await initPrisma();
            }
            return (prismaInstance as any)[prop][method](...args);
          };
        }
      });
    }
  };

  return new Proxy({}, handler);
}

export const prisma = createLazyProxy() as PrismaClient;

// Async function to get properly initialized prisma
export async function getPrisma() {
  if (!prismaInstance) {
    await initPrisma();
  }
  return prismaInstance;
}

export * from "@prisma/client";
