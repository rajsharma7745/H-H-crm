import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import {
  PERMISSION_DEFINITIONS,
  ROLE_DEFINITIONS,
  ROLE_PERMISSION_DEFAULTS,
} from "../src/lib/rbac/permissions";

const adapter = new PrismaPg(process.env.DATABASE_URL as string);
const db = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding roles...");
  const rolesByKey = new Map<string, { id: string }>();
  for (const role of ROLE_DEFINITIONS) {
    const record = await db.role.upsert({
      where: { key: role.key },
      update: { name: role.name, description: role.description },
      create: { key: role.key, name: role.name, description: role.description },
    });
    rolesByKey.set(role.key, record);
  }

  console.log("Seeding permissions...");
  const permissionsByKey = new Map<string, { id: string }>();
  for (const permission of PERMISSION_DEFINITIONS) {
    const record = await db.permission.upsert({
      where: { key: permission.key },
      update: {
        module: permission.module,
        action: permission.action,
        description: permission.description,
      },
      create: {
        key: permission.key,
        module: permission.module,
        action: permission.action,
        description: permission.description,
      },
    });
    permissionsByKey.set(permission.key, record);
  }

  console.log("Wiring role -> permission grants...");
  for (const [roleKey, permissionKeys] of Object.entries(ROLE_PERMISSION_DEFAULTS)) {
    const role = rolesByKey.get(roleKey);
    if (!role) continue;

    // Reset then re-grant so removing a key from ROLE_PERMISSION_DEFAULTS
    // actually revokes it on the next seed run, not just additive.
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });

    for (const permissionKey of permissionKeys) {
      const permission = permissionsByKey.get(permissionKey);
      if (!permission) {
        console.warn(`  ! Unknown permission key "${permissionKey}" for role ${roleKey}, skipping.`);
        continue;
      }
      await db.rolePermission.create({
        data: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL;
  const superAdminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD;

  if (superAdminEmail && superAdminPassword) {
    const existing = await db.user.findUnique({ where: { email: superAdminEmail } });
    if (!existing) {
      console.log(`Creating initial Super Admin: ${superAdminEmail}`);
      const superAdminRole = rolesByKey.get("SUPER_ADMIN");
      if (!superAdminRole) throw new Error("SUPER_ADMIN role missing after seed — this should not happen.");

      const passwordHash = await bcrypt.hash(superAdminPassword, 12);
      await db.user.create({
        data: {
          firstName: process.env.SEED_SUPER_ADMIN_FIRST_NAME || "Super",
          lastName: process.env.SEED_SUPER_ADMIN_LAST_NAME || "Admin",
          email: superAdminEmail,
          passwordHash,
          roleId: superAdminRole.id,
          status: "ACTIVE",
        },
      });
      console.log("  -> Created. Log in and change this password immediately.");
    } else {
      console.log(`Super Admin ${superAdminEmail} already exists, skipping creation.`);
    }
  } else {
    console.warn(
      "SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_PASSWORD not set — skipping initial admin creation. " +
        "You will have no way to log in until one user exists; set these in .env and re-run the seed.",
    );
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
