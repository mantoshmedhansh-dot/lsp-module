import { prisma } from './src/index';

async function main() {
  console.log('=== Database Data Check (After Schema Sync) ===\n');

  // Check NDR data
  const ndrCount = await prisma.nDR.count();
  console.log(`NDR records: ${ndrCount}`);
  
  const ndrsByStatus = await prisma.nDR.groupBy({
    by: ['status'],
    _count: { _all: true }
  });
  console.log('NDR by status:', ndrsByStatus);

  // Check AI Action Log
  const aiCount = await prisma.aIActionLog.count();
  console.log(`\nAIActionLog records: ${aiCount}`);
  
  if (aiCount > 0) {
    const aiLogs = await prisma.aIActionLog.findMany({ 
      take: 2,
      select: {
        id: true,
        actionType: true,
        entityType: true,
        status: true,
        confidence: true,
        createdAt: true
      }
    });
    console.log('Sample AI Logs:', JSON.stringify(aiLogs, null, 2));
  }

  // Check Proactive Communication
  const commCount = await prisma.proactiveCommunication.count();
  console.log(`\nProactiveCommunication records: ${commCount}`);

  // Check Deliveries
  const deliveryCount = await prisma.delivery.count();
  console.log(`\nDelivery records: ${deliveryCount}`);

  // Check Orders
  const orderCount = await prisma.order.count();
  console.log(`Order records: ${orderCount}`);

  // Check Companies
  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  console.log(`\nCompanies (${companies.length}):`, companies);

  await prisma.$disconnect();
}

main().catch(console.error);
