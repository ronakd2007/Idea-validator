import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@ideavalidator.com';
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const hash = await bcrypt.hash('Admin@1234', 10);
    await prisma.user.create({
      data: { name: 'Admin', email: adminEmail, password: hash, role: 'ADMIN', isActive: true },
    });
    console.log('✓ Admin created: admin@ideavalidator.com / Admin@1234');
  } else {
    console.log('Admin already exists, skipping.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
