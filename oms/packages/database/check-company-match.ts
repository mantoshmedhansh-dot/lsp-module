import { prisma } from './src/index';

async function main() {
  // Check admin user's company
  const adminUser = await prisma.user.findFirst({
    where: { email: 'admin@demo.com' },
    select: {
      id: true,
      email: true,
      companyId: true,
      Company: { select: { id: true, name: true } }
    }
  });
  console.log('Admin user:', adminUser);

  // Check NDR companies
  const ndrCompanies = await prisma.nDR.groupBy({
    by: ['companyId'],
    _count: { _all: true }
  });
  console.log('\nNDR by company:', ndrCompanies);

  // Check AIActionLog companies
  const aiCompanies = await prisma.aIActionLog.groupBy({
    by: ['companyId'],
    _count: { _all: true }
  });
  console.log('\nAIActionLog by company:', aiCompanies);

  // Check ProactiveCommunication companies
  const commCompanies = await prisma.proactiveCommunication.groupBy({
    by: ['companyId'],
    _count: { _all: true }
  });
  console.log('\nProactiveCommunication by company:', commCompanies);

  // Check all companies in the system
  const companies = await prisma.company.findMany({
    select: { id: true, name: true }
  });
  console.log('\nAll companies:', companies);

  await prisma.$disconnect();
}

main().catch(console.error);
