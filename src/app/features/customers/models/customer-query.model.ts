export type SortDirection = 'asc' | 'desc';

export type CustomerSortField =
  'id' | 'code' | 'commercialName' | 'email' | 'mobile' | 'city' | 'country';

/** Categorical filters applied over the loaded collection (see README — API limitation). */
export type CustomerFilterKey = 'clientTypeId' | 'accountManagerId' | 'cityId' | 'countryId';

/** Text filters composed into the server-side `Text` search parameter. */
export type CustomerTextFilterKey = 'id' | 'code' | 'name' | 'email' | 'mobile';

export interface CustomerFilters {
  clientTypeId: number | null;
  accountManagerId: number | null;
  cityId: number | null;
  countryId: number | null;
}

export interface CustomerQuery {
  search: string;
  textFilters: Partial<Record<CustomerTextFilterKey, string>>;
  filters: CustomerFilters;
  page: number;
  pageSize: number;
  sortField: CustomerSortField | null;
  sortDirection: SortDirection;
}

export const EMPTY_CUSTOMER_FILTERS: CustomerFilters = {
  clientTypeId: null,
  accountManagerId: null,
  cityId: null,
  countryId: null,
};

export function createEmptyCustomerQuery(): CustomerQuery {
  return {
    search: '',
    textFilters: {},
    filters: { ...EMPTY_CUSTOMER_FILTERS },
    page: 1,
    pageSize: 8,
    sortField: null,
    sortDirection: 'asc',
  };
}

/**
 * Composes the runtime search terms for the Read API `Text` parameter.
 * The backend exposes a single free-text parameter, therefore all free-text
 * filter terms are combined into one server-side search expression.
 */
export function composeServerSearchText(
  search: string,
  textFilters: Partial<Record<CustomerTextFilterKey, string>>,
): string {
  const parts: string[] = [];
  if (search.trim()) {
    parts.push(search.trim());
  }
  for (const [key, value] of Object.entries(textFilters)) {
    const text = (value ?? '').trim();
    if (text) {
      parts.push(`${key}:${text}`);
    }
  }
  return parts.join(' ');
}

export function isCustomerQueryEqual(a: CustomerQuery, b: CustomerQuery): boolean {
  return (
    a.search === b.search &&
    a.page === b.page &&
    a.pageSize === b.pageSize &&
    a.sortField === b.sortField &&
    a.sortDirection === b.sortDirection &&
    a.textFilters.id === b.textFilters.id &&
    a.textFilters.code === b.textFilters.code &&
    a.textFilters.name === b.textFilters.name &&
    a.textFilters.email === b.textFilters.email &&
    a.textFilters.mobile === b.textFilters.mobile &&
    a.filters.clientTypeId === b.filters.clientTypeId &&
    a.filters.accountManagerId === b.filters.accountManagerId &&
    a.filters.cityId === b.filters.cityId &&
    a.filters.countryId === b.filters.countryId
  );
}

export function hasActiveTextFilters(
  filters: Partial<Record<CustomerTextFilterKey, string>>,
): boolean {
  return Object.values(filters).some((value) => (value ?? '').trim().length > 0);
}

export function hasActiveCategoricalFilters(filters: CustomerFilters): boolean {
  return Object.values(filters).some((value) => value !== null);
}

export function hasAnyFilter(query: CustomerQuery): boolean {
  return hasActiveTextFilters(query.textFilters) || hasActiveCategoricalFilters(query.filters);
}
