import fs from "fs";
import path from "path";

// Simple file-based JSON database for development on Windows ARM64
// Find project root by looking for package.json
const findProjectRoot = (): string => {
  let dir = process.cwd();
  // Try different possible locations
  const possibilities = [
    path.join(dir, "packages", "database", "prisma", "mock-db.json"),
    path.join(dir, "..", "..", "packages", "database", "prisma", "mock-db.json"),
    path.join(dir, "..", "packages", "database", "prisma", "mock-db.json"),
  ];

  for (const p of possibilities) {
    try {
      const dirPath = path.dirname(p);
      if (fs.existsSync(dirPath)) {
        return p;
      }
    } catch {}
  }

  // Default fallback
  return path.join(dir, "packages", "database", "prisma", "mock-db.json");
};

const DB_FILE = findProjectRoot();

interface MockDB {
  users: any[];
  clients: any[];
  partners: any[];
  partnerServiceability: any[];
  partnerPerformance: any[];
  warehouses: any[];
  warehouseStaff: any[];
  orders: any[];
  orderEvents: any[];
  ndrCases: any[];
  invoices: any[];
  partnerSettlements: any[];
  pincodeMaster: any[];
  webhookLogs: any[];
}

const defaultDB: MockDB = {
  users: [],
  clients: [],
  partners: [],
  partnerServiceability: [],
  partnerPerformance: [],
  warehouses: [],
  warehouseStaff: [],
  orders: [],
  orderEvents: [],
  ndrCases: [],
  invoices: [],
  partnerSettlements: [],
  pincodeMaster: [],
  webhookLogs: [],
};

function loadDB(): MockDB {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Error loading mock DB:", e);
  }
  return { ...defaultDB };
}

function saveDB(db: MockDB) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Create a Prisma-like API for the mock database
function createMockModel<T extends { id?: string }>(tableName: keyof MockDB) {
  return {
    async findMany(args?: { where?: any; include?: any; orderBy?: any; take?: number; skip?: number }) {
      const db = loadDB();
      let results = db[tableName] as T[];

      if (args?.where) {
        results = results.filter((item: any) => {
          return Object.entries(args.where).every(([key, value]) => item[key] === value);
        });
      }

      if (args?.skip) {
        results = results.slice(args.skip);
      }

      if (args?.take) {
        results = results.slice(0, args.take);
      }

      return results;
    },

    async findFirst(args?: { where?: any; include?: any }) {
      const results = await this.findMany(args);
      return results[0] || null;
    },

    async findUnique(args: { where: any; include?: any }) {
      const db = loadDB();
      const items = db[tableName] as any[];

      return items.find((item) => {
        return Object.entries(args.where).every(([key, value]) => item[key] === value);
      }) || null;
    },

    async create(args: { data: any }) {
      const db = loadDB();
      const newItem = {
        id: generateId(),
        ...args.data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      (db[tableName] as any[]).push(newItem);
      saveDB(db);
      return newItem;
    },

    async update(args: { where: any; data: any }) {
      const db = loadDB();
      const items = db[tableName] as any[];
      const index = items.findIndex((item) =>
        Object.entries(args.where).every(([key, value]) => item[key] === value)
      );

      if (index !== -1) {
        items[index] = {
          ...items[index],
          ...args.data,
          updatedAt: new Date().toISOString(),
        };
        saveDB(db);
        return items[index];
      }
      throw new Error(`Record not found in ${tableName}`);
    },

    async upsert(args: { where: any; create: any; update: any }) {
      const existing = await this.findUnique({ where: args.where });
      if (existing) {
        return this.update({ where: args.where, data: args.update });
      }
      return this.create({ data: args.create });
    },

    async delete(args: { where: any }) {
      const db = loadDB();
      const items = db[tableName] as any[];
      const index = items.findIndex((item) =>
        Object.entries(args.where).every(([key, value]) => item[key] === value)
      );

      if (index !== -1) {
        const deleted = items.splice(index, 1)[0];
        saveDB(db);
        return deleted;
      }
      throw new Error(`Record not found in ${tableName}`);
    },

    async count(args?: { where?: any }) {
      const results = await this.findMany(args);
      return results.length;
    },
  };
}

// Mock Prisma client
export const mockPrisma = {
  user: createMockModel("users"),
  client: createMockModel("clients"),
  partner: createMockModel("partners"),
  partnerServiceability: createMockModel("partnerServiceability"),
  partnerPerformance: createMockModel("partnerPerformance"),
  warehouse: createMockModel("warehouses"),
  warehouseStaff: createMockModel("warehouseStaff"),
  order: createMockModel("orders"),
  orderEvent: createMockModel("orderEvents"),
  ndrCase: createMockModel("ndrCases"),
  invoice: createMockModel("invoices"),
  partnerSettlement: createMockModel("partnerSettlements"),
  pincodeMaster: createMockModel("pincodeMaster"),
  webhookLog: createMockModel("webhookLogs"),
  $disconnect: async () => {},
  $connect: async () => {},
};

export type MockPrismaClient = typeof mockPrisma;
