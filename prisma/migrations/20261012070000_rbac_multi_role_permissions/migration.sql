
-- RBAC upgrade: multiple roles per employee, page/action permission catalogue, individual overrides,
-- employee profile fields, dashboard preferences and permission history.
--
-- DATA-PRESERVING. Nothing is deleted except (a) legacy coarse permission rows AFTER their grants were expanded
-- into the equivalent catalogue permissions, and (b) AdminUser.roleId AFTER every value was copied to UserRole
-- (the migration aborts if that copy is incomplete). Take a backup first (docs/rbac-architecture.md).
--
-- NOTE: this file is ASCII only on purpose (the database may not be UTF-8 on some Windows installs).

-- == 1. New enums ============================================================================================
CREATE TYPE "RoleStatus" AS ENUM ('active', 'inactive');
CREATE TYPE "GrantScope" AS ENUM ('all', 'assigned');
CREATE TYPE "OverrideEffect" AS ENUM ('allow', 'deny');
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'access_changed';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'invited';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'password_reset';

-- == 2. Role: stable code + status =============================================================================
ALTER TABLE "Role" ADD COLUMN "code" TEXT;
ALTER TABLE "Role" ADD COLUMN "status" "RoleStatus" NOT NULL DEFAULT 'active';

UPDATE "Role" SET "code" = CASE "name"
  WHEN 'Super Admin' THEN 'super_admin'
  ELSE trim(both '_' from regexp_replace(lower("name"), '[^a-z0-9]+', '_', 'g'))
END;

-- Align the earlier default roles with the specified default role names (only if the target name is free).
UPDATE "Role" SET "name" = 'Content Manager', "code" = 'content_manager'
  WHERE "name" = 'Content Editor' AND NOT EXISTS (SELECT 1 FROM "Role" WHERE "name" = 'Content Manager');
UPDATE "Role" SET "name" = 'Trade Desk Manager', "code" = 'trade_desk_manager'
  WHERE "name" = 'Trade Desk' AND NOT EXISTS (SELECT 1 FROM "Role" WHERE "name" = 'Trade Desk Manager');
UPDATE "Role" SET "isSystem" = true WHERE "code" IN ('super_admin', 'content_manager', 'trade_desk_manager', 'hr_manager');

ALTER TABLE "Role" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- == 3. Permission: (module, action) enums -> (resource, action) catalogue strings ================================
ALTER TABLE "Permission" ADD COLUMN "resource" TEXT;
ALTER TABLE "Permission" ALTER COLUMN "module" TYPE TEXT USING "module"::text;
ALTER TABLE "Permission" ALTER COLUMN "action" TYPE TEXT USING "action"::text;
UPDATE "Permission" SET "resource" = "module";
ALTER TABLE "Permission" ALTER COLUMN "resource" SET NOT NULL;
DROP INDEX "Permission_module_action_key";
CREATE UNIQUE INDEX "Permission_resource_action_key" ON "Permission"("resource", "action");
CREATE INDEX "Permission_module_idx" ON "Permission"("module");

ALTER TABLE "RolePermission" ADD COLUMN "scope" "GrantScope" NOT NULL DEFAULT 'all';

-- == 4. Expand legacy coarse grants into catalogue permissions ================================================
-- Frozen snapshot of the catalogue at the time of this migration: (resource, action, module).
CREATE TEMP TABLE _catalogue ("resource" TEXT, "action" TEXT, "module" TEXT);
INSERT INTO _catalogue VALUES
  ('activity_logs', 'export', 'administration'),
  ('activity_logs', 'view', 'administration'),
  ('banners', 'archive', 'content'),
  ('banners', 'create', 'content'),
  ('banners', 'delete', 'content'),
  ('banners', 'edit', 'content'),
  ('banners', 'publish', 'content'),
  ('banners', 'restore', 'content'),
  ('banners', 'unpublish', 'content'),
  ('banners', 'view', 'content'),
  ('careers', 'archive', 'content'),
  ('careers', 'create', 'content'),
  ('careers', 'delete', 'content'),
  ('careers', 'edit', 'content'),
  ('careers', 'publish', 'content'),
  ('careers', 'restore', 'content'),
  ('careers', 'unpublish', 'content'),
  ('careers', 'view', 'content'),
  ('categories', 'archive', 'catalogue'),
  ('categories', 'create', 'catalogue'),
  ('categories', 'delete', 'catalogue'),
  ('categories', 'edit', 'catalogue'),
  ('categories', 'publish', 'catalogue'),
  ('categories', 'restore', 'catalogue'),
  ('categories', 'unpublish', 'catalogue'),
  ('categories', 'view', 'catalogue'),
  ('commodities', 'archive', 'trade'),
  ('commodities', 'create', 'trade'),
  ('commodities', 'delete', 'trade'),
  ('commodities', 'edit', 'trade'),
  ('commodities', 'publish', 'trade'),
  ('commodities', 'restore', 'trade'),
  ('commodities', 'unpublish', 'trade'),
  ('commodities', 'view', 'trade'),
  ('commodity_prices', 'create', 'trade'),
  ('commodity_prices', 'delete', 'trade'),
  ('commodity_prices', 'edit', 'trade'),
  ('commodity_prices', 'publish', 'trade'),
  ('commodity_prices', 'unpublish', 'trade'),
  ('commodity_prices', 'view', 'trade'),
  ('documents', 'archive', 'files'),
  ('documents', 'delete', 'files'),
  ('documents', 'download', 'files'),
  ('documents', 'edit', 'files'),
  ('documents', 'publish', 'files'),
  ('documents', 'unpublish', 'files'),
  ('documents', 'upload', 'files'),
  ('documents', 'view', 'files'),
  ('email_templates', 'create', 'notifications'),
  ('email_templates', 'delete', 'notifications'),
  ('email_templates', 'edit', 'notifications'),
  ('email_templates', 'view', 'notifications'),
  ('enquiries', 'assign', 'enquiries'),
  ('enquiries', 'change_status', 'enquiries'),
  ('enquiries', 'delete', 'enquiries'),
  ('enquiries', 'edit', 'enquiries'),
  ('enquiries', 'export', 'enquiries'),
  ('enquiries', 'view', 'enquiries'),
  ('job_applications', 'change_status', 'enquiries'),
  ('job_applications', 'delete', 'enquiries'),
  ('job_applications', 'download', 'enquiries'),
  ('job_applications', 'edit', 'enquiries'),
  ('job_applications', 'export', 'enquiries'),
  ('job_applications', 'view', 'enquiries'),
  ('locations', 'archive', 'content'),
  ('locations', 'create', 'content'),
  ('locations', 'delete', 'content'),
  ('locations', 'edit', 'content'),
  ('locations', 'publish', 'content'),
  ('locations', 'restore', 'content'),
  ('locations', 'unpublish', 'content'),
  ('locations', 'view', 'content'),
  ('media', 'delete', 'files'),
  ('media', 'download', 'files'),
  ('media', 'edit', 'files'),
  ('media', 'upload', 'files'),
  ('media', 'view', 'files'),
  ('notification_history', 'change_status', 'notifications'),
  ('notification_history', 'view', 'notifications'),
  ('posts', 'archive', 'content'),
  ('posts', 'create', 'content'),
  ('posts', 'delete', 'content'),
  ('posts', 'edit', 'content'),
  ('posts', 'publish', 'content'),
  ('posts', 'restore', 'content'),
  ('posts', 'unpublish', 'content'),
  ('posts', 'view', 'content'),
  ('product_documents', 'delete', 'catalogue'),
  ('product_documents', 'download', 'catalogue'),
  ('product_documents', 'edit', 'catalogue'),
  ('product_documents', 'upload', 'catalogue'),
  ('product_documents', 'view', 'catalogue'),
  ('product_images', 'delete', 'catalogue'),
  ('product_images', 'edit', 'catalogue'),
  ('product_images', 'upload', 'catalogue'),
  ('product_images', 'view', 'catalogue'),
  ('product_specifications', 'create', 'catalogue'),
  ('product_specifications', 'delete', 'catalogue'),
  ('product_specifications', 'edit', 'catalogue'),
  ('product_specifications', 'view', 'catalogue'),
  ('products', 'archive', 'catalogue'),
  ('products', 'create', 'catalogue'),
  ('products', 'delete', 'catalogue'),
  ('products', 'edit', 'catalogue'),
  ('products', 'export', 'catalogue'),
  ('products', 'publish', 'catalogue'),
  ('products', 'restore', 'catalogue'),
  ('products', 'unpublish', 'catalogue'),
  ('products', 'view', 'catalogue'),
  ('projects', 'archive', 'content'),
  ('projects', 'create', 'content'),
  ('projects', 'delete', 'content'),
  ('projects', 'edit', 'content'),
  ('projects', 'publish', 'content'),
  ('projects', 'restore', 'content'),
  ('projects', 'unpublish', 'content'),
  ('projects', 'view', 'content'),
  ('rfqs', 'assign', 'trade'),
  ('rfqs', 'change_status', 'trade'),
  ('rfqs', 'delete', 'trade'),
  ('rfqs', 'download', 'trade'),
  ('rfqs', 'edit', 'trade'),
  ('rfqs', 'export', 'trade'),
  ('rfqs', 'view', 'trade'),
  ('roles', 'assign', 'administration'),
  ('roles', 'change_status', 'administration'),
  ('roles', 'create', 'administration'),
  ('roles', 'delete', 'administration'),
  ('roles', 'edit', 'administration'),
  ('roles', 'manage_permissions', 'administration'),
  ('roles', 'view', 'administration'),
  ('settings_contact', 'manage_settings', 'configuration'),
  ('settings_contact', 'view', 'configuration'),
  ('settings_footer', 'manage_settings', 'configuration'),
  ('settings_footer', 'view', 'configuration'),
  ('settings_general', 'manage_settings', 'configuration'),
  ('settings_general', 'view', 'configuration'),
  ('settings_navigation', 'manage_settings', 'configuration'),
  ('settings_navigation', 'view', 'configuration'),
  ('settings_seo', 'manage_settings', 'configuration'),
  ('settings_seo', 'view', 'configuration'),
  ('trade_opportunities', 'archive', 'trade'),
  ('trade_opportunities', 'change_status', 'trade'),
  ('trade_opportunities', 'create', 'trade'),
  ('trade_opportunities', 'delete', 'trade'),
  ('trade_opportunities', 'edit', 'trade'),
  ('trade_opportunities', 'publish', 'trade'),
  ('trade_opportunities', 'unpublish', 'trade'),
  ('trade_opportunities', 'view', 'trade'),
  ('user_dashboards', 'edit', 'administration'),
  ('user_dashboards', 'view', 'administration'),
  ('user_permissions', 'manage_permissions', 'administration'),
  ('user_permissions', 'view', 'administration'),
  ('users', 'assign', 'administration'),
  ('users', 'change_status', 'administration'),
  ('users', 'create', 'administration'),
  ('users', 'edit', 'administration'),
  ('users', 'export', 'administration'),
  ('users', 'view', 'administration');

-- Legacy (module, action) -> catalogue (resource, action). manage_permissions is never inherited.
CREATE TEMP TABLE _legacy_map ("old_res" TEXT, "old_act" TEXT, "new_res" TEXT, "new_act" TEXT);
INSERT INTO _legacy_map VALUES
  ('products', 'view', 'products', 'view'),
  ('products', 'view', 'product_specifications', 'view'),
  ('products', 'view', 'product_images', 'view'),
  ('products', 'view', 'product_documents', 'view'),
  ('products', 'create', 'products', 'create'),
  ('products', 'create', 'product_specifications', 'create'),
  ('products', 'create', 'product_images', 'upload'),
  ('products', 'create', 'product_documents', 'upload'),
  ('products', 'edit', 'products', 'edit'),
  ('products', 'edit', 'products', 'archive'),
  ('products', 'edit', 'products', 'restore'),
  ('products', 'edit', 'product_specifications', 'edit'),
  ('products', 'edit', 'product_images', 'edit'),
  ('products', 'edit', 'product_documents', 'edit'),
  ('products', 'edit', 'product_documents', 'download'),
  ('products', 'delete', 'products', 'delete'),
  ('products', 'delete', 'product_specifications', 'delete'),
  ('products', 'delete', 'product_images', 'delete'),
  ('products', 'delete', 'product_documents', 'delete'),
  ('products', 'publish', 'products', 'publish'),
  ('products', 'publish', 'products', 'unpublish'),
  ('categories', 'view', 'categories', 'view'),
  ('categories', 'create', 'categories', 'create'),
  ('categories', 'edit', 'categories', 'edit'),
  ('categories', 'edit', 'categories', 'archive'),
  ('categories', 'edit', 'categories', 'restore'),
  ('categories', 'delete', 'categories', 'delete'),
  ('categories', 'publish', 'categories', 'publish'),
  ('categories', 'publish', 'categories', 'unpublish'),
  ('posts', 'view', 'posts', 'view'),
  ('posts', 'create', 'posts', 'create'),
  ('posts', 'edit', 'posts', 'edit'),
  ('posts', 'edit', 'posts', 'archive'),
  ('posts', 'edit', 'posts', 'restore'),
  ('posts', 'delete', 'posts', 'delete'),
  ('posts', 'publish', 'posts', 'publish'),
  ('posts', 'publish', 'posts', 'unpublish'),
  ('projects', 'view', 'projects', 'view'),
  ('projects', 'create', 'projects', 'create'),
  ('projects', 'edit', 'projects', 'edit'),
  ('projects', 'edit', 'projects', 'archive'),
  ('projects', 'edit', 'projects', 'restore'),
  ('projects', 'delete', 'projects', 'delete'),
  ('projects', 'publish', 'projects', 'publish'),
  ('projects', 'publish', 'projects', 'unpublish'),
  ('careers', 'view', 'careers', 'view'),
  ('careers', 'create', 'careers', 'create'),
  ('careers', 'edit', 'careers', 'edit'),
  ('careers', 'edit', 'careers', 'archive'),
  ('careers', 'edit', 'careers', 'restore'),
  ('careers', 'delete', 'careers', 'delete'),
  ('careers', 'publish', 'careers', 'publish'),
  ('careers', 'publish', 'careers', 'unpublish'),
  ('locations', 'view', 'locations', 'view'),
  ('locations', 'create', 'locations', 'create'),
  ('locations', 'edit', 'locations', 'edit'),
  ('locations', 'edit', 'locations', 'archive'),
  ('locations', 'edit', 'locations', 'restore'),
  ('locations', 'delete', 'locations', 'delete'),
  ('locations', 'publish', 'locations', 'publish'),
  ('locations', 'publish', 'locations', 'unpublish'),
  ('banners', 'view', 'banners', 'view'),
  ('banners', 'create', 'banners', 'create'),
  ('banners', 'edit', 'banners', 'edit'),
  ('banners', 'edit', 'banners', 'archive'),
  ('banners', 'edit', 'banners', 'restore'),
  ('banners', 'delete', 'banners', 'delete'),
  ('banners', 'publish', 'banners', 'publish'),
  ('banners', 'publish', 'banners', 'unpublish'),
  ('commodities', 'view', 'commodities', 'view'),
  ('commodities', 'view', 'commodity_prices', 'view'),
  ('commodities', 'create', 'commodities', 'create'),
  ('commodities', 'create', 'commodity_prices', 'create'),
  ('commodities', 'edit', 'commodities', 'edit'),
  ('commodities', 'edit', 'commodities', 'archive'),
  ('commodities', 'edit', 'commodities', 'restore'),
  ('commodities', 'edit', 'commodity_prices', 'edit'),
  ('commodities', 'delete', 'commodities', 'delete'),
  ('commodities', 'delete', 'commodity_prices', 'delete'),
  ('commodities', 'publish', 'commodities', 'publish'),
  ('commodities', 'publish', 'commodities', 'unpublish'),
  ('commodities', 'publish', 'commodity_prices', 'publish'),
  ('commodities', 'publish', 'commodity_prices', 'unpublish'),
  ('trade', 'view', 'trade_opportunities', 'view'),
  ('trade', 'view', 'rfqs', 'view'),
  ('trade', 'create', 'trade_opportunities', 'create'),
  ('trade', 'edit', 'trade_opportunities', 'edit'),
  ('trade', 'edit', 'trade_opportunities', 'archive'),
  ('trade', 'edit', 'trade_opportunities', 'change_status'),
  ('trade', 'edit', 'rfqs', 'edit'),
  ('trade', 'edit', 'rfqs', 'change_status'),
  ('trade', 'edit', 'rfqs', 'assign'),
  ('trade', 'edit', 'rfqs', 'download'),
  ('trade', 'delete', 'trade_opportunities', 'delete'),
  ('trade', 'delete', 'rfqs', 'delete'),
  ('trade', 'publish', 'trade_opportunities', 'publish'),
  ('trade', 'publish', 'trade_opportunities', 'unpublish'),
  ('enquiries', 'view', 'enquiries', 'view'),
  ('enquiries', 'edit', 'enquiries', 'edit'),
  ('enquiries', 'edit', 'enquiries', 'change_status'),
  ('enquiries', 'edit', 'enquiries', 'assign'),
  ('enquiries', 'delete', 'enquiries', 'delete'),
  ('applications', 'view', 'job_applications', 'view'),
  ('applications', 'edit', 'job_applications', 'edit'),
  ('applications', 'edit', 'job_applications', 'change_status'),
  ('applications', 'edit', 'job_applications', 'download'),
  ('applications', 'delete', 'job_applications', 'delete'),
  ('media', 'view', 'media', 'view'),
  ('media', 'view', 'documents', 'view'),
  ('media', 'create', 'media', 'upload'),
  ('media', 'create', 'documents', 'upload'),
  ('media', 'edit', 'media', 'edit'),
  ('media', 'edit', 'media', 'download'),
  ('media', 'edit', 'documents', 'edit'),
  ('media', 'edit', 'documents', 'archive'),
  ('media', 'edit', 'documents', 'download'),
  ('media', 'delete', 'media', 'delete'),
  ('media', 'delete', 'documents', 'delete'),
  ('media', 'publish', 'documents', 'publish'),
  ('media', 'publish', 'documents', 'unpublish'),
  ('users', 'view', 'users', 'view'),
  ('users', 'view', 'roles', 'view'),
  ('users', 'view', 'activity_logs', 'view'),
  ('users', 'view', 'user_permissions', 'view'),
  ('users', 'view', 'user_dashboards', 'view'),
  ('users', 'create', 'users', 'create'),
  ('users', 'create', 'roles', 'create'),
  ('users', 'edit', 'users', 'edit'),
  ('users', 'edit', 'users', 'change_status'),
  ('users', 'edit', 'users', 'assign'),
  ('users', 'edit', 'roles', 'edit'),
  ('users', 'edit', 'roles', 'change_status'),
  ('users', 'edit', 'roles', 'assign'),
  ('users', 'edit', 'user_dashboards', 'edit'),
  ('users', 'delete', 'roles', 'delete'),
  ('settings', 'view', 'settings_general', 'view'),
  ('settings', 'view', 'settings_navigation', 'view'),
  ('settings', 'view', 'settings_seo', 'view'),
  ('settings', 'view', 'settings_contact', 'view'),
  ('settings', 'view', 'settings_footer', 'view'),
  ('settings', 'view', 'email_templates', 'view'),
  ('settings', 'view', 'notification_history', 'view'),
  ('settings', 'create', 'email_templates', 'create'),
  ('settings', 'edit', 'settings_general', 'manage_settings'),
  ('settings', 'edit', 'settings_navigation', 'manage_settings'),
  ('settings', 'edit', 'settings_seo', 'manage_settings'),
  ('settings', 'edit', 'settings_contact', 'manage_settings'),
  ('settings', 'edit', 'settings_footer', 'manage_settings'),
  ('settings', 'edit', 'email_templates', 'edit'),
  ('settings', 'edit', 'notification_history', 'change_status'),
  ('settings', 'delete', 'email_templates', 'delete');

-- 4a. every catalogue permission exists (rows that already match keep their id).
INSERT INTO "Permission" ("id", "resource", "action", "module")
SELECT gen_random_uuid(), c."resource", c."action", c."module" FROM _catalogue c
ON CONFLICT ("resource", "action") DO UPDATE SET "module" = EXCLUDED."module";

-- 4b. copy every existing role grant onto the mapped catalogue permissions (scope all).
INSERT INTO "RolePermission" ("roleId", "permissionId", "scope")
SELECT DISTINCT rp."roleId", np."id", 'all'::"GrantScope"
FROM "RolePermission" rp
JOIN "Permission" op ON op."id" = rp."permissionId"
JOIN _legacy_map m ON m."old_res" = op."resource" AND m."old_act" = op."action"
JOIN "Permission" np ON np."resource" = m."new_res" AND np."action" = m."new_act"
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 4c. the Super Admin role lists every permission (it is also special-cased by code in the resolver).
INSERT INTO "RolePermission" ("roleId", "permissionId", "scope")
SELECT r."id", p."id", 'all'::"GrantScope" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."code" = 'super_admin' AND EXISTS (SELECT 1 FROM _catalogue c WHERE c."resource" = p."resource" AND c."action" = p."action")
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 4d. remove ONLY legacy permission rows that are not in the catalogue (their grants were expanded above).
DELETE FROM "RolePermission" rp USING "Permission" p
WHERE p."id" = rp."permissionId"
  AND NOT EXISTS (SELECT 1 FROM _catalogue c WHERE c."resource" = p."resource" AND c."action" = p."action");
DELETE FROM "Permission" p
WHERE NOT EXISTS (SELECT 1 FROM _catalogue c WHERE c."resource" = p."resource" AND c."action" = p."action");

DROP TABLE _legacy_map;
DROP TABLE _catalogue;
DROP TYPE "PermissionModule";
DROP TYPE "PermissionAction";

-- == 5. AdminUser: employee profile fields ======================================================================
ALTER TABLE "AdminUser" ADD COLUMN "employeeId" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN "phone" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN "department" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN "designation" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN "profileImageFileId" UUID;
ALTER TABLE "AdminUser" ADD COLUMN "reportingManagerId" UUID;
ALTER TABLE "AdminUser" ADD COLUMN "deactivatedAt" TIMESTAMPTZ;

WITH numbered AS (SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS rn FROM "AdminUser")
UPDATE "AdminUser" u SET "employeeId" = 'EMP-' || lpad(n.rn::text, 4, '0') FROM numbered n WHERE u."id" = n."id";
UPDATE "AdminUser" SET "deactivatedAt" = "updatedAt" WHERE "status" = 'suspended';

ALTER TABLE "AdminUser" ALTER COLUMN "employeeId" SET NOT NULL;
CREATE UNIQUE INDEX "AdminUser_employeeId_key" ON "AdminUser"("employeeId");
CREATE INDEX "AdminUser_department_idx" ON "AdminUser"("department");
CREATE INDEX "AdminUser_reportingManagerId_idx" ON "AdminUser"("reportingManagerId");
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_profileImageFileId_fkey" FOREIGN KEY ("profileImageFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_reportingManagerId_fkey" FOREIGN KEY ("reportingManagerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- == 6. UserRole (many roles per user): copy, verify, then drop the single-role column ==========================
CREATE TABLE "UserRole" (
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "assignedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" UUID,
    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId", "roleId")
);
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "UserRole" ("userId", "roleId") SELECT "id", "roleId" FROM "AdminUser";

DO $$
BEGIN
  IF (SELECT count(*) FROM "AdminUser") <> (SELECT count(DISTINCT "userId") FROM "UserRole") THEN
    RAISE EXCEPTION 'RBAC migration aborted: UserRole backfill is incomplete, AdminUser.roleId was NOT dropped';
  END IF;
END $$;

ALTER TABLE "AdminUser" DROP COLUMN "roleId";

-- == 7. Individual permission overrides ==========================================================================
CREATE TABLE "UserPermissionOverride" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "effect" "OverrideEffect" NOT NULL,
    "scope" "GrantScope" NOT NULL DEFAULT 'all',
    "reason" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserPermissionOverride_userId_permissionId_key" ON "UserPermissionOverride"("userId", "permissionId");
CREATE INDEX "UserPermissionOverride_permissionId_idx" ON "UserPermissionOverride"("permissionId");
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- == 8. Dashboard preferences ====================================================================================
CREATE TABLE "UserDashboardPreference" (
    "userId" UUID NOT NULL,
    "widgets" JSONB NOT NULL,
    "quickActions" JSONB NOT NULL,
    "updatedById" UUID,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "UserDashboardPreference_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "UserDashboardPreference" ADD CONSTRAINT "UserDashboardPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- == 9. Permission change history (append-only) ==================================================================
CREATE TABLE "PermissionChangeLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "actorName" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" UUID NOT NULL,
    "targetLabel" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "change" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PermissionChangeLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PermissionChangeLog_targetType_targetId_createdAt_idx" ON "PermissionChangeLog"("targetType", "targetId", "createdAt" DESC);
CREATE INDEX "PermissionChangeLog_actorId_createdAt_idx" ON "PermissionChangeLog"("actorId", "createdAt" DESC);
ALTER TABLE "PermissionChangeLog" ADD CONSTRAINT "PermissionChangeLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- (Scope "assigned" is validated against the catalogue in the application; PostgreSQL CHECKs cannot use subqueries.)
