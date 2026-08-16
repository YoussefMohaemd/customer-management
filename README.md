# Customer Management Module

A production-quality **Enterprise ERP/CRM Customer Management** module built with **Angular 21**, **PrimeNG**, **Tailwind CSS**, **Angular Signals**, and **RxJS**, backed by a small **Node.js Backend-for-Frontend (BFF)** that turns the staging CRM API's full-dataset dump into true server-side pagination, search, filtering and sorting.

This is a Senior Front-End engineering deliverable, not a demo: it integrates the real staging CRM API, follows server-driven search semantics, scales to **100,000+ records** without ever rendering them all, and reproduces the documented ERP UI (sidebar, header, data grid, filters, actions menu, edit modal, actions/reports sections).

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [The BFF](#the-bff)
- [API Integration](#api-integration)
- [Authentication](#authentication)
- [Server-Side Pagination](#server-side-pagination)
- [Searching](#searching)
- [Filtering](#filtering)
- [Sorting](#sorting)
- [Dynamic Columns](#dynamic-columns)
- [Actions & Reports](#actions--reports)
- [Proposed Backend Contract](#proposed-backend-contract)
- [Signals](#signals)
- [RxJS](#rxjs)
- [Reactive Forms](#reactive-forms)
- [Performance Strategy](#performance-strategy)
- [Excel Export](#excel-export)
- [Responsive Design](#responsive-design)
- [Error Handling](#error-handling)
- [Running the Project](#running-the-project)
- [Environment Configuration](#environment-configuration)
- [Build](#build)
- [Testing](#testing)
- [AI Assistance](#ai-assistance)
- [Known API Limitations](#known-api-limitations)
- [Architectural Decisions](#architectural-decisions)

---

## Overview

The module lets ERP users:

- browse a customer data grid (ID, Code, Name, Email, Mobile, Client Type, Account Manager, City, Country — plus 22 more selectable columns),
- search across the full customer base **server-side** with debounced input,
- filter by free-text fields (with operators) and categorical dimensions,
- sort by any grid column,
- paginate with configurable page sizes,
- add and edit customers in a large responsive modal form,
- export the current result set to Excel,
- configure which columns are visible via a searchable column picker,
- and explore the documented "Actions" (Collective Reassign, Customer Follow Up, Upload Bulk) and "Reports" (Contacts Report, Customer Report, Account Follow Up Report) ERP sections — each report genuinely filters the table server-side.

The UI intentionally replicates the supplied assessment screenshots: dark ERP sidebar with active-state rail + star indicator, top header with global search/language/notifications/profile, white rounded card containing the toolbar/table, filter chips, actions dropdown per row, page-size paginator, and the tiles below the grid.

## Features

| Area            | Detail                                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| Data grid       | PrimeNG table, compact enterprise styling, hover/loading/empty states, per-row actions, batch-select checkboxes |
| Search          | Server-side `search` parameter, 400 ms debounce, request cancellation, precomputed search index                 |
| Filters         | Free-text filters with operators (contains/equals/starts-with/ends-with, numeric comparators) + categorical ids; all applied server-side by the BFF; removable chips |
| Pagination      | **True server-side** — the BFF returns only the requested page + total count; 5/10/20 per page                  |
| Sorting         | Any column, asc/desc, natural sort, stable id tie-break, resets to page 1, server-side                          |
| Columns         | Searchable column picker; a 31-field catalog drives the table, filter panel and picker; ≥1 column enforced      |
| Actions/Reports | Tiles that synchronize table columns, sort, server-side filtering and selection state with the store |
| Create / Edit   | Shared reactive form, validation, `SaveCustomerWithContactPerson` proxied by the BFF                            |
| Export          | SheetJS Excel export of the full filtered + sorted result set via the BFF export endpoint                       |
| Responsive      | Sidebar collapse + mobile drawer, 4→2→1 column form grid                                                        |
| Errors          | Interceptor-normalized user-friendly messages for all HTTP statuses                                             |
| State           | Angular Signals store, `computed()` derived state, `OnPush` rendering                                           |
| Tests           | Vitest unit tests covering the store, models, services, layout and every customer component                     |

## Tech Stack

- **Angular 21** · TypeScript 5.9 · Standalone Components · strict TS config
- **PrimeNG 21** (`primeng` + `@primeuix/themes` Aura preset) + PrimeIcons
- **Tailwind CSS 4** via `@tailwindcss/postcss` (v4-native PostCSS plugin) + `tailwindcss-primeui`
- **RxJS** · **Angular Signals** · **Reactive Forms**
- **Node.js BFF** (`server/`) — plain `node:http`, zero dependencies
- **SheetJS (`xlsx`)** for Excel export
- **Vitest + jsdom** for unit tests (`@angular/build:unit-test` runner)
- Prettier for formatting

No unnecessary frontend libraries were added. Everything else uses native Angular/PrimeNG capabilities.

## Project Structure

```text
├── server/                          # Node.js Backend-for-Frontend (zero deps)
│   ├── config.json                  # Port, upstream URL, cache TTLs, CORS
│   └── src/
│       ├── server.js                # HTTP routes (/api/customers, lookups, export, save, health)
│       ├── upstream.js              # Fetches the upstream dump, proxies Save, token loading
│       ├── cache.js                 # Stale-while-revalidate dataset cache (single-flight)
│       ├── query.js                 # Search/filter/sort/paginate over the cached dataset
│       ├── fields.js                # Canonical field maps (sort, search, text filters)
│       └── config.js                # Env-var overridable configuration
│
└── src/
    └── app/
        ├── core/                    # App-wide infrastructure (no feature logic)
        │   ├── config/navigation.ts # Sidebar navigation definition
        │   ├── interceptors/        # auth + user-friendly API error handling
        │   ├── layout/              # MainLayout, Sidebar, Topbar shell
        │   ├── models/              # ApiError + status→message map
        │   └── services/            # Runtime config loader (auth token)
        │
        ├── shared/
        │   └── components/          # Reusable EmptyState / Flag components
        │
        ├── features/customers/
        │   ├── components/
        │   │   ├── customer-page/       # Route orchestrator (export, delete confirm, paginator)
        │   │   ├── customer-toolbar/    # Search input + filter chips + column picker
        │   │   ├── customer-filters/    # Filter button/popover (fields, operators), self-contained
        │   │   ├── customer-table/      # Pure-view PrimeNG data grid + batch selection
        │   │   ├── customer-column-picker/ # Searchable column selector with chip strip
        │   │   ├── customer-actions-menu/  # Row actions dropdown
        │   │   ├── customer-actions/    # "Collective Reassign / Follow Up / Upload Bulk" tiles
        │   │   ├── customer-reports/    # "Contacts / Customers / Account Follow Up" tiles
        │   │   ├── customer-form/       # Reusable create/edit/view reactive form
        │   │   └── customer-form-dialog/# Modal shell + save workflow
        │   ├── models/                  # Customer, query, column-catalog, response, form models
        │   ├── services/                # HTTP service (BFF) + Excel export service
        │   └── state/                   # Signal-based CustomerStore
        │
        ├── environments/                # BFF base URL, endpoints, tuning constants
        ├── app.config.ts                # ApplicationConfig (DI, interceptors, PrimeNG theme)
        └── app.routes.ts                # Lazy-loaded /customers route
```

## Architecture

- **Feature-based, lazy-loaded**: `/customers` is a lazy route; the customer feature chunk is only fetched when the route is opened (verified in the build output as a separate lazy chunk).
- **Angular never touches the upstream dump endpoint.** Every table request goes to the BFF, which owns the upstream CRM API, caches the dataset, and serves paged results. See [The BFF](#the-bff).
- **Strict separation of concerns**:

  | Layer             | Responsibility                                                                  |
  | ----------------- | ------------------------------------------------------------------------------- |
  | `CustomerService` | Everything HTTP against the BFF (params, normalization). No UI state.           |
  | `CustomerStore`   | Signal-based UI/query state + the single RxJS pipeline. No direct API calls in components. |
  | Components        | Presentational; consume signals, emit typed intents.                            |
  | RxJS pipeline     | Lives in `CustomerStore` (`merge` → `switchMap` → `executeQuery`).              |

- **Column catalog as single source of truth**: `CUSTOMER_COLUMNS` (`models/customer-column.model.ts`) defines every API field with label, render type, filter mapping and width. The table header/body, the filter panel and the column picker are all derived from it — no field is hard-coded in a `<th>`/`<td>`.
- **Dependency Injection** everywhere: `inject()`, `providedIn: 'root'` singletons, functional interceptors registered in `provideHttpClient(withInterceptors([...]))`.
- **Powerful typing, no `any`**: strict TS (`strict: true`, `strictTemplates: true`), typed models, typed reactive form groups.

## The BFF

The staging CRM API ignores **every** query parameter and always returns the full ~14,111-record / ~15 MB dump (verified live — see [Known API Limitations](#known-api-limitations)). The `server/` BFF fixes this at the network boundary:

| Concern            | Implementation                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Dataset fetching   | Fetches the upstream `ReadAllCRMClients` dump once; single-flight (concurrent callers share one request)           |
| Caching            | Stale-while-revalidate: fresh (5 min) → serve instantly; stale (< 1 h) → serve + background refresh; cold → block on one refresh; refresh failure → keep serving stale |
| Paging contract    | `GET /api/customers?page=&pageSize=&search=&sortField=&sortDirection=&clientTypeId=&accountManagerId=&cityId=&countryId=&textFilters={json}&textOperators={json}&report={reportId}` → `{ data, totalCount }` where `data` is **only the requested page** |
| Search             | Precomputed lowercase concatenation of all searchable fields per dataset (one `includes()` per record)             |
| Sorting            | Precomputed natural-sort keys per (dataset, field); numbers as numbers, text tokenized into digit/text chunks, empty values last, stable `Id` tie-break |
| Lookups            | `GET /api/customers/lookups` → distinct `{ value, label }` options for Client Types / Account Managers / Cities / Countries over the **full** dataset |
| Export             | `GET /api/customers/export` → full matching set (search + filters + sort, no pagination)                           |
| Save               | `POST /api/customers/save` proxies `SaveCustomerWithContactPerson`; on success the cache is invalidated and a background refresh runs while the app keeps serving the stale dataset |
| Health             | `GET /api/health` → cache diagnostics (warm, record count, age, refresh state, upstream URL)                       |
| Zero dependencies  | Plain `node:http`/`node:fs`/`fetch` (Node ≥ 18.17); token from env var or the shared runtime config                  |

Run it with `npm start --prefix server` (port 3000 by default, configurable in `server/config.json` or via `BFF_*` env vars).

## API Integration

| Operation            | Endpoint (BFF, proxied from Angular)                        |
| -------------------- | ----------------------------------------------------------- |
| Read customers       | `GET /api/customers` (paged table state)                    |
| Lookup options       | `GET /api/customers/lookups`                                |
| Export               | `GET /api/customers/export`                                 |
| Save (create/update) | `POST /api/customers/save`                                  |
| Health               | `GET /api/health`                                           |

| Operation            | Upstream CRM endpoint (called only by the BFF)              |
| -------------------- | ----------------------------------------------------------- |
| Full dataset dump    | `GET /api/CRM/ReadAllCRMClients?Text=&Direction=ltr&InCT=`  |
| Save (create/update) | `POST /api/CRM/SaveCustomerWithContactPerson?InCT=`         |

- The BFF routes, not the raw CRM endpoints, live in `src/environments/*` and are proxied by the dev server (`proxy.conf.json` → `http://localhost:3000`).
- The upstream request contract was verified against the provided Postman collection: `ReadAllCRMClients` documents **exactly three query parameters** — `Text`, `Direction`, `InCT` — and returns the full matching collection as `{ "Data": Client[], "Total": number }`. Live testing additionally proved the API ignores `Page`, `PageSize`, `Skip`, `Take`, `offset`, `limit` and even `Text` itself. The BFF therefore sends a plain parameterless request and does the narrowing itself.
- Response bodies are inspected and normalized at the model layer (`normalizeCustomerList`, `normalizeCustomerRecord`, `normalizeSaveCustomerResult`) so the UI depends on stable typed records, not on undocumented payload variants (e.g. the backend returns `CommercialName`/`CommericialName`/`Name` variants — normalization picks the first populated one).
- The Save payload follows the documented `SaveCustomerWithContactPerson` contract exactly (70+ fields with sane defaults in `createCustomerPayloadDefaults`).

## Authentication

- The Authorization header is **never hard-coded** in source or committed to Git.
- **Angular** loads configuration at runtime from `public/config/app-config.json` (git-ignored) during bootstrap (`APP_INITIALIZER`); `authInterceptor` attaches `Authorization: <scheme> <token>` to every request.
- **The BFF** reads the same `public/config/app-config.json` file (or `BFF_UPSTREAM_TOKEN` env var) to authorize its upstream calls — one token file serves both tiers.
- The committed `public/config/app-config.example.json` documents the expected shape:

```json
{
  "auth": {
    "scheme": "Bearer",
    "token": "PASTE_ASSESSMENT_TOKEN_HERE"
  }
}
```

To run against the staging API: copy the example to `app-config.json` and paste your token. If the file is missing, the Angular app simply sends requests without an Authorization header and the BFF refuses to start with an explicit message (or falls back to `BFF_UPSTREAM_TOKEN`).

## Server-Side Pagination

**True server-side pagination, delivered by the BFF** (see [The BFF](#the-bff)):

1. The BFF caches the upstream dataset (fetched once, refreshed in the background per the stale-while-revalidate policy).
2. Every table-state change (page, page size, search, filters, sort, active report) produces **one** request carrying the complete state; the BFF applies `report criteria → search → categorical filters → text filters → sort → paginate` over the cached dataset and returns **only the requested page** plus `totalCount`.
3. The Angular store never holds more than `pageSize` records (5/10/20) — the grid renders exactly the returned page, and the paginator is driven by the server-provided total. 100,000+ records are never downloaded, let alone rendered.
4. Requests are deduplicated (query-equality check) and cancelled (`switchMap`), so identical or superseded queries never hit the network.

This is honest engineering about the upstream API: it documents no pagination and ignores invented parameters, so the frontend does not fake a paged contract against it — the BFF provides the paged contract instead. See [Known API Limitations](#known-api-limitations) and [Proposed Backend Contract](#proposed-backend-contract).

## Searching

Server-side search (through the BFF's `search` parameter) with a fully pipelined RxJS flow:

```text
user input → debounceTime(400ms) → distinctUntilChanged-like query equality
          → switchMap(executeQuery)
          → BFF request (precomputed search index) → signals update
```

- `debounceTime` prevents a request per keystroke.
- `switchMap` cancels the previous request when a newer one arrives, so stale responses can never overwrite newer ones.
- Search resets the page to 1; clearing the search reloads the full set.
- The BFF matches the term against a precomputed lowercase concatenation of every searchable field (ID, code, name variants, email, mobile, phones, fax, city/country names, classification, status, dates, address, comment, tax/CR/VAT numbers, …).
- Repeated identical queries are short-circuited (query equality check) so no redundant API calls are made.

## Filtering

The filter popover offers every filterable field of the selected columns — free-text fields (e.g. **ID, Code, Name, English/Arabic Name, Email, Mobile**) and categorical dimensions (**Client Type, Account Manager, City, Country**).

- **Free-text filters support operators**: Contains (default), Equals, Starts With, Ends With for text; and numeric comparators (Equals, Greater Than, Greater Than or Equal, Less Than, Less Than or Equal) for the ID field.
- **All filters are applied server-side by the BFF** over its cached dataset — the request never invents parameters the upstream API does not support.
- Categorical dropdown options come from the BFF `lookups` endpoint — distinct values over the **full** cached dataset, never from the current page. If lookups fail to load, the table and filters keep working (progressive enhancement).
- Active filters appear as removable chips; "Clear all" resets everything. Both actions reset pagination to page 1.
- Filter state is pruned when a column is hidden, so the panel never filters on a column that is not visible.

## Sorting

- Clicking any sortable header toggles asc/desc; the current sort is visualized with sort icons.
- Sorting is applied **server-side by the BFF** with a natural-sort algorithm (numbers as numbers, "Customer 2" < "Customer 10") and a stable `Id` tie-break so paging stays consistent.
- The canonical sort field names follow the API's own conventions (`AccountManagerName`, `AccountTypeName`, `CommercialName`, `CityName`, `CountryName`, …) via `SORT_FIELD_MAP` in `CustomerService` — the backend never receives invented frontend-only names.
- Sorting resets to page 1.

## Dynamic Columns

A searchable **column picker** (far right of the toolbar) drives which of the 31 catalog fields are visible:

- Selected columns render as compact removable chips in a horizontally scrollable strip; the strip supports mouse-wheel scrolling and click-and-drag panning (pointer capture, no native scrollbars).
- The dropdown lists every catalog field with a client-side search box, an "all matches" tri-state checkbox, and per-row toggles. Selecting a field immediately shows the matching table column and keeps the filter panel in sync — both are derived from the same catalog, so no page reload or duplicated state is involved.
- At least one column must remain visible (the last one cannot be unchecked); hiding a column prunes its active filter value so filtering never drifts from what is displayed.
- A "reset columns" action restores the reference grid (the 9 default columns).
- Actions/Reports can temporarily override the visible set with their `requiredColumns`; the user's own selection is restored exactly when the mode is deactivated.

## Actions & Reports

The tiles below the grid are fully functional, store-synchronized modes rather than placeholders:

- **Actions** — Collective Reassign (requires row selection), Customer Follow Up, Upload Bulk. Activating an action syncs the table columns to its `requiredColumns`; Collective Reassign additionally enables batch-select checkboxes on rows.
- **Reports** — Contacts Report, Customer Report, Account Follow Up Report. Activating a report configures the table columns, applies the report's default sort (the user's own sort is snapshotted and restored on deactivation) **and filters the table data source server-side**: the report id travels in every table request (`report` query param) and the BFF applies the report's criteria over its cached dataset before search/filter/sort/pagination. Report criteria are declared once per report (`filterCriteria` in `customer-reports.component.ts`, mirrored by `CUSTOMER_REPORT_CRITERIA` in `server/src/query.js`):
  - **Contacts Report** — customers with contact channels on record (email, mobile or phone).
  - **Customer Report** — customers already assigned to an account manager (managed accounts).
  - **Account Follow Up Report** — accounts with no manager assigned yet (the follow-up queue).
  Clicking the active report again (or the banner's Deactivate button) clears the report, restores the user's sort and returns the table to its normal state. Report criteria compose with search, user filters, sorting and pagination — every change produces exactly one BFF request through the store's single pipeline.
- **Selection survives pagination**: selected records are stored as stable, id-keyed records, so the batch selection persists across page changes and is never lost when the BFF returns a different page.
- Activating one mode deactivates the other; a toast confirms the state change, and no fake backend call is made (both sections work over the live data the grid already renders).

## Proposed Backend Contract

The minimum upstream API change required to remove the BFF and paginate directly (the BFF already implements exactly this semantics server-side — its `/api/customers` route is this contract). Parameter names follow the API's existing PascalCase convention:

```text
GET /api/CRM/ReadAllCRMClients
    ?Text=                 # existing free-text search
    &Direction=ltr         # existing (unchanged)
    &InCT=                 # existing (unchanged)
    &Page=1                # NEW — 1-based page number
    &PageSize=50           # NEW — rows per page (default 50)
    &SortField=AccountManagerName   # NEW — canonical DB/API field name
    &SortDirection=asc     # NEW — asc | desc
    &ClientTypeId=         # NEW — optional categorical filter id
    &AccountManagerId=     # NEW — optional categorical filter id
    &CityId=               # NEW — optional categorical filter id
    &CountryId=            # NEW — optional categorical filter id
    &Report=               # NEW — optional report id (contacts | customers | account-follow-up)

Response (same shape as today):
{ "Data": [ only the requested page ], "Total": 12345 }   # Total = matching count
```

Rules the frontend relies on:

- `SortField` must accept canonical field names (`AccountManagerName`, `AccountTypeName`, `CommercialName`, `CityName`, `CountryName`, `Mobile`, `Code`, `Id`, …) — the frontend maps every grid column to one of these names in `SORT_FIELD_MAP` (`CustomerService`).
- `Data` contains only the requested page; `Total` is the count of the matching set (filtered by `Text` + categorical ids + sort applied).
- New dedicated lookup endpoints for **Client Types**, **Account Managers**, **Cities** and **Countries** are required so dropdown options are not derived from the current page. The store's `lookups` signal is the single place to feed them.

Adopting it upstream is a one-file change in the BFF (`query.js` semantics are identical); the Angular side needs no changes because it already speaks this contract through the BFF.

## Signals

All UI-relevant state lives in `CustomerStore` as signals:

```text
records, totalCount, loading, error                   # server-driven state (page + total)
saving, saveError                                      # form/back-end operation state
searchTerm, textFilters, textFilterOperators, filters  # query state
page, pageSize, sortField, sortDirection               # query state
activeAction, activeReport                             # actions/reports mode state
allColumnDefs, userHiddenColumns                       # column catalog + user selection
selectedRecordsForAction, selectionEnabled             # batch-action selection (id-keyed)
lookups                                                # categorical dropdown options (BFF)
selectedCustomer, formOpen, formMode, formCustomer     # dialog UI state
```

Derived state is computed, never duplicated: `hiddenColumns` (override-aware), `selectedColumnDefs`, `userSelectedColumnDefs`, `filterableColumnDefs`, `visibleColumnCount`, `totalRecords`, `totalPages`, `pageStartIndex`, `pageEndIndex`, `hasRecords`, `isEmptyResult`, `hasServerSearch`, `hasFilters`, `totalFilterCount`, `selectedOnPage`, and the lookup option lists (`clientTypeOptions`, `accountManagerOptions`, `cityOptions`, `countryOptions`). All components use `ChangeDetectionStrategy.OnPush`, so only actual signal changes trigger re-renders. No NgRx — by design.

## RxJS

RxJS is used where it adds real value, and nowhere else:

| Concern                                | Operators                                             |
| -------------------------------------- | ----------------------------------------------------- |
| Single table-state pipeline            | `merge(debounced typing, immediate changes)` → `switchMap(executeQuery)` |
| Debounced search                       | `debounceTime(400ms)` on the typing source            |
| Request cancellation of stale queries  | `switchMap`                                           |
| Query deduplication                    | equality check before emitting a request              |
| Reload/retry/refresh pipeline          | `changeSource$` subject + `switchMap`                 |
| Stale-response immune loading flag     | monotonic `requestSeq` guard around `finalize`        |
| API errors in one place                | `catchError` (interceptor) + store-level `catchError` |
| Loading/saving lifecycle flags         | `finalize`                                            |
| Post-save refresh                      | `map` to invalidate the dedupe guard + reload once    |
| Subscriptions cleanup                  | `takeUntilDestroyed`                                  |

Async _operations_ (load, save, export) are exposed as Observables so callers can orchestrate them; all _state_ consumption is signal-based.

## Reactive Forms

- The `CustomerFormComponent` is a fully typed `FormGroup` (one shared form for **create**, **edit**, and **view** modes).
- Fields are organized into logical sections: **Basic Information, Contact Information, Identity, Address, Business/Financial, Contact Person** — with sensible `maxLength` guardrails, email validation, phone/pattern validation, URL validation, date validation (birth date with maxDate = today), and required **Code** and **Commercial Name** fields.
- Errors appear only after the user interacts with a field (`touched || dirty`), never pre-emptively.
- Submitting marks all fields touched, blocks while `saving`, and emits the validated payload upward (`saved` output) — the dialog layer owns the HTTP call and feedback.
- Contact person fields are mirrored into the API's `xmlContactPersonGrid` collection when any is filled.

## Performance Strategy

Everything that makes a 100k+ customer base usable:

1. **Only the current page is ever downloaded** — the BFF returns ≤ `pageSize` records per request; the grid renders exactly that page.
2. **Server-side search, filtering and sorting** — the BFF narrows over its cached dataset using precomputed search indexes and sort keys (single-digit ms for ~14k records).
3. **Debounced search + `switchMap`** — at most one request per 400 ms pause, stale requests cancelled outright.
4. **Request deduplication** — unchanged queries (page, search, filters, sort) do not trigger new calls.
5. **Dataset fetched once, cached** — one upstream dump (with stale-while-revalidate) instead of one 15 MB dump per interaction.
6. **Lazy-loaded feature route** — the entire customer feature is a separate, on-demand chunk.
7. **Signal-driven `OnPush` components** — re-renders happen only when referenced signals change; no change-detection storms.
8. **Functional, immutable state updates** — only the current page enters the table (`dataKey` row tracking prevents row re-creation churn).
9. **No subscription leaks** — every subscription is `takeUntilDestroyed`.
10. **`importHelpers` + production builds** with unused-code elimination (verified via `ng build` output).

## Excel Export

- Uses SheetJS; exports the **entire current result set** (server search + text/categorical filters + sort applied) fetched from the BFF export endpoint — never just the visible page.
- Business-friendly headers: `ID, Code, Name, Email, Mobile, Client Type, Account Manager, City, Country`.
- Auto-sized columns and a date-stamped filename (`customers_2026-08-12.xlsx`).
- **Strategy note / limitation:** the staging API exposes no server-side export endpoint, so the BFF export covers the loaded matching set, and the button/message clearly states the exported scope. If the upstream API later gains a server export, the strategy boundary is a single service (`CustomerExcelService`).

## Responsive Design

- **Desktop**: expanded sidebar + header + scrollable content, 4-column form grid.
- **Tablet**: collapsible sidebar; the grid scrolls horizontally inside the card; 2-column form grid.
- **Mobile**: sidebar becomes a full overlay drawer with backdrop, toolbar stacks, search gains a clear button, filter popover is full-width, table keeps horizontal scroll with sticky actions, dialog grows to ~98vw with internal scrolling, form collapses to 1 column.
- All via Tailwind breakpoints (`lg:`, `md:`, `sm:`) and PrimeNG breakpoints; no fixed pixel widths.

## Error Handling

- A single functional interceptor (`apiErrorInterceptor`) converts every failure into `ApiError` with a **user-friendly message** mapped per status: 0/network, 400, 401, 403, 404, 409, 422, 429, 500, 502/503/504.
- Raw backend exceptions are never shown; technical details are kept on the error object (available for dev logging only).
- The page renders a dedicated error state with "Try again" and "Clear search & filters" recovery actions.
- Save failures surface inside the dialog as an error banner and as a toast; the form stays open with all entered values.
- Guards against duplicate submits (`saving` signal) and double loads; superseded requests can never publish stale errors (request sequence guard).
- The BFF fails gracefully when its upstream is down: it keeps serving the stale cached dataset and retries in the background, and exposes the state via `/api/health`.

## Running the Project

```bash
# 1. Prepare runtime credentials (local only, git-ignored):
copy public\config\app-config.example.json public\config\app-config.json
#    → paste your assessment token into app-config.json

# 2. Start the BFF (port 3000):
npm install
npm start --prefix server

# 3. Serve the Angular app (proxies /api/* to the BFF):
npm start           # http://localhost:4200
```

The BFF configuration lives in `server/config.json` (port, upstream URL, cache TTLs, CORS) and can be overridden with `BFF_PORT`, `BFF_UPSTREAM_BASE_URL`, `BFF_UPSTREAM_TOKEN`, `BFF_FRESH_MS`, `BFF_MAX_STALE_MS`, `BFF_TIMEOUT_MS`, `BFF_ALLOW_ORIGIN`, `BFF_TOKEN_PATH` env vars.

## Environment Configuration

| File                                    | Purpose                                                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/environments/environment.ts`       | Dev default: BFF base URL + endpoints, `defaultPageSize`, `pageSizeOptions`, `searchDebounceMs`            |
| `src/environments/environment.prod.ts`  | Production values (replaced at build time)                                                                 |
| `server/config.json`                    | BFF port, upstream CRM URL, cache freshness/staleness, CORS origins                                         |
| `proxy.conf.json`                       | Dev-server proxy: `/api/customers`, `/api/health` → `http://localhost:3000`                                 |
| `public/config/app-config.json`         | **Runtime, git-ignored** auth credentials (read by Angular **and** the BFF)                                |
| `public/config/app-config.example.json` | Committed documentation of the config shape                                                                |

## Build

```bash
npm run build       # production build → dist/customer-management
npm start           # development server with live reload
```

The production build completes cleanly (verified), with the customer feature emitted as a lazy chunk.

## Testing

Automated unit tests run under **Vitest** (jsdom, via the `@angular/build:unit-test` runner):

```bash
npm test
```

17 spec files cover the customer store (query equality, server triggers, column visibility, actions/reports, selection), the HTTP service (BFF params, normalization, lookups), the Excel service, the models (normalization, response parsing), the form, toolbar, filters, table, form-dialog, actions-menu and column-picker components, the layout, and the app shell. Manual QA additionally covered:

- **List**: initial load, debounced search, clear search, pagination (next/prev/first/last, page size), sorting, categorical + text filters with chips and operators, empty results, API error, loading state.
- **Columns**: picker open/search, toggle columns, chip removal, last-column guard, reset, actions/reports overrides.
- **Actions/Reports**: activate/deactivate modes, column sync, server-side report filtering, batch selection across pages.
- **Actions per row**: actions menu open, Edit, close, validation errors, save success, save API error.
- **Add**: open, required/email/phone validation, successful creation, failed creation, list refresh after save.
- **Export**: correct headers, values, filename, disabled state when nothing to export.
- **Responsive**: desktop, tablet, mobile (drawer, stacked toolbar, dialog/form breakpoints).

## AI Assistance

AI tools were used during development for UI ideation, architectural review, code suggestions, debugging assistance, and performance review. All generated suggestions were reviewed, adapted, tested, and integrated manually.

## Known API Limitations

These are **facts about the provided staging API** (verified against the Postman collection and live testing), not implementation shortcuts:

1. **The upstream API has no true server-side pagination** — `ReadAllCRMClients` documents only `Text`, `Direction`, `InCT` and returns the full matching collection as `{ Data, Total }` with no page/pageSize/take parameters and no pagination metadata. Live testing confirmed it ignores invented pagination parameters too (returns the byte-identical ~14,111-record dump regardless). The BFF solves this server-side (see [The BFF](#the-bff)); the Angular app never downloads more than one page.
2. **No server-side sorting upstream** — sorting is performed by the BFF over its cached dataset with the same semantics a real backend would use.
3. **No categorical or per-field filter parameters upstream** — the BFF implements them server-side; only its own documented query parameters are sent by the frontend.
4. **No edit-specific endpoint** — the assessment provides only Read + Save; `SaveCustomerWithContactPerson` is contractually a save (create/update) call, so Edit reuses the same form and the same endpoint, preserving the customer `Id` in the payload. No fake update endpoint is invented.
5. **No delete endpoint** — Delete shows an explicit confirmation that the action is unavailable in this assessment rather than simulating success.
6. **No export endpoint** — Excel export covers the loaded matching set via the BFF export route (see [Excel Export](#excel-export)).
7. **No lookup endpoints upstream** — dropdown options are served by the BFF lookups route over the full cached dataset. Dedicated upstream lookup endpoints are part of the proposed backend contract.
8. **No auth endpoint** — the Authorization header must be supplied via the local runtime config (shared by Angular and the BFF).

## Architectural Decisions

| Decision                                            | Rationale                                                                                                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js BFF in front of the upstream API            | The upstream endpoint cannot paginate/filter/sort; a zero-dependency BFF delivers a real paged contract and one cached dataset instead of 15 MB dumps per interaction. |
| Signals store instead of NgRx                       | The task explicitly demands Angular Signals; a hand-rolled store with `computed()` covers derived state with far less boilerplate and no extra dependency. |
| Interceptor for auth + errors                       | Keeps secrets handling and error mapping in exactly one place each; components never see raw HTTP failures.                                                |
| Runtime config for credentials (shared with BFF)    | Secrets are never in source or commits; token injection is a deployment concern; one token file serves both tiers.                                          |
| Column catalog as single source of truth            | The table, filter panel and column picker derive from one metadata array — no field is ever hard-coded in markup, so columns, filters and picker can never drift. |
| Actions/Reports as store-synchronized modes         | Tiles genuinely configure columns, sort and selection through the store (with snapshot/restore) instead of being dead placeholders — no fake API calls.     |
| Normalizers at the model layer                      | The backend payload shape is undocumented/irregular; normalization isolates that instability from the rest of the app.                                     |
| Lazy feature route                                  | Loads only what the user visits; the module lines up with the 100k+ performance story.                                                                     |
| `OnPush` + signals everywhere                       | Rendering is driven exclusively by state changes; no zone-driven re-render storms in a big grid.                                                           |
| Debounce/cancel pipeline in the store, not components | Async orchestration lives in one observable flow; components only fire trigger methods.                                                                   |
| Single shared customer form                         | Create/Edit/View share one form, one validation set, one payload mapper — zero duplicated form code.                                                       |
| Plain `styles.css` + Tailwind v4 PostCSS            | Avoids legacy Sass `@import` deprecation; Tailwind v4's PostCSS plugin is the current CLI-compatible approach.                                             |