-- Products no longer have their own search-engine fields. The website builds a product page's title and description from the
-- product name and short description. Posts keep their own SEO fields.

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "canonicalUrl",
DROP COLUMN "keywords",
DROP COLUMN "metaDescription",
DROP COLUMN "metaTitle";
