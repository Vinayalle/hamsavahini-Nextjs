## Mandatory Project Reference

Read and analyze `docs/HAMSAVAHIN AARTH MINES LLP- webiste notes.pdf` before modifying the existing codebase.

Treat this PDF as the primary business requirements document for the Hamsavahin website and CMS.

Use the document to identify:
- Required website modules and entities
- Admin and employee management requirements
- Product and commodity management workflows
- Global operations and location management
- RFQ and contact enquiry workflows
- Careers and job applications
- Document visibility and access requirements
- Authentication, security, database, and API requirements

Implement the role-based access system in accordance with these requirements while preserving the existing Super Admin UI.

The PDF does not define every employee permission or delegation rule. For those areas, use the detailed role-based access requirements in this prompt as the implementation specification.

Before making changes, compare the PDF, existing codebase, and requested permission architecture. Identify any conflicts or missing requirements, and avoid destructive changes.

Do not rebuild the project from scratch. Upgrade the existing implementation, test the changes, and document any remaining gaps.



# HAMSAVAHIN — COMPLETE ROLE-BASED SUPER ADMIN & ADMIN SYSTEM

## 1. Your Role and Objective

Act as a Senior Full-Stack Architect, Next.js Engineer, Backend Engineer, Database Architect, Security Engineer, and Enterprise UI/UX Developer.

The Hamsavahin Super Admin frontend has already been developed. Now upgrade the existing project into a complete, functional, database-backed administration system with dynamic employee management, role-based access control (RBAC), page-level permissions, dashboard customization, and secure backend APIs.

This is an existing working project. Do not recreate it from scratch, replace the UI, or remove working features.

Your task is to audit the existing codebase, understand its architecture, and extend it while preserving the current design, sidebar structure, routes, reusable components, and existing workflows.

The final system must support:

- Super Admin management
- Admin management
- Employee accounts
- Roles and permissions
- Individual page allocation
- Module-level and action-level permissions
- Multiple roles assigned to one employee
- Employee-specific dashboard widgets
- Dynamic sidebar visibility
- Page access allocation and revocation
- Secure backend authorization
- Database-backed CRUD operations
- Audit logs
- Employee activation and deactivation
- Secure authentication and session management

Do not stop at frontend mockups. Implement the real frontend and backend integration.

## 2. Required Technology Architecture

Inspect the current repository first and preserve the existing compatible stack.

The target architecture is:

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Existing UI component library
- PostgreSQL
- Prisma ORM
- Secure server-side authentication
- API routes or server-side service functions
- Role-based authorization middleware or shared authorization utilities
- S3-compatible object storage for files, when configured
- Email service for invitations and account notifications, when configured

If an authentication or database library is already installed, evaluate whether it can be retained.

Do not introduce conflicting libraries or replace the existing architecture without a concrete technical reason.

Create separate development, staging, and production environment configurations.

Never expose database credentials, authentication secrets, or private storage credentials to the browser.

## 3. Inspect Before Modifying

Before implementation, inspect:

- Existing route structure
- Current admin layout and sidebar
- Existing dashboard
- Product and other CMS modules
- Existing mock data and services
- Existing TypeScript interfaces
- Authentication implementation, if present
- Database configuration and Prisma schema, if present
- Existing API routes
- Installed dependencies
- Existing form validation
- Existing permission checks
- Build and lint configuration

Create an implementation plan based on the actual code.

Identify which components can be reused, which functions need backend integration, and which features are missing.

Preserve existing routes and UI wherever possible.

Do not blindly create duplicate pages, duplicate models, or a second authentication system.

## 4. Define the Permission Architecture

Implement a proper combination of RBAC, page-level permissions, action-level permissions, and employee-specific restrictions.

There must be four distinct concepts:

1. Users — the individual employee accounts.
2. Roles — reusable sets of permissions.
3. Permissions — access to a particular resource and action.
4. Employee assignments — the roles and optional individual overrides assigned to each employee.

Do not store only a single role string on the employee record. The architecture must support assigning multiple roles to one employee.

### Default system roles

Create the following initial roles:

- Super Admin
- Admin
- Content Manager
- Product Manager
- Trade Desk Manager
- HR Manager
- Enquiry Manager
- Custom Role

These roles must be configurable through the permission-management interface, subject to protected system-role rules.

### Super Admin

Super Admin has full system access.

Super Admin can:

- View and manage every CMS module.
- Create, edit, deactivate, and reactivate admin and employee accounts.
- Create and configure roles.
- Assign multiple roles to employees.
- Allocate or revoke individual page permissions.
- Configure create, edit, delete, publish, archive, and export permissions.
- Manage dashboard widgets and default dashboards.
- Review permission assignments.
- View administrative audit logs.
- Manage website configuration.
- Manage system-level settings and integrations.
- Assign permissions to Admin users within the system's authorization rules.

Do not allow accidental removal of the last active Super Admin or loss of the last full-access administrator.

### Admin

Admin is not automatically equivalent to Super Admin.

An Admin can:

- View the modules they are authorized to manage.
- Manage employees and assign pages within the permissions delegated to them.
- Assign roles only when they have permission to do so.
- Grant only permissions they are authorized to delegate.
- Create and edit records in authorized modules.
- Manage authorized enquiries, content, products, or trade records.
- View the dashboard information allowed by their permissions.

An Admin must never grant themselves additional privileges or grant an employee permissions exceeding their own delegation authority.

An Admin must not automatically gain access to system settings, role administration, or Super Admin management.

### Other employees

Employees must see only their authorized modules, pages, dashboard widgets, and actions.

If an employee has no permission to manage users, the user-management page must not be available to them.

## 5. Permission Granularity

Implement permission checks at multiple levels.

### A. Module permissions

Examples:

- Products
- Categories
- Product Specifications
- Product Images
- Product Documents
- Posts / Insights
- Projects / Trade Stories
- Careers
- Job Applications
- Global Operations / Locations
- Mines
- Suppliers
- Processing Facilities
- Warehouses
- Ports
- Markets
- Commodities
- Commodity Prices
- Trade Opportunities
- RFQs
- Contact Enquiries
- Media Library
- Document Library
- Email Templates
- Notification History
- Admin Users
- Roles & Permissions
- Activity Logs
- Website Settings

### B. Page permissions

For each module, define which pages an employee may access.

Examples for Products:

- Product listing
- Product details
- Add Product
- Edit Product
- Product Specifications
- Product Images
- Product Documents

Examples for RFQs:

- RFQ listing
- RFQ details
- Assignment
- Status management
- Internal notes
- Document downloads

Examples for Administration:

- Employee listing
- Employee details
- Create employee
- Edit employee
- Roles
- Permission assignments
- Audit logs

### C. Action permissions

Support these actions where relevant:

- View
- Create
- Edit
- Delete
- Publish
- Unpublish
- Archive
- Restore
- Approve
- Assign
- Change Status
- Upload
- Download
- Export
- Manage Permissions
- Manage Settings

Do not give every entity every action automatically. Define valid permissions for each resource.

For example, an employee might be able to view and edit products without permission to delete or publish them.

### D. Record-level restrictions

Design the permission system so that record-level restrictions can be added when required.

Examples:

- An employee may manage only assigned RFQs.
- An HR employee may view job applications but not unrelated trade enquiries.
- A Content Manager may edit content but not manage user accounts.

Implement record-level checks for assignment-based workflows where those workflows exist.

## 6. Super Admin UI: Employee Management

Route: `/admin/users`

Upgrade the existing user-management page into a complete employee administration interface.

### Employee listing table

Columns:

- Employee ID
- Name
- Profile Image
- Email
- Department
- Assigned Roles
- Assigned Page Count
- Account Status
- Last Login
- Created Date
- Actions

Actions:

- View Employee
- Edit Employee
- Assign Roles
- Manage Page Access
- Configure Dashboard
- Activate
- Deactivate
- Send Password Reset or Invitation
- View Activity

Include:

- Search by name, employee ID, or email
- Filter by department
- Filter by role
- Filter by account status
- Filter by last login where useful
- Sorting
- Pagination
- Bulk selection for safe supported operations
- Empty states
- Confirmation dialogs

Never display plaintext passwords or authentication secrets.

### Add Employee page

Route: `/admin/users/new`

Fields:

- Full name
- Employee ID
- Work email
- Phone, if required
- Department
- Designation
- Profile image
- Assigned roles
- Account status
- Optional reporting manager

Include role assignment as part of employee creation.

The default account status should be Pending Invitation or another appropriate non-active state until the invitation or activation process is completed.

Use secure invitation or password-setup flows rather than assigning a shared default password.

### Employee details page

Route: `/admin/users/[id]`

Provide tabs:

1. Profile
2. Assigned Roles
3. Page Permissions
4. Dashboard Configuration
5. Activity History

Show:

- Employee details
- Account status
- Assigned roles
- Effective permissions
- Explicit restrictions
- Permission sources
- Recent activity
- Last login

Add Edit, Manage Permissions, Configure Dashboard, and Deactivate actions where authorized.

## 7. Super Admin UI: Allocate or Remove Pages

This is one of the most important features.

Implement a dedicated permission-assignment screen.

Route: `/admin/users/[id]/permissions`

The Super Admin must be able to choose an employee and decide exactly which pages that employee can access.

### Permission management interface

Display a hierarchical permission tree:

- Module
  - Page
    - Actions

Example:

Products
- Product Listing
  - View
  - Create
  - Edit
  - Delete
  - Publish
- Categories
  - View
  - Create
  - Edit
  - Delete
- Product Specifications
  - View
  - Create
  - Edit
- Product Images
  - View
  - Upload
  - Delete
- Product Documents
  - View
  - Upload
  - Download
  - Delete

Content Management
- Posts / Insights
- Projects / Trade Stories
- Careers
- Global Operations
- Banners

Trade Management
- Commodities
- Commodity Prices
- Trade Opportunities
- RFQs

Administration
- Admin Users
- Roles & Permissions
- Activity Logs
- Website Settings

Each page must have appropriate action checkboxes.

### Required interactions

- Expand or collapse modules.
- Select or deselect an entire module.
- Select or deselect an individual page.
- Configure action permissions.
- Display inherited role permissions.
- Display individual permission overrides.
- Search permission names.
- Filter granted or denied permissions.
- Select all permitted pages.
- Clear optional page assignments.
- Compare effective permissions before and after changes.
- Save changes.
- Cancel unsaved changes.
- Show confirmation before removing critical access.
- Show success/error feedback.

Do not let the interface silently grant permissions that exceed the administrator's own authority.

### Permission assignment policy

Implement these rules:

1. Super Admin has full access by default.
2. Roles grant reusable sets of permissions.
3. Multiple roles can be assigned to one employee.
4. Role permissions are combined to calculate the employee's effective permissions.
5. Individual explicit denials must take precedence over role grants when the system allows employee-level restrictions.
6. Explicit overrides must be distinguishable from inherited permissions.
7. A permission cannot be granted if the assigning administrator lacks delegation authority.
8. A deactivated employee cannot access the system even if they have assigned roles.
9. Permission changes must be saved in the database and audited.
10. Permission revocation must take effect promptly, including on protected API requests.

Implement the permission-resolution rules centrally and document the precedence policy.

Do not calculate permissions differently in different page components.

## 8. Role Management UI

Route: `/admin/roles`

Create a role listing page containing:

- Role Name
- Description
- Number of Assigned Employees
- Permission Count
- System Role Indicator
- Status
- Updated Date
- Actions

Create role routes:

- `/admin/roles/new`
- `/admin/roles/[id]`
- `/admin/roles/[id]/edit`

### Role creation and editing

Fields:

- Role name
- Unique role code
- Description
- Status
- Permissions

Use the same hierarchical permission editor as employee permissions.

Actions:

- Create Role
- Edit Role
- Duplicate Role
- Assign Employees
- View Permissions
- Deactivate Role
- Delete Custom Role, if safe and permitted

Protect system roles from accidental deletion.

If a role is assigned to employees, explain the impact before deleting or deactivating it.

## 9. Employee-Specific Dashboard Configuration

Each employee should have a dashboard appropriate to their role and permissions.

Route: `/admin/users/[id]/dashboard`

Super Admin should be able to configure:

- Which dashboard widgets an employee can see
- Which widgets are enabled by default
- Widget ordering
- Default dashboard layout
- Relevant quick actions

Available widgets may include:

- Total Products
- Published Products
- Draft Products
- Active Commodities
- Active Trade Opportunities
- New RFQs
- Assigned RFQs
- New Contact Enquiries
- Assigned Enquiries
- Open Job Applications
- Published Insights
- Global Locations
- Recent Activity
- Pending Reviews

Do not show a widget containing information the employee is not authorized to access.

Dashboard widget visibility is not a substitute for permission checks on the underlying data.

The employee's dashboard should be generated dynamically based on the employee's effective permissions and saved dashboard configuration.

Examples:

- Product Manager: Products, Categories, Specifications, Product Documents.
- Content Manager: Posts, Projects, Banners, Publishing Activity.
- Trade Desk Manager: Commodities, Commodity Prices, Opportunities, RFQs.
- HR Manager: Careers and Job Applications.
- Enquiry Manager: Contact Enquiries and assigned RFQs.

These are default suggestions. Super Admin must be able to configure roles and page assignments.

## 10. Dynamic Sidebar and Route Protection

Update the existing admin layout so navigation is generated from the permission system.

Requirements:

- Display only authorized modules and pages.
- Hide unauthorized nested menu items.
- Hide unauthorized action buttons.
- Update the sidebar immediately after a permission change or on the next validated session/request.
- Preserve the existing visual design.
- Display a suitable access-denied page when a user attempts to access an unauthorized route.
- Redirect unauthenticated users to login.
- Avoid redirect loops.
- Ensure direct URL access is checked on the server.

If a module has no visible child pages, hide that module from the sidebar unless its own permitted landing page is available.

Do not rely on client-side conditional rendering alone.

The server must independently verify page and action permissions.

## 11. Authentication and Session Security

Implement secure authentication for the existing admin application.

Requirements:

- Login
- Logout
- Session management
- Secure password hashing
- Password reset
- Invitation or account activation
- Account activation/deactivation
- Session expiry
- Server-side authentication checks
- Protection against unauthorized access
- Appropriate login and API rate limiting
- Input validation
- Secure cookie configuration
- CSRF protection where applicable to the chosen authentication architecture
- Generic authentication error messages
- Audit logging for security-relevant events

Never store plaintext passwords.

Do not trust role names, user IDs, or permission values supplied by the browser.

The backend must derive the authenticated user from the verified session.

If the existing application already has secure authentication, extend it rather than creating a competing authentication system.

## 12. PostgreSQL and Prisma Database Design

Implement the database schema using the existing PostgreSQL/Prisma architecture.

Design suitable models for:

### Identity and access management

- User
- Role
- Permission
- UserRole
- RolePermission
- UserPermissionOverride
- UserDashboardPreference
- Session or authentication-provider models as required
- Invitation or password-reset token models as required

Use proper many-to-many relationships.

### Core CMS entities

Preserve or create appropriate models for:

- Product
- Category
- ProductSpecification
- ProductImage
- ProductDocument
- Post
- Project
- Career
- JobApplication
- Location
- Mine
- Supplier
- Facility
- Port
- Market
- Banner
- Commodity
- CommodityPrice
- TradeOpportunity
- RFQ
- ContactEnquiry
- MediaAsset
- DocumentAsset
- EmailTemplate
- NotificationLog
- WebsiteSettings

Do not duplicate models that already exist.

### Audit and operations

- ActivityLog
- PermissionChangeLog or equivalent audit event records
- Relevant assignment history where required

Use foreign keys, appropriate indexes, unique constraints, timestamps, and transaction-safe operations.

Store explicit permission overrides separately from role permissions so that effective permissions can be calculated reliably.

Design the schema to avoid deleting historical records accidentally when a user or role is deactivated.

Create Prisma migrations and explain how to apply them safely.

Do not drop or reset an existing database without explicit authorization and a verified migration plan.

## 13. Backend Authorization Services

Create centralized, reusable authorization functions.

Examples of intended behavior:

- `requireAuthenticatedUser()`
- `requirePermission(resource, action)`
- `canAccessPage(user, pageKey)`
- `canPerformAction(user, resource, action)`
- `getEffectivePermissions(userId)`
- `canManageUser(actor, targetUser)`
- `canGrantPermission(actor, permission)`
- `canAccessRecord(user, record)`

Adapt function names to the existing code style.

These functions must be used by protected API routes and server-side actions.

Do not trust a user-supplied employee ID to determine which user's permissions should be used.

For every protected operation:

1. Verify the session.
2. Load the authenticated user's current authorization state.
3. Verify permission for the requested action.
4. Validate input.
5. Check record-level restrictions where applicable.
6. Perform the database operation.
7. Record the appropriate audit event.

Return appropriate HTTP responses for unauthenticated and unauthorized requests.

## 14. API Requirements

Implement authenticated APIs or equivalent server-side operations for:

### Employee management

- List employees
- Create employee
- View employee
- Update employee
- Activate/deactivate employee
- Assign roles
- Remove roles
- Read effective permissions
- Update individual permission overrides
- Read dashboard configuration
- Update dashboard configuration

### Role management

- List roles
- Create role
- View role
- Update role
- Assign permissions
- Remove permissions
- Assign employees
- Deactivate custom role
- Delete eligible custom roles

### Permissions

- Retrieve permission catalog
- Retrieve an employee's role permissions
- Retrieve employee-specific overrides
- Calculate effective permissions
- Save permission changes
- Read permission history

### Dashboard

- Retrieve authorized dashboard widgets
- Retrieve permission-filtered dashboard metrics
- Save dashboard layout/preferences
- Retrieve relevant recent activity

Use consistent response structures, validation schemas, error handling, and appropriate status codes.

Do not return sensitive employee records or private documents to unauthorized users.

## 15. Audit Logging

Every important administration action must be auditable.

Record events such as:

- Employee created
- Employee updated
- Employee activated/deactivated
- Role assigned or removed
- Permission granted or revoked
- Role permissions changed
- Dashboard configuration changed
- Authentication events, where appropriate
- Important CMS create/edit/delete operations

Capture:

- Actor
- Target employee or entity
- Action
- Timestamp
- Relevant changes
- Success/failure where practical
- Request metadata where appropriate

Do not store passwords, session tokens, or other secrets in logs.

The audit log should be append-only through normal application workflows and visible only to authorized users.

## 16. Preserve All Existing CMS Functionality

Keep the existing modules for:

- Products
- Categories
- Specifications
- Product Images
- Product Documents
- Posts / Insights
- Projects / Trade Stories
- Careers
- Global Operations
- Banners
- Commodities
- Commodity Prices
- Trade Opportunities
- RFQs
- Contact Enquiries
- Job Applications
- Media Library
- Document Library
- Email Templates
- Notification History
- Website Configuration

Connect each module to the centralized permission system.

Do not create duplicate versions of the existing pages.

Do not remove existing page routes merely because the current employee lacks access. Restrict access for that employee while retaining the page for authorized users.

Use the Hamsavahin requirements document as the functional reference for the modules.

## 17. Complete Frontend Requirements

Keep the existing Super Admin UI design and extend it with:

- Employee management pages
- Employee detail tabs
- Permission assignment interface
- Role editor and permission matrix
- Dashboard configuration editor
- Permission-aware sidebar
- Permission-aware page actions
- Access-denied page
- User activation/deactivation dialogs
- Role assignment dialogs
- Permission change confirmation
- Permission comparison view
- Effective permission summary
- Audit history views
- Loading states
- Empty states
- Validation errors
- Success/error notifications

The interface must be responsive and accessible.

Use clear indicators to distinguish:

- Granted through a role
- Granted individually
- Denied through an override
- Not granted
- Not delegable by the current administrator

Provide a confirmation dialog before revoking critical permissions or changing access for an administrator.

## 18. Testing Requirements

Write and execute appropriate tests for authorization and permissions.

At minimum, verify:

### Super Admin tests

- Can view all authorized modules.
- Can create and manage employees.
- Can configure roles and permissions.
- Can allocate and revoke employee page access.
- Can configure employee dashboards.
- Cannot accidentally remove the last active Super Admin.

### Admin tests

- Can manage employees only within delegated authority.
- Cannot grant permissions beyond their delegation scope.
- Cannot elevate their own privileges.
- Cannot access unauthorized settings or role-management functions.

### Employee tests

- Can access permitted pages.
- Cannot access revoked pages through direct URLs.
- Cannot call unauthorized APIs.
- Cannot perform actions they have not been granted.
- Cannot access protected records belonging to unauthorized assignments.
- Cannot access the application when deactivated.

### Multiple-role tests

- Permissions from multiple roles combine according to the documented policy.
- Explicit denials are applied consistently.
- Removing one role recalculates effective permissions.
- Revoked access is enforced by backend requests.
- Dashboard widgets do not leak unauthorized information.

### Regression tests

- Existing CMS pages still work.
- Existing product workflows remain intact.
- The sidebar still works on desktop and mobile.
- Forms and tables retain their existing design.
- The production build succeeds.

Test authorization at the backend, not only by inspecting the UI.

## 19. Implementation Order

Implement this as a sequence of safe phases.

### Phase 1: Audit and authorization design
- Inspect existing code
- Document current architecture
- Identify existing models and services
- Define permission catalog
- Define role and override precedence
- Plan safe database migrations

### Phase 2: Database and authentication
- Implement identity and access models
- Configure authentication
- Create safe migrations
- Seed initial system roles and permissions
- Create a secure initial Super Admin bootstrap procedure

### Phase 3: Backend authorization
- Implement centralized authorization services
- Protect API routes and server actions
- Add permission checks
- Add audit logging

### Phase 4: Super Admin employee management
- Employee listing
- Employee creation
- Employee details
- Role assignments
- Activation/deactivation

### Phase 5: Page allocation and role editor
- Hierarchical page permission tree
- Action-level permissions
- Employee-specific overrides
- Role permission editor
- Effective permission calculation
- Permission audit history

### Phase 6: Dynamic dashboard and sidebar
- Permission-aware navigation
- Dashboard widget configuration
- Permission-filtered metrics
- Immediate access revocation

### Phase 7: Admin delegation and CMS integration
- Configure Admin delegation limits
- Connect all existing modules to authorization
- Enforce record-level restrictions where applicable
- Remove reliance on mock permissions

### Phase 8: Testing and deployment readiness
- Run authorization tests
- Run regression tests
- Run lint and TypeScript checks
- Run production build
- Document migrations and deployment configuration

Do not stop after building the permission-management UI. Complete the backend enforcement and integrate it with the existing modules.

## 20. Final Acceptance Criteria

The implementation is complete only when:

1. Super Admin can allocate and revoke pages for individual employees.
2. Super Admin can assign multiple roles to an employee.
3. Super Admin can configure module, page, and action permissions.
4. Admin can allocate permissions only within authorized delegation limits.
5. Each employee sees a permission-aware sidebar.
6. Each employee sees an appropriate dashboard.
7. Unauthorized direct URLs are blocked.
8. Unauthorized API operations are rejected by the backend.
9. Permission changes are persisted in PostgreSQL.
10. Role changes recalculate effective permissions.
11. Explicit restrictions are consistently enforced.
12. Employee activation/deactivation is enforced server-side.
13. Permission changes are recorded in audit logs.
14. Existing CMS modules remain intact.
15. The application has no hardcoded production credentials.
16. Database migrations are safe and documented.
17. Authorization tests cover privilege escalation and access revocation.
18. The production build succeeds.
19. The existing UI design remains consistent.
20. The implementation is documented for future developers.

## Final Instruction

Start by auditing the current codebase. Then implement the real backend and frontend functionality in the order described above.

Do not return only an explanation, plan, schema proposal, or visual prototype. Implement the changes in the existing repository, verify them, and report completed functionality, files changed, migrations, tests, build results, and outstanding environment configuration.

If a feature requires external credentials or services that are not available, implement the correct integration boundary and report exactly what configuration remains. Never claim that an integration is operational when it has not been tested.


