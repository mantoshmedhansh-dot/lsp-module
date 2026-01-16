import { prisma } from './src/index';

async function main() {
  // Check which company NDRs belong to
  const ndrs = await prisma.nDR.findMany({
    take: 3,
    include: {
      Delivery: {
        include: {
          Order: {
            select: {
              companyId: true,
              Company: { select: { name: true } }
            }
          }
        }
      }
    }
  });
  
  console.log('NDR Company associations:');
  for (const ndr of ndrs) {
    console.log(`  NDR ${ndr.ndrCode}: Company = ${ndr.Delivery?.Order?.Company?.name} (${ndr.Delivery?.Order?.companyId})`);
  }

  // Check Orders and their companies
  const orders = await prisma.order.findMany({
    take: 5,
    select: {
      orderNo: true,
      companyId: true,
      Company: { select: { name: true } }
    }
  });
  
  console.log('\nOrders and Companies:');
  for (const order of orders) {
    console.log(`  ${order.orderNo}: ${order.Company?.name} (${order.companyId})`);
  }

  // Check logged in user's company
  const adminUser = await prisma.user.findFirst({
    where: { email: 'admin@demo.com' },
    select: {
      email: true,
      companyId: true,
      Company: { select: { name: true } }
    }
  });
  
  console.log('\nAdmin user company:', adminUser);

  // Check all companies
  const companies = await prisma.company.findMany({
    select: { id: true, name: true }
  });
  console.log('\nAll companies:', companies);

  await prisma.$disconnect();
}

main().catch(console.error);
