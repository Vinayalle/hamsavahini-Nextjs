# Public website

The public website lives at `/` (code: `src/app/(site)`, components: `src/components/web`). It is built from three sources:

1. **The admin CMS** (database): products and categories, posts, projects, careers, locations, commodity prices and trade opportunities, and the website settings (Admin -> Settings). Only what an editor has *published* is shown.
2. **Written content** in `src/content/site.ts`: the minerals, industries, quality and sustainability copy, and the menus. Edit this file to change wording; no layout code needs to change.
3. **The About page** (`src/app/(site)/about/page.tsx`), written from the company's own text.

## Pages

| Address | What it is | Data |
| --- | --- | --- |
| `/` | Home: hero video, introduction, services, mineral spotlights, quality and responsibility, global reach, industries, latest insights | locations, posts |
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

- Source artwork: `assets/brand/logo-original.jpeg` (not served). Replace it and run `npm run brand:build` to regenerate everything below.
- Generated: `public/brand/logo-{mark,wordmark,full}.png`, `public/brand/og-default.png`, and the tab icons `src/app/icon.png`, `apple-icon.png`, `favicon.ico`.
- `src/config/brand.ts` is the one place that names the logo files and brand colours; `src/components/brand/Logo.tsx` renders them (variants mark / lockup / full; the logo always keeps its own colours, and on a dark surface it sits on a cream tile with `onDark`).
- `src/styles/brand.css` holds the gold ramp and warm neutral/slate tokens, shared by the website and the admin.
- Contrast rules: gold-500 (#B08040) only for fills, icons and large graphics; gold-700 for text on light; gold-300 for text on dark; ink text on gold fills; white text only on gold-700 or darker (admin buttons use #8A5C2C). Error, success and warning colours stay red, green and amber.

## Home page: recent products

The home page shows a "Recently added products" section: the six newest published products (by publish date, in published categories), each as a card with its primary picture, availability, grade and origin, plus an "All products" link. It is hidden when there are no published products. Pictures come from `/api/public/product-image/<file id>`, which serves only pictures of published products (never drafts, archived products, unattached files or documents); a product without a picture shows the icon card instead. Product cards on the Products page and on product detail pages show the same pictures.

## Confirmation emails for the website forms

After a visitor submits the contact form, the quotation form or a job application, they get a short "we received it" email at the address they entered (`enquiry_received`, `rfq_received`, `application_received`). The quotation email carries the same reference number the page shows.
- The subject line is fixed; visitor text only appears escaped inside the body, and the long message is not repeated.
- It is sent after the response is written, so it never slows the form. If the mail server is down or SMTP is not configured, the form still succeeds and the failure is recorded in `NotificationLog` (the body is never stored).
- Nothing is sent for refused input, bot submissions (the hidden field), or duplicate applications.
- Needs `SMTP_USER` and `SMTP_PASSWORD` in `.env`, like the account emails.
- Staff are not emailed about new submissions yet; they appear in the admin lists.

## Contact details are fixed in the code

The address, phone number and email shown in the footer, on the Contact Us page, in the privacy policy and in the search-engine data are fixed in `src/content/site.ts` (`CONTACT`), not edited in the admin. A line left empty is not shown. The website has no social media links. The admin no longer has the "Contact Details & Social Links", "Footer Settings" or "Navigation Menu" pages; the footer text, copyright line and menus are fixed in the code. The values currently in `CONTACT` are the placeholders that were in the admin settings, so replace them with the real ones.

## Products on the website, quote requests and the company mailbox

- **Product card** (catalogue, home page, related products): picture, category, name, a two-line description, the first four specifications, what it is used for ("Application"), the location, and two buttons: *View details* and *Request quote*.
- **Product page:** the picture gallery, the full details the admin wrote, what it is used for, the location, all specifications, and the *Request a quote* form beside them.
- **Request a quote** asks for name, email, phone number and a note with the requirements. It sends:
  - to the company mailbox (`SMTP_USER`; for a server with no sign-in, the address inside `MAIL_FROM`): the visitor's details, the note, the product and a link to it, with Reply-To set to the visitor, so replying answers them;
  - to the visitor: a thank-you naming the product, saying the team will contact them.
  The product and its link come from the database (a published product), never from what the visitor sends. The contact form, the quotation form and job applications also e-mail the company mailbox. Links use the site address in `src/lib/site-url.ts`, so set the real address there.
- **Admin product form:** name, category, used for, location, details, optional specifications and pictures. The category field is a dropdown: pick one or type a new name to add it (needs permission to create categories). The code, web address and short summary are made automatically. A new product is shown on the website straight away; the *On website* switch on the products list hides or shows it (a person who may add products but not publish them adds them hidden).
- **Categories** have no page of their own any more; the website lists only categories that have a product to show.
- **Home page motion:** a ticker of mineral names under the hero, a numbers band that counts up (real counts only), cards that lean towards the pointer, a light sweep on gold buttons, staggered lists and floating light. All of it is CSS or small client components and is off for visitors who prefer reduced motion.
