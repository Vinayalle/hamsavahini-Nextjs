-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'invited', 'suspended');

-- CreateEnum
CREATE TYPE "PermissionModule" AS ENUM ('products', 'categories', 'posts', 'projects', 'careers', 'locations', 'banners', 'commodities', 'trade', 'enquiries', 'applications', 'media', 'users', 'settings');

-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('view', 'create', 'edit', 'delete', 'publish');

-- CreateEnum
CREATE TYPE "UserTokenType" AS ENUM ('invite', 'password_reset');

-- CreateEnum
CREATE TYPE "PostCategory" AS ENUM ('market_insight', 'company_news', 'sustainability', 'industry_report');

-- CreateEnum
CREATE TYPE "ProjectStage" AS ENUM ('planning', 'active', 'completed', 'on_hold');

-- CreateEnum
CREATE TYPE "CareerStatus" AS ENUM ('draft', 'open', 'closed');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('full_time', 'part_time', 'contract', 'internship');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('new', 'screening', 'interview', 'offer', 'hired', 'rejected');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('headquarters', 'regional_office', 'warehouse', 'port_terminal', 'representative');

-- CreateEnum
CREATE TYPE "BannerSection" AS ENUM ('hero', 'promo', 'feature_strip', 'cta');

-- CreateEnum
CREATE TYPE "CommodityGroup" AS ENUM ('Energy', 'Metals', 'Agriculture', 'Chemicals', 'Minerals');

-- CreateEnum
CREATE TYPE "PriceStatus" AS ENUM ('draft', 'published');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'EUR', 'INR', 'AED');

-- CreateEnum
CREATE TYPE "OpportunityType" AS ENUM ('buy', 'sell');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('draft', 'open', 'under_review', 'closed');

-- CreateEnum
CREATE TYPE "RfqStatus" AS ENUM ('new', 'in_review', 'quoted', 'negotiation', 'won', 'lost');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('new', 'in_progress', 'resolved', 'spam');

-- CreateEnum
CREATE TYPE "EnquirySource" AS ENUM ('contact_page', 'footer_form', 'product_page');

-- CreateEnum
CREATE TYPE "StoredFileKind" AS ENUM ('image', 'video', 'document', 'resume');

-- CreateEnum
CREATE TYPE "FileVisibility" AS ENUM ('public', 'private');

-- CreateEnum
CREATE TYPE "FileScanStatus" AS ENUM ('pending', 'clean', 'quarantined');

-- CreateEnum
CREATE TYPE "ProductDocumentType" AS ENUM ('datasheet', 'coa', 'msds', 'brochure', 'other');

-- CreateEnum
CREATE TYPE "LibraryDocumentCategory" AS ENUM ('certificate', 'policy', 'brochure', 'datasheet', 'legal', 'report');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('queued', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('created', 'updated', 'deleted', 'published', 'archived', 'status_changed', 'login', 'login_failed', 'logout', 'viewed_sensitive');

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "module" "PermissionModule" NOT NULL,
    "action" "PermissionAction" NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "roleId" UUID NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'invited',
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ,
    "lastLoginAt" TIMESTAMPTZ,
    "passwordChangedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "UserTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "usedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "sha256" TEXT,
    "kind" "StoredFileKind" NOT NULL,
    "visibility" "FileVisibility" NOT NULL DEFAULT 'private',
    "scanStatus" "FileScanStatus" NOT NULL DEFAULT 'pending',
    "uploadedById" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "altText" TEXT NOT NULL DEFAULT '',
    "folder" TEXT NOT NULL DEFAULT 'Uploads',
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentFile" (
    "id" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category" "LibraryDocumentCategory" NOT NULL,
    "version" TEXT NOT NULL,
    "visibility" "FileVisibility" NOT NULL DEFAULT 'public',
    "status" "PublishStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "DocumentFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "parentId" UUID,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "PublishStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" UUID NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'draft',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMPTZ,
    "metaTitle" TEXT NOT NULL DEFAULT '',
    "metaDescription" TEXT NOT NULL DEFAULT '',
    "canonicalUrl" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSpecification" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductSpecification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "alt" TEXT NOT NULL DEFAULT '',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductDocument" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "type" "ProductDocumentType" NOT NULL DEFAULT 'other',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "category" "PostCategory" NOT NULL,
    "authorName" TEXT NOT NULL,
    "coverFileId" UUID,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metaTitle" TEXT NOT NULL DEFAULT '',
    "metaDescription" TEXT NOT NULL DEFAULT '',
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "PublishStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "commodityName" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "stage" "ProjectStage" NOT NULL DEFAULT 'planning',
    "status" "PublishStatus" NOT NULL DEFAULT 'draft',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Career" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "employmentType" "EmploymentType" NOT NULL,
    "experience" TEXT NOT NULL,
    "descriptionHtml" TEXT NOT NULL,
    "requirementsHtml" TEXT NOT NULL,
    "deadline" DATE NOT NULL,
    "openings" INTEGER NOT NULL DEFAULT 1,
    "status" "CareerStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Career_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" UUID NOT NULL,
    "careerId" UUID NOT NULL,
    "applicantName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "currentCompany" TEXT,
    "experienceYears" INTEGER NOT NULL,
    "coverNote" TEXT NOT NULL DEFAULT '',
    "resumeFileId" UUID,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'new',
    "consentAt" TIMESTAMPTZ,
    "anonymizedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationNote" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "authorId" UUID,
    "authorName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LocationType" NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Banner" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL DEFAULT '',
    "section" "BannerSection" NOT NULL,
    "imageFileId" UUID,
    "ctaLabel" TEXT NOT NULL,
    "ctaUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "PublishStatus" NOT NULL DEFAULT 'draft',
    "startsAt" TIMESTAMPTZ,
    "endsAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commodity" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "group" "CommodityGroup" NOT NULL,
    "unit" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Commodity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommodityPrice" (
    "id" UUID NOT NULL,
    "commodityId" UUID NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "unit" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "status" "PriceStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CommodityPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeOpportunity" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "commodityId" UUID NOT NULL,
    "type" "OpportunityType" NOT NULL,
    "quantityValue" DECIMAL(18,3) NOT NULL,
    "quantityUnit" TEXT NOT NULL,
    "originRegion" TEXT NOT NULL,
    "destinationRegion" TEXT NOT NULL,
    "incoterm" TEXT NOT NULL,
    "validUntil" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "TradeOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rfq" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "quantityUnit" TEXT NOT NULL,
    "targetPrice" TEXT,
    "incoterm" TEXT NOT NULL,
    "deliveryPort" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "RfqStatus" NOT NULL DEFAULT 'new',
    "assignedToId" UUID,
    "consentAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Rfq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqNote" (
    "id" UUID NOT NULL,
    "rfqId" UUID NOT NULL,
    "authorId" UUID,
    "authorName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfqNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactEnquiry" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "source" "EnquirySource" NOT NULL,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'new',
    "assignedToId" UUID,
    "consentAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ContactEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnquiryNote" (
    "id" UUID NOT NULL,
    "enquiryId" UUID NOT NULL,
    "authorId" UUID,
    "authorName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnquiryNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" UUID NOT NULL,
    "templateId" UUID,
    "templateKey" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "providerMessageId" TEXT,
    "sentAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "actorName" TEXT NOT NULL,
    "action" "ActivityAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "entityLabel" TEXT NOT NULL,
    "detail" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" UUID,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_module_action_key" ON "Permission"("module", "action");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "AdminUser_roleId_idx" ON "AdminUser"("roleId");

-- CreateIndex
CREATE INDEX "AdminUser_status_idx" ON "AdminUser"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserToken_tokenHash_key" ON "UserToken"("tokenHash");

-- CreateIndex
CREATE INDEX "UserToken_userId_type_idx" ON "UserToken"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_storageKey_key" ON "StoredFile"("storageKey");

-- CreateIndex
CREATE INDEX "StoredFile_kind_createdAt_idx" ON "StoredFile"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "StoredFile_uploadedById_idx" ON "StoredFile"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_fileId_key" ON "MediaAsset"("fileId");

-- CreateIndex
CREATE INDEX "MediaAsset_folder_idx" ON "MediaAsset"("folder");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentFile_fileId_key" ON "DocumentFile"("fileId");

-- CreateIndex
CREATE INDEX "DocumentFile_status_category_idx" ON "DocumentFile"("status", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE INDEX "Category_status_sortOrder_idx" ON "Category"("status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_status_updatedAt_idx" ON "Product"("status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "Product_featured_status_idx" ON "Product"("featured", "status");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSpecification_productId_label_key" ON "ProductSpecification"("productId", "label");

-- CreateIndex
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_productId_fileId_key" ON "ProductImage"("productId", "fileId");

-- CreateIndex
CREATE INDEX "ProductDocument_productId_idx" ON "ProductDocument"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductDocument_productId_fileId_key" ON "ProductDocument"("productId", "fileId");

-- CreateIndex
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");

-- CreateIndex
CREATE INDEX "Post_status_publishedAt_idx" ON "Post"("status", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "Post_category_idx" ON "Post"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Project_status_stage_idx" ON "Project"("status", "stage");

-- CreateIndex
CREATE INDEX "Project_featured_status_idx" ON "Project"("featured", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Career_slug_key" ON "Career"("slug");

-- CreateIndex
CREATE INDEX "Career_status_deadline_idx" ON "Career"("status", "deadline");

-- CreateIndex
CREATE INDEX "Career_department_idx" ON "Career"("department");

-- CreateIndex
CREATE INDEX "JobApplication_careerId_status_idx" ON "JobApplication"("careerId", "status");

-- CreateIndex
CREATE INDEX "JobApplication_email_idx" ON "JobApplication"("email");

-- CreateIndex
CREATE INDEX "JobApplication_status_createdAt_idx" ON "JobApplication"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ApplicationNote_applicationId_createdAt_idx" ON "ApplicationNote"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "Location_country_idx" ON "Location"("country");

-- CreateIndex
CREATE INDEX "Location_active_sortOrder_idx" ON "Location"("active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Location_name_city_key" ON "Location"("name", "city");

-- CreateIndex
CREATE INDEX "Banner_section_status_sortOrder_idx" ON "Banner"("section", "status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Commodity_slug_key" ON "Commodity"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Commodity_code_key" ON "Commodity"("code");

-- CreateIndex
CREATE INDEX "Commodity_group_status_idx" ON "Commodity"("group", "status");

-- CreateIndex
CREATE INDEX "CommodityPrice_commodityId_effectiveDate_idx" ON "CommodityPrice"("commodityId", "effectiveDate" DESC);

-- CreateIndex
CREATE INDEX "CommodityPrice_status_effectiveDate_idx" ON "CommodityPrice"("status", "effectiveDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "CommodityPrice_commodityId_market_effectiveDate_key" ON "CommodityPrice"("commodityId", "market", "effectiveDate");

-- CreateIndex
CREATE INDEX "TradeOpportunity_status_validUntil_idx" ON "TradeOpportunity"("status", "validUntil");

-- CreateIndex
CREATE INDEX "TradeOpportunity_commodityId_idx" ON "TradeOpportunity"("commodityId");

-- CreateIndex
CREATE UNIQUE INDEX "Rfq_reference_key" ON "Rfq"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Rfq_seq_key" ON "Rfq"("seq");

-- CreateIndex
CREATE INDEX "Rfq_status_createdAt_idx" ON "Rfq"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Rfq_assignedToId_idx" ON "Rfq"("assignedToId");

-- CreateIndex
CREATE INDEX "Rfq_email_idx" ON "Rfq"("email");

-- CreateIndex
CREATE INDEX "RfqNote_rfqId_createdAt_idx" ON "RfqNote"("rfqId", "createdAt");

-- CreateIndex
CREATE INDEX "ContactEnquiry_status_createdAt_idx" ON "ContactEnquiry"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ContactEnquiry_assignedToId_idx" ON "ContactEnquiry"("assignedToId");

-- CreateIndex
CREATE INDEX "ContactEnquiry_email_idx" ON "ContactEnquiry"("email");

-- CreateIndex
CREATE INDEX "EnquiryNote_enquiryId_createdAt_idx" ON "EnquiryNote"("enquiryId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_key_key" ON "EmailTemplate"("key");

-- CreateIndex
CREATE INDEX "NotificationLog_status_createdAt_idx" ON "NotificationLog"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "NotificationLog_recipient_idx" ON "NotificationLog"("recipient");

-- CreateIndex
CREATE INDEX "NotificationLog_templateId_idx" ON "NotificationLog"("templateId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_actorId_createdAt_idx" ON "ActivityLog"("actorId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserToken" ADD CONSTRAINT "UserToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFile" ADD CONSTRAINT "DocumentFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSpecification" ADD CONSTRAINT "ProductSpecification_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDocument" ADD CONSTRAINT "ProductDocument_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDocument" ADD CONSTRAINT "ProductDocument_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_coverFileId_fkey" FOREIGN KEY ("coverFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_resumeFileId_fkey" FOREIGN KEY ("resumeFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationNote" ADD CONSTRAINT "ApplicationNote_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationNote" ADD CONSTRAINT "ApplicationNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_imageFileId_fkey" FOREIGN KEY ("imageFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommodityPrice" ADD CONSTRAINT "CommodityPrice_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOpportunity" ADD CONSTRAINT "TradeOpportunity_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "Commodity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqNote" ADD CONSTRAINT "RfqNote_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqNote" ADD CONSTRAINT "RfqNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactEnquiry" ADD CONSTRAINT "ContactEnquiry_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryNote" ADD CONSTRAINT "EnquiryNote_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "ContactEnquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryNote" ADD CONSTRAINT "EnquiryNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Constraints Prisma cannot express in schema.prisma
-- ---------------------------------------------------------------------------

-- Exactly one primary image per product.
CREATE UNIQUE INDEX "ProductImage_one_primary_per_product" ON "ProductImage"("productId") WHERE "isPrimary";

-- A category cannot be its own parent (longer cycles are rejected by the application).
ALTER TABLE "Category" ADD CONSTRAINT "Category_no_self_parent" CHECK ("parentId" IS NULL OR "parentId" <> "id");

-- Normalisation is enforced by the database, not only by the application.
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_email_lowercase" CHECK ("email" = lower("email"));
ALTER TABLE "Product" ADD CONSTRAINT "Product_code_uppercase" CHECK ("code" = upper("code"));
ALTER TABLE "Commodity" ADD CONSTRAINT "Commodity_code_uppercase" CHECK ("code" = upper("code"));

-- Range / consistency checks.
ALTER TABLE "CommodityPrice" ADD CONSTRAINT "CommodityPrice_price_positive" CHECK ("price" > 0);
ALTER TABLE "Career" ADD CONSTRAINT "Career_openings_positive" CHECK ("openings" >= 1);
ALTER TABLE "Project" ADD CONSTRAINT "Project_dates_ordered" CHECK ("endDate" IS NULL OR "endDate" >= "startDate");
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_schedule_ordered" CHECK ("endsAt" IS NULL OR "startsAt" IS NULL OR "endsAt" >= "startsAt");
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_experience_nonnegative" CHECK ("experienceYears" >= 0);
