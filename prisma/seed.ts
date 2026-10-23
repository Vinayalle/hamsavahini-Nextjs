/**
 * Idempotent, NON-DESTRUCTIVE provisioning.
 *   - Always: permission catalogue, default roles (created only if missing), and the first Super Admin.
 *   - Only with SEED_SAMPLE_DATA=true: the sample catalogue (categories + products) from the mock data.
 *
 * It never deletes or overwrites existing users, roles or business data.
 * The Super Admin password comes from SEED_ADMIN_PASSWORD. If it is empty a random one is generated and printed
 * ONCE to the console. Nothing is hardcoded and no default password exists.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "@node-rs/argon2";
import { PrismaClient } from "../src/generated/prisma/client";
import { ensureDefaultRoles, nextEmployeeId, syncPermissionCatalogue } from "../src/lib/authz/bootstrap";
import { categoriesSeed, productsSeed } from "../src/lib/mock/data/catalog";
import { pgConnection } from "../src/lib/db-url";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = new PrismaClient({ adapter: new PrismaPg(pgConnection(url)) });

  const count = await syncPermissionCatalogue(db);
  const roleIds = await ensureDefaultRoles(db);
  console.log(`Permission catalogue synchronised (${count} permissions); default roles ensured.`);

  // First Super Admin: only if the install has no ACTIVE Super Admin yet.
  const activeSuperAdmins = await db.adminUser.count({ where: { status: "active", roles: { some: { role: { code: "super_admin", status: "active" } } } } });
  if (activeSuperAdmins === 0) {
    const email = (process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase();
    if (!email) throw new Error("No active Super Admin exists. Set SEED_ADMIN_EMAIL (and optionally SEED_ADMIN_PASSWORD) and run the seed again.");
    const existing = await db.adminUser.findUnique({ where: { email } });
    if (existing) {
      console.log(`Account ${email} already exists but is not an active Super Admin; left unchanged. Reactivate it from the admin UI or use another SEED_ADMIN_EMAIL.`);
    } else {
      let password = process.env.SEED_ADMIN_PASSWORD ?? "";
      let generated = false;
      if (!password) {
        password = randomBytes(18).toString("base64url");
        generated = true;
      }
      if (password.length < 12) throw new Error("SEED_ADMIN_PASSWORD must be at least 12 characters");
      await db.adminUser.create({
        data: {
          employeeId: await nextEmployeeId(db), email, name: "Super Admin", status: "active", passwordChangedAt: new Date(), emailVerifiedAt: new Date(),
          passwordHash: await hash(password, { memoryCost: 65536, timeCost: 3, parallelism: 1 }),
          roles: { create: { roleId: roleIds["super_admin"] } },
        },
      });
      console.log(`Created Super Admin ${email}`);
      if (generated) console.log(`Generated password (shown once, change it after first login): ${password}`);
    }
  } else {
    console.log("An active Super Admin already exists; no account was created.");
  }

  if (process.env.SEED_SAMPLE_DATA === "true") {
    const catIds = new Map<string, string>();
    for (const c of categoriesSeed) {
      const row = await db.category.upsert({
        where: { slug: c.slug },
        update: {},
        create: { name: c.name, slug: c.slug, description: c.description, sortOrder: c.sortOrder, status: c.status },
      });
      catIds.set(c.id, row.id);
    }
    for (const p of productsSeed) {
      if (await db.product.findUnique({ where: { code: p.code.toUpperCase() } })) continue;
      await db.product.create({
        data: {
          name: p.name, slug: p.slug, code: p.code.toUpperCase(), categoryId: catIds.get(p.categoryId)!,
          shortDescription: p.shortDescription, description: p.description, status: p.status, featured: p.featured,
          publishedAt: p.status === "published" ? new Date(p.publishedAt ?? p.updatedAt) : null,
          specifications: { create: p.specifications.map((s, i) => ({ label: s.label, value: s.value, unit: s.unit ?? null, sortOrder: i })) },
        },
      });
    }
    console.log(`Sample catalogue ready: ${categoriesSeed.length} categories, ${productsSeed.length} products.`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
