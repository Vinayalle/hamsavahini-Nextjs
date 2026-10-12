# CMS modules: database integration status

In `NEXT_PUBLIC_DATA_SOURCE=api` mode every module below is served by PostgreSQL through `/api/<resource>` and **never falls back to mock data**: a failed request shows an error state, not seed records. In `mock` mode the same screens use the in-memory services (development preview only).

## How it works
- **Frontend**: each page still uses the shared `CrudService<T>` interface. In api mode `src/lib/services/index.ts` builds the service with `createApiCollection` (`mk(...)`), sending only the fields the API accepts (`ALLOWED`). The list is loaded once per session from the server (paged) and filtered in the browser; the activity log and notification history are different: they are **server-paged** (`ServerPagedList`) because they grow without bound. The notification bell and global search call light server endpoints (`/api/dashboard/attention`, `/api/search`) instead of downloading tables.
- **Backend**: one resource framework (`src/server/resources/*`) gives list / read / create / update / delete / bulk with the same rules everywhere: authorize **before** reading the body, field-level rights (`change_status`, `assign`, `publish`, `unpublish`, `edit`), record-level scope (`assigned`), uniqueness pre-checks with field errors, delete guards that mirror `ON DELETE RESTRICT`, audit in the same transaction.
- **PATCH never resets unsent fields** (`patchOf`): zod's `.partial()` re-applies `.default()`, which used to reset `status`, `featured`, `tags`, `active` ... on any partial update. Found by browser testing; covered by regression tests for every module including products and categories.
- **Workflow vocabularies** follow the business notes: RFQ New → Contacted → Under Discussion → Quotation Sent → Closed; enquiries New / Contacted / Closed / Spam; opportunities Draft / Available / Limited Availability / Under Negotiation / Sold / Requirement Open / Closed; locations include mines, sourcing, suppliers, processing, ports, markets, destinations; prices accept CNY. The mock data and screens use the same words.

## Status per module (api mode)
| Module | List / detail | Create | Edit | Delete | Notes |
|---|---|---|---|---|---|
| Posts / Insights | DB | DB | DB | DB | cover image field hidden (needs storage wiring) |
| Projects / Trade stories | DB | DB | DB | DB | |
| Careers | DB | DB | DB | DB (guarded when applications exist) | |
| Locations | DB | DB | DB + visibility switch | DB | |
| Banners | DB | DB | DB | DB | title, description, image (saved inside the project), link; drives the website hero (below) |
| Commodities | DB | DB | DB | DB (guarded by prices/opportunities) | |
| Commodity prices | DB | DB | DB | DB | manual entry only |
| Trade opportunities | DB | DB | DB | DB | quantity text parsed to value + unit |
| RFQs | DB | arrive from the public site | status, assignee, notes | DB | assigned-only scope honoured |
| Contact enquiries | DB | public site | status, assignee, notes | DB | assigned-only scope honoured |
| Job applications | DB | public site | status, notes | DB | resume via signed link (needs storage) |
| Email templates | DB | DB | DB | DB | variables derived by the server |
| Notification history | DB (server-paged) | system | "mark for retry" only | not allowed | no mail worker sends queued items |
| Activity logs | DB (server-paged) | server only | **not allowed** | **not allowed** | append-only through the API |
| Media library | DB | upload (S3) | name/alt/folder | DB + object | needs storage |
| Document library | DB | upload (S3) | metadata | DB + object | needs storage; new file = new upload |
| Product images / product documents | not connected to storage | | | | pages say so; use the Media Library |
| Users / roles / permissions / products / categories / settings | DB (earlier phases) | | | | |

## Security notes
- Every route is authorized on the server; the UI hides controls the employee lacks, but the server is the authority. Out-of-scope records look like "not found".
- Private files are served only after a permission check (media streamed same-origin with `nosniff` + CSP; documents and resumes by 60-second signed links; sensitive downloads audited). The bucket must be private.
- Uploads are validated by content (not name or declared type), size-capped, stored under random keys, and reported successful only when both the object and its row exist.
- Activity logs: no create/update/delete route exists for them; nothing in the app writes an audit row from the browser in api mode.

## Remaining
- Product images / documents and post cover images are not wired to storage (banner images are, and they are stored locally, not in the bucket).
- No malware scanning; files stay `scanStatus = pending` (quarantined files are never served).
- Notification retry marks items `queued`; there is no background mail worker.
- A database trigger/REVOKE to make `ActivityLog` physically append-only for the app role is recommended before production.
- The browser downloads each module list once per session (fine for admin volumes); move a module to `ServerPagedList` if it grows large.

## Banners and the website hero (`/`)
Sidebar **Banners** (`/admin/banners`). Fields: **title**, **description** (`subtitle`, max 200), **image**, **link** (`ctaUrl`, `/path` or `https://…`; `//host` and `javascript:` are refused) and the button text (default "Know more").
- The image is uploaded from the form to `POST /api/banners/image` (needs `banners:create` or `banners:edit`; real JPEG/PNG/WebP only, max 5 MB) and saved as a file **inside the project**: `uploads/banners/<random>.<ext>` (override the folder with `BANNER_UPLOAD_DIR`). No S3 bucket is involved. The database keeps only a record of it (`StoredFile`); the file is read back only through our routes, never as a static file.
- **Deleting a banner (single or bulk) deletes its picture file and record**, unless another banner still uses the same picture. Pictures that were uploaded but never saved, or replaced by another picture, are swept up after one hour (checked on the next upload or banner delete).
- The `uploads/` folder is ordinary project data: commit it if the pictures must travel with the repository, or add it to `.gitignore` if not. A host with a temporary disk (some serverless platforms) would lose the files on redeploy; point `BANNER_UPLOAD_DIR` at a persistent folder there.
- The home page (`src/app/(site)/page.tsx`) reads **published** banners with section *Hero* whose *Show from / until* window includes today (`src/server/services/site.ts`, max 8, ordered by *Slide order*). Drafts, archived, expired and other sections never reach the public.
- The picture is served by `/api/public/banner-image/<banner id>`, which answers only for a live published hero banner, with `nosniff`, a sandboxing CSP and public caching; the bucket and the private media route stay closed.
- `src/components/web/Hero.tsx`: height = `100svh − navbar height` (`--site-header-h` in `(site)/globals.css`; 440px floor on very short screens), split picture/red panel on desktop, picture over a red text sheet on phones, autoplay with pause button, swipe, arrow keys, reduced-motion respected. With no published banner a default hero is shown.
