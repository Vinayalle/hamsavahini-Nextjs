-- Secure authentication: access JWT + rotating refresh tokens, email OTP activation, TOTP MFA, shared rate limits.
-- ADDITIVE and data-preserving: nothing is dropped. The only relaxed constraint is Session.tokenHash (now optional)
-- because new sessions no longer use it. Pre-existing cookie sessions stay in place and simply expire (they cannot be used
-- with the new JWT scheme). ASCII only on purpose.

-- == 1. New enum values / types =======================================================================================
ALTER TYPE "UserTokenType" ADD VALUE IF NOT EXISTS 'activation_grant';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'otp_requested';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'otp_verified';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'otp_failed';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'mfa_enrolled';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'mfa_disabled';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'mfa_reset';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'mfa_failed';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'token_reuse';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'reauth';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'account_activated';
CREATE TYPE "ChallengePurpose" AS ENUM ('activation');

-- == 2. AdminUser: verified mailbox ====================================================================================
ALTER TABLE "AdminUser" ADD COLUMN "emailVerifiedAt" TIMESTAMPTZ;
-- Accounts that already set a password through the earlier invitation link proved mailbox ownership at that time.
UPDATE "AdminUser" SET "emailVerifiedAt" = COALESCE("passwordChangedAt", "createdAt") WHERE "passwordHash" IS NOT NULL AND "status" = 'active';

-- == 3. Session becomes the refresh-token family =====================================================================
ALTER TABLE "Session" ALTER COLUMN "tokenHash" DROP NOT NULL;
ALTER TABLE "Session" ADD COLUMN "mfaVerifiedAt" TIMESTAMPTZ;
ALTER TABLE "Session" ADD COLUMN "reauthAt" TIMESTAMPTZ;

CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "usedAt" TIMESTAMPTZ,
    "replacedById" UUID,
    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_sessionId_idx" ON "RefreshToken"("sessionId");
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- == 4. Email OTP challenges ==========================================================================================
CREATE TABLE "AuthChallenge" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" "ChallengePurpose" NOT NULL,
    "codeDigest" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "consumedAt" TIMESTAMPTZ,
    "invalidatedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    CONSTRAINT "AuthChallenge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuthChallenge_userId_purpose_createdAt_idx" ON "AuthChallenge"("userId", "purpose", "createdAt" DESC);
ALTER TABLE "AuthChallenge" ADD CONSTRAINT "AuthChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Counters can never go negative or exceed the limit by more than the single in-flight attempt.
ALTER TABLE "AuthChallenge" ADD CONSTRAINT "AuthChallenge_attempts_range" CHECK ("attempts" >= 0 AND "maxAttempts" > 0);

-- == 5. TOTP MFA ======================================================================================================
CREATE TABLE "MfaCredential" (
    "userId" UUID NOT NULL,
    "secretEnc" TEXT NOT NULL,
    "enabledAt" TIMESTAMPTZ,
    "lastUsedStep" BIGINT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "MfaCredential_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "MfaCredential" ADD CONSTRAINT "MfaCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MfaRecoveryCode" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "codeDigest" TEXT NOT NULL,
    "usedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MfaRecoveryCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MfaRecoveryCode_userId_codeDigest_key" ON "MfaRecoveryCode"("userId", "codeDigest");
CREATE INDEX "MfaRecoveryCode_userId_idx" ON "MfaRecoveryCode"("userId");
ALTER TABLE "MfaRecoveryCode" ADD CONSTRAINT "MfaRecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- == 6. Shared rate limiting ==========================================================================================
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMPTZ NOT NULL,
    "count" INTEGER NOT NULL,
    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);
