-- Removes the banners feature: the home-page banner is now fixed in the code, so there is nothing for an editor to manage.
-- Only the banner table, its type and the banner permissions are removed; nothing the application still uses is touched.

-- Permissions of the removed page (grants first, then the permission itself).
DELETE FROM "UserPermissionOverride" WHERE "permissionId" IN (SELECT "id" FROM "Permission" WHERE "resource" = 'banners');
DELETE FROM "RolePermission" WHERE "permissionId" IN (SELECT "id" FROM "Permission" WHERE "resource" = 'banners');
DELETE FROM "Permission" WHERE "resource" = 'banners';

-- Picture records that only banners used (their file name starts with banners/). The files themselves were in uploads/banners.
-- A record that anything else still points at is kept.
DELETE FROM "StoredFile" f
WHERE f."storageKey" LIKE 'banners/%'
  AND NOT EXISTS (SELECT 1 FROM "MediaAsset" x WHERE x."fileId" = f."id")
  AND NOT EXISTS (SELECT 1 FROM "DocumentFile" x WHERE x."fileId" = f."id")
  AND NOT EXISTS (SELECT 1 FROM "ProductImage" x WHERE x."fileId" = f."id")
  AND NOT EXISTS (SELECT 1 FROM "ProductDocument" x WHERE x."fileId" = f."id")
  AND NOT EXISTS (SELECT 1 FROM "Post" x WHERE x."coverFileId" = f."id")
  AND NOT EXISTS (SELECT 1 FROM "JobApplication" x WHERE x."resumeFileId" = f."id")
  AND NOT EXISTS (SELECT 1 FROM "AdminUser" x WHERE x."profileImageFileId" = f."id");

-- DropForeignKey
ALTER TABLE "Banner" DROP CONSTRAINT "Banner_imageFileId_fkey";

-- DropTable
DROP TABLE "Banner";

-- DropEnum
DROP TYPE "BannerSection";
