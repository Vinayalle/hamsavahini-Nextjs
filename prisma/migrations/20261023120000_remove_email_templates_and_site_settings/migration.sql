-- Removes the features that were taken out of the admin: stored email templates (the emails are fixed in the code now) and the
-- website settings pages (general, navigation, SEO, contact, footer; the website reads fixed values from the code).
-- Nothing the application still uses is touched. The two data clean-ups below only remove rows that no screen can reach any more.

-- Email templates: the table, and the never-used link to it from the notification history.
-- DropForeignKey
ALTER TABLE "NotificationLog" DROP CONSTRAINT "NotificationLog_templateId_fkey";

-- DropIndex
DROP INDEX "NotificationLog_templateId_idx";

-- AlterTable
ALTER TABLE "NotificationLog" DROP COLUMN "templateId";

-- DropTable
DROP TABLE "EmailTemplate";

-- Permissions that belonged to the removed pages (grants first, then the permissions themselves).
DELETE FROM "UserPermissionOverride" WHERE "permissionId" IN (SELECT "id" FROM "Permission" WHERE "resource" IN ('email_templates', 'settings_general', 'settings_navigation', 'settings_seo', 'settings_contact', 'settings_footer'));
DELETE FROM "RolePermission" WHERE "permissionId" IN (SELECT "id" FROM "Permission" WHERE "resource" IN ('email_templates', 'settings_general', 'settings_navigation', 'settings_seo', 'settings_contact', 'settings_footer'));
DELETE FROM "Permission" WHERE "resource" IN ('email_templates', 'settings_general', 'settings_navigation', 'settings_seo', 'settings_contact', 'settings_footer');

-- Saved values of the removed settings pages. (The dashboard layout setting, key dashboard_default, is kept.)
DELETE FROM "SiteSetting" WHERE "key" IN ('site.general', 'site.navigation', 'site.seo', 'site.contact', 'site.footer');
