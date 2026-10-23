-- Removes the authenticator-app (TOTP) second factor. Sign-in keeps its second step: the 6-digit code emailed after the password.
-- Stored authenticator secrets and recovery codes are deleted with their tables; nothing else uses them.

-- DropForeignKey
ALTER TABLE "MfaCredential" DROP CONSTRAINT "MfaCredential_userId_fkey";

-- DropForeignKey
ALTER TABLE "MfaRecoveryCode" DROP CONSTRAINT "MfaRecoveryCode_userId_fkey";

-- AlterTable
ALTER TABLE "AdminUser" DROP COLUMN "twoFactorEnabled";

-- DropTable
DROP TABLE "MfaCredential";

-- DropTable
DROP TABLE "MfaRecoveryCode";
