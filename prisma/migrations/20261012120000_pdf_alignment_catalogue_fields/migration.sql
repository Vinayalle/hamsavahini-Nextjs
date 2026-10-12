-- Align the model with the business requirements document (PDF) and extend the catalogue.
-- DATA-PRESERVING: every existing enum value is mapped to its PDF equivalent; new columns are nullable or defaulted.
-- ASCII only on purpose.

-- == 1. Location types (PDF 6): mines, sourcing, suppliers, facilities, warehouses, ports, markets, destinations ====
ALTER TYPE "LocationType" ADD VALUE IF NOT EXISTS 'mine';
ALTER TYPE "LocationType" ADD VALUE IF NOT EXISTS 'sourcing_location';
ALTER TYPE "LocationType" ADD VALUE IF NOT EXISTS 'supplier';
ALTER TYPE "LocationType" ADD VALUE IF NOT EXISTS 'processing_facility';
ALTER TYPE "LocationType" ADD VALUE IF NOT EXISTS 'market';
ALTER TYPE "LocationType" ADD VALUE IF NOT EXISTS 'trading_destination';

ALTER TABLE "Location" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Location" ADD COLUMN "operations" TEXT;
ALTER TABLE "Location" ADD COLUMN "capacity" TEXT;

-- == 2. Currencies (PDF 21) ==========================================================================================
ALTER TYPE "Currency" ADD VALUE IF NOT EXISTS 'CNY';

-- == 3. Document visibility (PDF 18): Public / Private / Restricted ====================================================
ALTER TYPE "FileVisibility" ADD VALUE IF NOT EXISTS 'restricted';

-- == 4. RFQ workflow (PDF 7): New -> Contacted -> Under Discussion -> Quotation Sent -> Closed ========================
CREATE TYPE "RfqStatus_new" AS ENUM ('new', 'contacted', 'under_discussion', 'quotation_sent', 'closed');
ALTER TABLE "Rfq" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Rfq" ALTER COLUMN "status" TYPE "RfqStatus_new" USING (CASE "status"::text WHEN 'new' THEN 'new' WHEN 'in_review' THEN 'contacted' WHEN 'quoted' THEN 'quotation_sent' WHEN 'negotiation' THEN 'under_discussion' WHEN 'won' THEN 'closed' WHEN 'lost' THEN 'closed' END)::"RfqStatus_new";
ALTER TABLE "Rfq" ALTER COLUMN "status" SET DEFAULT 'new';
DROP TYPE "RfqStatus";
ALTER TYPE "RfqStatus_new" RENAME TO "RfqStatus";

-- == 5. Contact enquiries (PDF 8): mark as contacted / closed ===========================================================
CREATE TYPE "EnquiryStatus_new" AS ENUM ('new', 'contacted', 'closed', 'spam');
ALTER TABLE "ContactEnquiry" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ContactEnquiry" ALTER COLUMN "status" TYPE "EnquiryStatus_new" USING (CASE "status"::text WHEN 'new' THEN 'new' WHEN 'in_progress' THEN 'contacted' WHEN 'resolved' THEN 'closed' WHEN 'spam' THEN 'spam' END)::"EnquiryStatus_new";
ALTER TABLE "ContactEnquiry" ALTER COLUMN "status" SET DEFAULT 'new';
DROP TYPE "EnquiryStatus";
ALTER TYPE "EnquiryStatus_new" RENAME TO "EnquiryStatus";

-- == 6. Live commodity desk statuses (PDF 11D) ==========================================================================
CREATE TYPE "OpportunityCategory" AS ENUM ('available_for_sale', 'buying_requirement', 'active_enquiry', 'spot', 'long_term', 'upcoming_shipment');
CREATE TYPE "OpportunityStatus_new" AS ENUM ('draft', 'available', 'limited_availability', 'under_negotiation', 'sold', 'requirement_open', 'closed');
ALTER TABLE "TradeOpportunity" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "TradeOpportunity" ALTER COLUMN "status" TYPE "OpportunityStatus_new" USING (CASE "status"::text WHEN 'draft' THEN 'draft' WHEN 'open' THEN 'available' WHEN 'under_review' THEN 'under_negotiation' WHEN 'closed' THEN 'closed' END)::"OpportunityStatus_new";
ALTER TABLE "TradeOpportunity" ALTER COLUMN "status" SET DEFAULT 'draft';
DROP TYPE "OpportunityStatus";
ALTER TYPE "OpportunityStatus_new" RENAME TO "OpportunityStatus";
ALTER TABLE "TradeOpportunity" ADD COLUMN "category" "OpportunityCategory" NOT NULL DEFAULT 'available_for_sale';
-- A buying opportunity that was "open" is a requirement, not a sale offer.
UPDATE "TradeOpportunity" SET "status" = 'requirement_open', "category" = 'buying_requirement' WHERE "type" = 'buy' AND "status" = 'available';

-- == 7. Product catalogue fields (PDF 5) =================================================================================
CREATE TYPE "AvailabilityStatus" AS ENUM ('available', 'limited_availability', 'under_negotiation', 'sold', 'out_of_stock');
ALTER TABLE "Product" ADD COLUMN "origin" TEXT;
ALTER TABLE "Product" ADD COLUMN "availableQuantity" DECIMAL(18,3);
ALTER TABLE "Product" ADD COLUMN "quantityUnit" TEXT;
ALTER TABLE "Product" ADD COLUMN "grade" TEXT;
ALTER TABLE "Product" ADD COLUMN "applications" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Product" ADD COLUMN "packaging" TEXT;
ALTER TABLE "Product" ADD COLUMN "loadingPort" TEXT;
ALTER TABLE "Product" ADD COLUMN "targetMarket" TEXT;
ALTER TABLE "Product" ADD COLUMN "availability" "AvailabilityStatus" NOT NULL DEFAULT 'available';
