import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const email = 'xisense@gmail.com';
  const password = process.env.SEED_SUPERADMIN_PASSWORD || randomBytes(12).toString('base64url').slice(0, 12);
  const hashedPassword = await bcrypt.hash(password, 10);

  const superAdmin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password: hashedPassword,
      name: 'xisense',
      role: Role.SUPER_ADMIN,
      isActive: true,
      mustChangePassword: false,
    },
  });

  console.log({ superAdmin });
  if (!process.env.SEED_SUPERADMIN_PASSWORD) {
    console.warn(`[seed] SEED_SUPERADMIN_PASSWORD not set. Generated temporary password for ${email}: ${password}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
