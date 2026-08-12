# Customer Management Module

A production-quality **Enterprise ERP/CRM Customer Management** module built with **Angular 21**, **PrimeNG**, **Tailwind CSS**, **Angular Signals**, and **RxJS**.

This is a Senior Front-End engineering deliverable, not a demo: it integrates the real staging CRM API, follows server-driven search semantics, scales to **100,000+ records** without ever rendering them all, and reproduces the documented ERP UI (sidebar, header, data grid, filters, actions menu, edit modal, actions/reports sections).

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [API Integration](#api-integration)
- [Authentication](#authentication)
- [Server-Side Pagination](#server-side-pagination)
- [Searching](#searching)
- [Filtering](#filtering)
- [Sorting](#sorting)
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

- browse a customer data grid (ID, Code, Name, Email, Mobile, Client Type, Account Manager, City, Country),
- search across the full customer base **server-side** with debounced input,
- filter by free-text fields and categorical dimensions,
- sort by any grid column,
- paginate with configurable page sizes,
- add and edit customers in a large responsive modal form,
- export the current result set to Excel,
- and explore the documented "Actions" and "Reports" ERP sections.

The UI intentionally replicates the supplied assessment screenshots: dark ERP sidebar with active-state rail + star indicator, top header with global search/language/notifications/profile, white rounded card containing the toolbar/table, filter chips, actions dropdown per row, page-size paginator, and the tiles below the grid.

## Features

| Area | Detail |
| --- | --- |
| Data grid | PrimeNG table, compact enterprise styling, hover/loading/empty states |
| Search | Server-side `Text` parameter, 400 ms debounce, request cancellation |
| Filters | Free-text (server-side) + categorical (client-side over loaded set) with chips |
| Pagination | Displayed page extracted from the loaded matching set; 100k+ safe |
| Sorting | Any column, asc/desc, resets to page 1 |
| Create / Edit | Shared reactive form, validation, `SaveCustomerWithContactPerson` |
| Actions menu | View / Edit / Delete + disabled placeholders for unavailable modules |
| Export | SheetJS Excel export of the current filtered + sorted result set |
| Responsive | Sidebar collapse + mobile drawer, 4→2→1 column form grid |
| Errors | Interceptor-normalized user-friendly messages for all HTTP statuses |
| State | Angular Signals store, `computed()` derived state, `OnPush` rendering |

## Tech Stack

- **Angular 21** · TypeScript 5.9 · Standalone Components · strict TS config
- **PrimeNG 21** (`primeng` + `@primeuix/themes` Aura preset) + PrimeIcons
- **Tailwind CSS 4** via `@tailwindcss/postcss` (v4-native PostCSS plugin, no legacy config)
- **RxJS** · **Angular Signals** · **Reactive Forms**
- **SheetJS (`xlsx`)** for Excel export
- Prettier for formatting

No unnecessary libraries were added. Everything else uses native Angular/PrimeNG capabilities.

## Project Structure

```text
src/
└── app/
    ├── core/                        # App-wide infrastructure (no feature logic)
    │   ├── config/navigation.ts     # Sidebar navigation definition
    │   ├── interceptors/            # auth + user-friendly API error handling
    │   ├── layout/                  # MainLayout, Sidebar, Topbar shell
    │   ├── models/                  # ApiError + status→message map
    │   └── services/                # Runtime config loader (auth token)
    │
    ├── shared/
    │   └── components/              # Reusable EmptyState component
    │
    ├── features/customers/
    │   ├── components/
    │   │   ├── customer-page/       # Route orchestrator (search pipeline, export, delete confirm)
    │   │   ├── customer-toolbar/    # Search input + filter chips
    │   │   ├── customer-filters/    # Filter button/popover, self-contained
    │   │   ├── customer-table/      # Pure-view PrimeNG data grid
    │   │   ├── customer-actions-menu/ # Row actions dropdown
    │   │   ├── customer-form/       # Reusable create/edit/view reactive form
    │   │   └── customer-form-dialog/# Modal shell + save workflow
    │   ├── models/                  # Customer, query, response, form-value models
    │   ├── services/                # HTTP service + Excel export service
    │   └── state/                   # Signal-based CustomerStore
    │
    ├── environments/                # API base URLs, endpoints, tuning constants
    ├── app.config.ts                # ApplicationConfig (DI, interceptors, PrimeNG theme)
    └── app.routes.ts                # Lazy-loaded /customers route
```

## Architecture

- **Feature-based, lazy-loaded**: `/customers` is a lazy route; the customer feature chunk is only fetched when the route is opened (verified in the build output as a separate lazy chunk).
- **Strict separation of concerns**:

  | Layer | Responsibility |
  | --- | --- |
  | `CustomerService` | Everything HTTP (endpoints, params, normalization). No UI state. |
  | `CustomerStore` | Signal-based UI/query state + orchestration. No direct API calls into components. |
  | Components | Presentational; consume signals, emit typed intents. |
  | RxJS pipeline | Lives in `CustomerPageComponent` (debounce/cancel/serialization). |

- **Dependency Injection** everywhere: `inject()`, `providedIn: 'root'` singletons, functional interceptors registered in `provideHttpClient(withInterceptors([...]))`.
- **Powerful typing, no `any`**: strict TS (`strict: true`, `strictTemplates: true`), typed models, typed reactive form groups.

## API Integration

| Operation | Endpoint |
| --- | --- |
| Read customers | `GET /api/CRM/ReadAllCRMClients?Text=&Direction=ltr&InCT=` |
| Save (create/update) | `POST /api/CRM/SaveCustomerWithContactPerson?InCT=` |

- Base URL + endpoints live only in `src/environments/*` (swapped per build config via `fileReplacements`).
- Response bodies are inspected and normalized at the model layer (`normalizeCustomerList`, `normalizeCustomerRecord`, `normalizeSaveCustomerResult`) so the UI depends on stable typed records, not on undocumented payload variants (e.g. the backend returns `CommercialName`/`CommericialName`/`Name` variants — normalization picks the first populated one).
- The Save payload follows the documented `SaveCustomerWithContactPerson` contract exactly (70+ fields with sane defaults in `createCustomerPayloadDefaults`).

## Authentication

- The Authorization header is **never hard-coded** in source or committed to Git.
- Configuration is loaded at runtime from `public/config/app-config.json` (git-ignored) during bootstrap (`APP_INITIALIZER`).
- `authInterceptor` clones every request and attaches `Authorization: <scheme> <token>` from that runtime config.
- The committed `public/config/app-config.example.json` documents the expected shape:

```json
{
  "auth": {
    "scheme": "Bearer",
    "token": "PASTE_ASSESSMENT_TOKEN_HERE"
  }
}
```

To run against the staging API: copy the example to `app-config.json` and paste your token. If the file is missing, requests simply go out without an Authorization header and the API error handler explains how to configure it.

## Server-Side Pagination

**Honest engineering about the API contract:** the provided `ReadAllCRMClients` endpoint exposes only `Text`, `Direction`, and `InCT`. It has **no** `page`/`pageSize`/`skip` parameters, and it returns the full matching collection rather than pagination metadata. Inventing fake pagination parameters would be wrong, so the app does the following:

1. The **server** narrows the universe with the free-text `Text` parameter (search + text filters).
2. The store loads that matching set and derives the visible page **in memory** (slice of `pageSize` per `page`).
3. **The UI renders at most `pageSize` rows (default 8).** 100,000+ matching records are never rendered — only the current page is put into the DOM.
4. A safety cap (`maxRecordsToLoad`, default 50,000) protects the browser from absurdly large responses and shows a warning banner with guidance to narrow the search.

This is documented rather than faked because no true server-side pagination contract exists. See [Known API Limitations](#known-api-limitations).

## Searching

Server-side search through the `Text` parameter with a fully pipelined RxJS flow:

```text
user input → debounceTime(400ms) → distinctUntilChanged()
          → switchMap(store.searchCustomers)
          → API call → signals update
```

- `debounceTime` prevents a request per keystroke.
- `distinctUntilChanged` skips duplicate emissions.
- `switchMap` cancels the previous request when a newer one arrives, so stale responses can never overwrite newer ones.
- Search resets the page to 1.
- Clearing the search reloads the full set.
- Repeated identical queries are short-circuited (query equality check) so no redundant API calls are made.

## Filtering

The filter popover offers the reference fields: **ID, Code, Name, Email, Mobile** (free-text) and **Client Type, Account Manager, City, Country** (categorical).

- Free-text filters are composed into the server-side `Text` parameter (e.g. `id:1024 name:acme`) — the server narrows the result.
- Categorical filters are applied over the loaded matching set with memoized `computed()`s. This is a documented API limitation: the endpoint has no categorical filter parameters (see [Known API Limitations](#known-api-limitations)).
- Active filters appear as removable chips; "Clear all" resets everything. Both actions reset pagination to page 1.
- Categorical dropdown options are derived from the real loaded data (distinct values), never hard-coded.

## Sorting

- Clicking any sortable header toggles asc/desc; the current sort is visualized with sort icons.
- Sorting is applied over the loaded matching set (the API has no sort parameter) with a stable tie-break (id) so paging stays consistent.
- Sorting resets to page 1.
- Only the current page is re-rendered; no client-side sorting of 100k+ rows is attempted when filtering has already narrowed the set — and it is intentionally not claimed to be server-side.

## Signals

All UI-relevant state lives in `CustomerStore` as signals:

```text
records, loading, error, loadWarning      # server-driven state
saving, saveError                          # form/back-end operation state
searchTerm, textFilters, filters           # query state
page, pageSize, sortField, sortDirection   # query state
selectedCustomer, formOpen, formMode, formCustomer  # dialog UI state
```

Derived state is computed, never duplicated: `totalRecords`, `categoricalFilteredRecords`, `sortedRecords`, `totalPages`, `paginatedCustomers`, `pageStartIndex`, `pageEndIndex`, `hasRecords`, `isEmptyResult`, `hasFilters`, `totalFilterCount`, and the categorical filter option lists. All components use `ChangeDetectionStrategy.OnPush`, so only actual signal changes trigger re-renders. No NgRx — by design.

## RxJS

RxJS is used where it adds real value, and nowhere else:

| Concern | Operators |
| --- | --- |
| Debounced search pipeline | `debounceTime` → `distinctUntilChanged` → `switchMap` |
| Request cancellation of stale searches | `switchMap` |
| Reload/retry pipeline | `subject$` + `switchMap` |
| API errors in one place | `catchError` (interceptor) |
| Loading/saving lifecycle flags | `finalize` |
| Post-save refresh | `tap`/`map` to trigger one reload after success |
| Subscriptions cleanup | `takeUntilDestroyed` |

Async *operations* (load, save) are exposed as Observables so callers can orchestrate/cancel them; all *state* consumption is signal-based.

## Reactive Forms

- The `CustomerFormComponent` is a fully typed `FormGroup` (one shared form for **create**, **edit**, and **view** modes).
- Fields are organized into logical sections: **Basic Information, Contact Information, Identity, Address, Business/Financial, Contact Person** — with sensible `maxLength` guardrails, email validation, phone/pattern validation, URL validation, date validation (birth date with maxDate = today), and a required **Commercial Name**.
- Errors appear only after the user interacts with a field (`touched || dirty`), never pre-emptively.
- Submitting marks all fields touched, blocks while `saving`, and emits the validated payload upward (`saved` output) — the dialog layer owns the HTTP call and feedback.
- Contact person fields are mirrored into the API's `xmlContactPersonGrid` collection when any is filled.

## Performance Strategy

Everything that makes a 100k+ customer base usable:

1. **Only the current page is rendered** — the grid receives exactly `pageSize` rows.
2. **Server-side search** — `Text` narrowing happens on the server before data even reaches the browser; queries never load the whole 100k base.
3. **Debounced search + `switchMap`** — at most one request per 400 ms pause, stale requests cancelled outright.
4. **Request deduplication** — unchanged queries (page, search, filters, sort) do not trigger new calls.
5. **Lazy-loaded feature route** — the entire customer feature is a separate, on-demand chunk.
6. **Signal-driven `OnPush`** components — re-renders happen only when referenced signals change; no change-detection storms.
7. **Functional, immutable state updates** — records are stored once and only the current slice is pushed into the table (`dataKey` row tracking prevents row re-creation churn).
8. **Capped defensive load** — `maxRecordsToLoad` (50k) prevents pathological payloads from freezing the browser, with an explicit warning banner.
9. **No subscriptions leaks** — every subscription is `takeUntilDestroyed`.
10. **`importHelpers` + production builds** with unused-code elimination (verified via `ng build` output).

## Excel Export

- Uses SheetJS; exports the **entire current result set** (matched by server search + text filters, categorical filters, and sort applied) — never just the visible page.
- Business-friendly headers: `ID, Code, Name, Email, Mobile, Client Type, Account Manager, City, Country`.
- Auto-sized columns and a date-stamped filename (`customers_2026-08-12.xlsx`).
- **Strategy note / limitation:** the staging API exposes no server-side export endpoint and no paged fetch contract, so a full 100k-row server export is not possible with the provided backend. The export therefore covers the loaded matching set, and the button/message clearly states the exported scope. If the API later gains a server export, the strategy boundary is a single service (`CustomerExcelService`).

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
- Guards against duplicate submits (`saving` signal) and double loads.

## Running the Project

```bash
npm install

# 1. Prepare runtime credentials (local only, git-ignored):
copy public\config\app-config.example.json public\config\app-config.json
#    → paste your assessment token into app-config.json

# 2. Serve:
npm start           # http://localhost:4200
```

## Environment Configuration

| File | Purpose |
| --- | --- |
| `src/environments/environment.ts` | Dev default: API base URL, endpoints, `defaultPageSize`, `pageSizeOptions`, `searchDebounceMs`, `maxRecordsToLoad` |
| `src/environments/environment.prod.ts` | Production values (replaced at build time) |
| `public/config/app-config.json` | **Runtime, git-ignored** auth credentials |
| `public/config/app-config.example.json` | Committed documentation of the config shape |

## Build

```bash
npm run build       # production build → dist/customer-management
npm start           # development server with live reload
```

The production build completes cleanly (verified), with the customer feature emitted as a lazy chunk.

## Testing

Manual QA covered:

- **List**: initial load, debounced search, clear search, pagination (next/prev/first/last, page size), sorting, categorical + text filters with chips, empty results, API error, loading state.
- **Actions**: actions menu open, Edit, close, validation errors, save success, save API error.
- **Add**: open, required/email/phone validation, successful creation, failed creation, list refresh after save.
- **Export**: correct headers, values, filename, disabled state when nothing to export.
- **Responsive**: desktop, tablet, mobile (drawer, stacked toolbar, dialog/form breakpoints).

## AI Assistance

AI tools were used during development for UI ideation, architectural review, code suggestions, debugging assistance, and performance review. All generated suggestions were reviewed, adapted, tested, and integrated manually.

## Known API Limitations

These are **facts about the provided staging API**, not implementation shortcuts:

1. **No true server-side pagination** — `ReadAllCRMClients` returns the full matching collection; it has no page/pageSize/take parameters and no pagination metadata. Client-side pagination over the server-filtered set is therefore the only correct implementation.
2. **No server-side sorting** — sorting is applied over the loaded matching set.
3. **No categorical filter parameters** — Client Type / Account Manager / City / Country filters run over the loaded matching set. Free-text filters *are* served server-side via `Text`.
4. **No edit-specific endpoint** — the assessment provides only Read + Save; `SaveCustomerWithContactPerson` is contractually a save (create/update) call, so Edit reuses the same form and the same endpoint, preserving the customer `Id` in the payload. No fake update endpoint is invented.
5. **No delete endpoint** — Delete shows an explicit confirmation that the action is unavailable in this assessment rather than simulating success.
6. **No export endpoint** — Excel export covers the loaded matching set (see [Excel Export](#excel-export)).
7. **No auth endpoint** — the Authorization header must be supplied via the local runtime config.

## Architectural Decisions

| Decision | Rationale |
| --- | --- |
| Signals store instead of NgRx | The task explicitly demands Angular Signals; a hand-rolled store with `computed()` covers derived state with far less boilerplate and no extra dependency. |
| Interceptor for auth + errors | Keeps secrets handling and error mapping in exactly one place each; components never see raw HTTP failures. |
| Runtime config for credentials | Secrets are never in source or commits; token injection is a deployment concern. |
| Normalizers at the model layer | The backend payload shape is undocumented/irregular; normalization isolates that instability from the rest of the app. |
| Lazy feature route | Loads only what the user visits; the module lines up with the 100k+ performance story. |
| `OnPush` + signals everywhere | Rendering is driven exclusively by state changes; no zone-driven re-render storms in a big grid. |
| Debounce/cancel pipeline in the page, not the store | The store stays synchronous and simple; async orchestration stays in one observable flow. |
| Single shared customer form | Create/Edit/View share one form, one validation set, one payload mapper — zero duplicated form code. |
| Plain `styles.css` + Tailwind v4 PostCSS | Avoids legacy Sass `@import` deprecation; Tailwind v4's PostCSS plugin is the current CLI-compatible approach. |