-- Email one-time codes as the second sign-in step for Super Admins / Admins. ADDITIVE: one new enum value, nothing else.
ALTER TYPE "ChallengePurpose" ADD VALUE IF NOT EXISTS 'login';
