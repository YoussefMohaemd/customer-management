export type SortDirection = 'asc' | 'desc';

/**
 * Canonical ids of the declarative Reports section. Each report carries a
 * `filterCriteria` that the BFF applies server-side (`report` query param),
 * so a report click genuinely filters the table data source — never just the
 * UI. See `CUSTOMER_REPORT_CRITERIA` in `server/src/query.js`.
 */
export type CustomerReportId = 'contacts' | 'customers' | 'account-follow-up';

export type CustomerSortField =
  | 'id'
  | 'code'
  | 'commercialName'
  | 'nameEn'
  | 'nameAr'
  | 'clientType'
  | 'email'
  | 'mobile'
  | 'phone'
  | 'phone2'
  | 'fax'
  | 'website'
  | 'jobTitle'
  | 'accountTypeName'
  | 'accountManagerName'
  | 'city'
  | 'country'
  | 'classificationName'
  | 'businessFieldName'
  | 'regionName'
  | 'gender'
  | 'status'
  | 'birthDate'
  | 'registrationDate'
  | 'createdDate'
  | 'address'
  | 'comment'
  | 'taxFileNumber'
  | 'commercialRegistrationNumber'
  | 'vatRegistrationNumber';

/** Categorical filters applied over the loaded collection (see README — API limitation). */
export type CustomerFilterKey = 'clientTypeId' | 'accountManagerId' | 'cityId' | 'countryId';

/** Text filters composed into the server-side `Text` search parameter. */
export type CustomerTextFilterKey =
  | 'id'
  | 'code'
  | 'name'
  | 'nameEn'
  | 'nameAr'
  | 'email'
  | 'mobile'
  | 'phone'
  | 'phone2'
  | 'fax'
  | 'website'
  | 'jobTitle'
  | 'clientType'
  | 'classificationName'
  | 'businessFieldName'
  | 'regionName'
  | 'gender'
  | 'status'
  | 'birthDate'
  | 'registrationDate'
  | 'createdDate'
  | 'address'
  | 'comment'
  | 'taxFileNumber'
  | 'commercialRegistrationNumber'
  | 'vatRegistrationNumber';

/** Operators available for free-text filter values. */
export type CustomerTextOperator = 'contains' | 'equals' | 'startsWith' | 'endsWith';

/** Operators available for numeric filter values (e.g. ID). */
export type CustomerNumericOperator =
  'equals' | 'greaterThan' | 'greaterThanOrEqual' | 'lessThan' | 'lessThanOrEqual';

/** Enumeration filters only support exact equality. */
export type CustomerCategoricalOperator = 'equals';

export type CustomerFilterOperator =
  CustomerTextOperator | CustomerNumericOperator | CustomerCategoricalOperator;

export const TEXT_OPERATORS: readonly CustomerTextOperator[] = [
  'contains',
  'equals',
  'startsWith',
  'endsWith',
];

/** Every filterable field in canonical display order (text first, then categorical). */
export const CUSTOMER_FILTER_KEYS: readonly (CustomerTextFilterKey | CustomerFilterKey)[] = [
  'id',
  'code',
  'name',
  'nameEn',
  'nameAr',
  'email',
  'mobile',
  'phone',
  'phone2',
  'fax',
  'website',
  'jobTitle',
  'clientType',
  'classificationName',
  'businessFieldName',
  'regionName',
  'gender',
  'status',
  'birthDate',
  'registrationDate',
  'createdDate',
  'address',
  'comment',
  'taxFileNumber',
  'commercialRegistrationNumber',
  'vatRegistrationNumber',
  'clientTypeId',
  'accountManagerId',
  'cityId',
  'countryId',
];

/** Display labels for every filterable field. */
export const CUSTOMER_FILTER_LABELS: Record<CustomerTextFilterKey | CustomerFilterKey, string> = {
  id: 'ID',
  code: 'Code',
  name: 'Name',
  nameEn: 'English Name',
  nameAr: 'Arabic Name',
  email: 'Email',
  mobile: 'Mobile',
  phone: 'Phone',
  phone2: 'Phone 2',
  fax: 'Fax',
  website: 'Website',
  jobTitle: 'Job Title',
  clientType: 'Client Type (raw)',
  classificationName: 'Classification',
  businessFieldName: 'Business Field',
  regionName: 'Region',
  gender: 'Gender',
  status: 'Status',
  birthDate: 'Birth Date',
  registrationDate: 'Registration Date',
  createdDate: 'Created Date',
  address: 'Address',
  comment: 'Comment',
  taxFileNumber: 'Tax File Number',
  commercialRegistrationNumber: 'Commercial Reg. No.',
  vatRegistrationNumber: 'VAT Reg. No.',
  clientTypeId: 'Client Type',
  accountManagerId: 'Account Manager',
  cityId: 'City',
  countryId: 'Country',
};

/** Every free-text filter key in canonical display order (single source of truth). */
export const TEXT_FILTER_KEYS: readonly CustomerTextFilterKey[] = [
  'id',
  'code',
  'name',
  'nameEn',
  'nameAr',
  'email',
  'mobile',
  'phone',
  'phone2',
  'fax',
  'website',
  'jobTitle',
  'clientType',
  'classificationName',
  'businessFieldName',
  'regionName',
  'gender',
  'status',
  'birthDate',
  'registrationDate',
  'createdDate',
  'address',
  'comment',
  'taxFileNumber',
  'commercialRegistrationNumber',
  'vatRegistrationNumber',
];

/** Every categorical filter key (single source of truth). */
export const CATEGORICAL_FILTER_KEYS: readonly CustomerFilterKey[] = [
  'clientTypeId',
  'accountManagerId',
  'cityId',
  'countryId',
];

/** True when a filter key addresses a free-text value rather than a categorical one. */
export function isTextFilterKey(
  key: CustomerTextFilterKey | CustomerFilterKey,
): key is CustomerTextFilterKey {
  return !['clientTypeId', 'accountManagerId', 'cityId', 'countryId'].includes(key);
}

export const NUMERIC_OPERATORS: readonly CustomerNumericOperator[] = [
  'equals',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
];

export const CATEGORICAL_OPERATORS: readonly CustomerCategoricalOperator[] = ['equals'];

export const DEFAULT_TEXT_OPERATOR: CustomerTextOperator = 'contains';
export const DEFAULT_NUMERIC_OPERATOR: CustomerNumericOperator = 'equals';

export function customerOperatorLabel(operator: CustomerFilterOperator): string {
  switch (operator) {
    case 'contains':
      return 'Contains';
    case 'equals':
      return 'Equals';
    case 'startsWith':
      return 'Starts With';
    case 'endsWith':
      return 'Ends With';
    case 'greaterThan':
      return 'Greater Than';
    case 'greaterThanOrEqual':
      return 'Greater Than or Equal';
    case 'lessThan':
      return 'Less Than';
    case 'lessThanOrEqual':
      return 'Less Than or Equal';
  }
}

export interface CustomerFilters {
  clientTypeId: number | null;
  accountManagerId: number | null;
  cityId: number | null;
  countryId: number | null;
}

export interface CustomerQuery {
  search: string;
  textFilters: Partial<Record<CustomerTextFilterKey, string>>;
  textFilterOperators: Partial<Record<CustomerTextFilterKey, CustomerFilterOperator>>;
  filters: CustomerFilters;
  /** Active report id — the BFF applies the report's server-side criteria. */
  report: CustomerReportId | null;
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

/** One option of a categorical filter dropdown (BFF lookups endpoint). */
export interface CustomerLookupOption {
  value: number;
  label: string;
}

/** Distinct filter dropdown options served by the BFF. */
export interface CustomerLookups {
  clientTypes: CustomerLookupOption[];
  accountManagers: CustomerLookupOption[];
  cities: CustomerLookupOption[];
  countries: CustomerLookupOption[];
}

export function createEmptyCustomerQuery(): CustomerQuery {
  return {
    search: '',
    textFilters: {},
    textFilterOperators: {},
    filters: { ...EMPTY_CUSTOMER_FILTERS },
    report: null,
    page: 1,
    pageSize: 5,
    sortField: null,
    sortDirection: 'asc',
  };
}

export function isCustomerQueryEqual(a: CustomerQuery, b: CustomerQuery): boolean {
  if (
    a.search !== b.search ||
    a.page !== b.page ||
    a.pageSize !== b.pageSize ||
    a.sortField !== b.sortField ||
    a.sortDirection !== b.sortDirection ||
    a.report !== b.report
  ) {
    return false;
  }

  // Compare categorical filters
  if (
    a.filters.clientTypeId !== b.filters.clientTypeId ||
    a.filters.accountManagerId !== b.filters.accountManagerId ||
    a.filters.cityId !== b.filters.cityId ||
    a.filters.countryId !== b.filters.countryId
  ) {
    return false;
  }

  // Compare text filters dynamically
  const keys = new Set([...Object.keys(a.textFilters), ...Object.keys(b.textFilters)]);
  for (const k of keys) {
    const key = k as CustomerTextFilterKey;
    if ((a.textFilters[key] ?? '').trim() !== (b.textFilters[key] ?? '').trim()) {
      return false;
    }
    if ((a.textFilterOperators[key] ?? '') !== (b.textFilterOperators[key] ?? '')) {
      return false;
    }
  }

  return true;
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
