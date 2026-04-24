/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.systemSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      bonusPercentage: 10,
      isMaintenance: false,
      announcement: "",
    },
    update: {},
  });

  await prisma.$executeRawUnsafe(
    `UPDATE "User" SET "accountStatus" = 'SUSPENDED'::"UserAccountStatus" WHERE frozen = true`
  );
}

main()
  .then(() => console.log("[prisma seed] OK"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
