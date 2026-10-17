# Public website

The public website lives at `/` (code: `src/app/(site)`, components: `src/components/web`). It is built from three sources:

1. **The admin CMS** (database): products and categories, posts, projects, careers, locations, commodity prices and trade opportunities, hero banners, and the website settings (Admin -> Settings). Only what an editor has *published* is shown.
2. **Written content** in `src/content/site.ts`: the minerals, industries, quality and sustainability copy, and the menus. Edit this file to change wording; no layout code needs to change.
3. **The About page** (`src/app/(site)/about/page.tsx`), written from the company's own text.

## Pages

| Address | What it is | Data |
| --- | --- | --- |
| `/` | Home: hero slider, introduction, services, mineral spotlights, quality and responsibility, global reach, industries, latest insights | banners, locations, posts |
| `/about` | About us (anchors `#vision`, `#why`) | static |
| `/minerals`, `/minerals/<slug>` | The six minerals (and granite at `/minerals/granite-dimension-stones`) | `src/content/site.ts` |
| `/industries` | Five industries, each with the minerals it uses | `src/content/site.ts` |
| `/products`, `/products/<slug>` | Product catalogue with search, category filter and specification table | products, categories |
| `/insights`, `/insights/<slug>` | Articles with category filter and pagination | posts |
| `/projects`, `/projects/<slug>` | Projects and trade stories | projects |
| `/commodity-desk` | Latest published price per commodity and open trade opportunities | commodities, prices, opportunities |
| `/global-operations` | Process and active locations | locations |
| `/careers`, `/careers/<slug>` | Open positions and the application form | careers |
| `/contact-us`, `/request-a-quote` | Contact form and quotation (RFQ) form | settings |
| `/quality-compliance`, `/sustainability` | Responsibility pages | static |
| `/privacy-policy`, `/terms` | General legal text (have it reviewed by your legal adviser) | static |
| `/sitemap.xml`, `/robots.txt` | Generated; the sitemap includes the published CMS pages | all of the above |

Menu: About Us, Minerals, Granite, Industries, Insights, then a Contact us button (the structure of the reference site, with this company's own minerals).

## What the visitor can send

Three public forms post to `/api/public/*` (code: `src/server/services/submissions.ts`):

| Form | Endpoint | Appears in the admin as |
| --- | --- | --- |
| Contact | `POST /api/public/enquiries` | Contact Enquiries |
| Request a quote | `POST /api/public/rfqs` (answers with an `RFQ-YYYY-XXXXXX` reference) | RFQs & Trade Enquiries |
| Job application (optional resume) | `POST /api/public/applications` | Job Applications |

Protections: same-origin check, size limits, strict validation, consent required and recorded, a hidden field that bots fill (answered with a normal-looking success, nothing stored), at most three links per message, database-backed rate limits per source and per email address, no internal ids in answers, resumes validated by content and stored privately (and refused honestly when storage is not configured), and one application per person per position per 30 days.

## What is never invented

The footer, the contact page and the structured data show an address, phone number, email address, social links, "about" text and copyright line **only if** they are set in Admin -> Settings (Contact and Footer). Nothing is shown when they are empty. The written content makes no claims about company size, years in business, certificates, volumes or addresses.

## Rendering

Every public page is rendered on request (`force-dynamic`) and always sends its complete HTML, including without JavaScript. There is deliberately no `loading.tsx` for the website: a streamed placeholder would leave visitors without JavaScript, and crawlers that do not run it, looking at a skeleton. Contact settings are cached for 30 seconds.

## Known limits

- Product and article pictures are not shown yet: they are stored in private object storage and there is no public image route for them (banner pictures have one). Cards use an icon panel instead.
- Submissions are stored and shown in the admin; the site does not yet email an acknowledgement to the visitor or a notification to staff.
- The privacy policy and terms are general starting texts.

## Brand: logo and colours

- Source artwork: `assets/brand/logo-original.png` (not served). Replace it and run `npm run brand:build` to regenerate everything below.
- Generated: `public/brand/logo-{mark,wordmark,full}.png`, `public/brand/og-default.png`, and the tab icons `src/app/icon.png`, `apple-icon.png`, `favicon.ico`.
- `src/config/brand.ts` is the one place that names the logo files and brand colours; `src/components/brand/Logo.tsx` renders them (variants mark / lockup / full; one colour only, the logo's own gold).
- `src/styles/brand.css` holds the gold ramp and warm neutral/slate tokens, shared by the website and the admin.
- Contrast rules: gold-500 (#B98626) only for fills, icons and large graphics; gold-700 for text on light; gold-300 for text on dark; ink text on gold fills; white text only on gold-700 or darker (admin buttons use #8F6418). Error, success and warning colours stay red, green and amber.

## Home page: recent products

The home page shows a "Recently added products" section: the six newest published products (by publish date, in published categories), each as a card with its primary picture, availability, grade and origin, plus an "All products" link. It is hidden when there are no published products. Pictures come from `/api/public/product-image/<file id>`, which serves only pictures of published products (never drafts, archived products, unattached files or documents); a product without a picture shows the icon card instead. Product cards on the Products page and on product detail pages show the same pictures.
