-- Removes the wrong-password lockout (it was dropped from the sign-in) and clears every stored sign-in/auth request counter.
-- The "RateLimit" table itself stays: the public website forms (contact, quotation, job application) still use it against spam.

-- AlterTable
ALTER TABLE "AdminUser" DROP COLUMN "failedLoginCount",
DROP COLUMN "lockedUntil";

-- Old counters of the admin sign-in flow (they no longer have any effect). Website-form counters ('public:...') are kept.
DELETE FROM "RateLimit" WHERE "key" NOT LIKE 'public:%';
