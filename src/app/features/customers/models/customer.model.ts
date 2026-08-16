import type { CustomerFieldKey } from './customer-column.model';
import type { CustomerReportId, CustomerSortField, SortDirection } from './customer-query.model';

/**
 * Normalized customer record as returned by `ReadAllCRMClients`.
 *
 * The staging API returns `{ "Data": Client[], "Total": number }` where
 * `Client` objects carry both id and display fields (`AccountTypeName`,
 * `AccountManagerName`, `CountryName`, `CityName`, ...). Ids of `0` mean
 * "not set" for reference dimensions and are therefore normalized to `null`.
 */
export interface CustomerRecord {
  id: number;
  code: string;
  commercialName: string;
  nameEn: string;
  nameAr: string;
  mobile: string;
  phone: string;
  phone2: string;
  fax: string;
  email: string;
  website: string;
  jobTitle: string;
  address: string;
  city: string;
  cityId: number | null;
  country: string;
  countryId: number | null;
  accountTypeId: number | null;
  accountTypeName: string;
  clientType: string;
  accountManagerId: number | null;
  accountManagerName: string;
  classificationName: string;
  businessFieldName: string;
  regionName: string;
  birthDate: string | null;
  registrationDate: string | null;
  createdDate: string | null;
  status: string | null;
  gender: string | null;
  comment: string;
  taxFileNumber: string;
  commercialRegistrationNumber: string;
  vatRegistrationNumber: string;
}

/** Result of parsing a `ReadAllCRMClients` response body. */
export interface CustomerListResult {
  records: CustomerRecord[];
  total: number;
}

/** Action definition that can sync with table state and columns. */
export interface CustomerActionDef {
  id: string;
  icon: string;
  title: string;
  description: string;
  accent: 'blue' | 'amber' | 'emerald';
  requiredColumns?: readonly CustomerFieldKey[];
  requiresSelection?: boolean;
}

/**
 * Declarative filter criteria of a report. The criteria are expressed on
 * canonical field keys (the same keys the table columns use) and are applied
 * SERVER-SIDE by the BFF (`report` query param → `CUSTOMER_REPORT_CRITERIA`
 * in `server/src/query.js`), so selecting a report genuinely filters the
 * table data source instead of faking it in the UI. User filters, search,
 * sort and pagination all keep composing on top.
 */
export interface CustomerReportCriteria {
  /** At least one of these fields must hold a value (e.g. contact channels). */
  anyOf?: readonly CustomerFieldKey[];
  /** Every one of these fields must hold a value (e.g. fully registered). */
  allOf?: readonly CustomerFieldKey[];
  /** Every one of these fields must be empty/0 (e.g. accounts awaiting follow-up). */
  noneOf?: readonly CustomerFieldKey[];
}

/** Report definition that configures table columns, server-side filters, and sort. */
export interface CustomerReportDef {
  id: CustomerReportId;
  icon: string;
  title: string;
  subtitle: string;
  accent: 'blue' | 'indigo' | 'amber';
  requiredColumns: readonly CustomerFieldKey[];
  defaultSortField?: CustomerSortField;
  defaultSortDirection?: SortDirection;
  /** Server-side filter criteria; `null`/empty criteria match every record. */
  filterCriteria?: CustomerReportCriteria;
}

/** A single row of the `xmlContactPersonGrid` collection sent to the Save API. */
export interface CustomerContactPerson extends Record<string, string | number | null | undefined> {
  name?: string | null;
  mobile?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

/** Full payload contract for POST /api/CRM/SaveCustomerWithContactPerson. */
export interface CustomerPayload {
  Id: number;
  CommercialName: string;
  Code: string;
  Mobile: string;
  Phone: string;
  Name: string;
  JobTitle: string;
  Message: string;
  CommericialName: string;
  ProjectId: number;
  UnitId: number;
  Religion: string;
  InvitedEmployeesIds: string;
  NameAR: string;
  NameEN: string;
  Phone2: string;
  Fax: string;
  Email: string;
  Website: string;
  Country: string;
  City: string;
  Address: string;
  KeyWords: string;
  Latitude: number | null;
  Longitude: number | null;
  EmpId: number;
  AccountTypeId: number | null;
  AccountManagerId: number | null;
  ClassificationId: number | null;
  BusinessFieldId: number | null;
  PaymentProfile: string | null;
  SchoolName: string;
  NationalID: string;
  BirthDate: string | null;
  RegistrationDate: string | null;
  RelatedEmpId: number | null;
  Gender: string | null;
  Status: string | null;
  BranchId: number | null;
  RequestSourceId: number | null;
  TaxFileNumber: string;
  TaxRegistrationNumber: string;
  BrothersId: string;
  PreCodeId: number | null;
  Comment: string;
  Direction: string;
  ContNameAR: string;
  ContNameEN: string;
  ContAddress: string;
  ContMobile: string;
  ContEmail: string;
  ContLatitude: number;
  ContLongitude: number;
  ContPhone: string;
  CountryId: number | null;
  CityId: number | null;
  RegionId: number | null;
  PassportNo: string;
  DistrictAR: string;
  DistrictEN: string;
  StreetAR: string;
  StreetEN: string;
  MainClientId: number | null;
  BuildingNumber: string;
  PostalCode: string;
  VATRegistrationNumber: string;
  GroupVATRegistrationNumber: string;
  AccountNo: string;
  SwiftCode: string;
  PayeeBank: string;
  CommercialRegistrationNumber: string;
  OtherId: number | null;
  OtherData: string;
  LeadRequestTypeId: number | null;
  AdditionalAddressNumber: string;
  SubAccountId: number | null;
  LegalRepresentative: string;
  LegalCapacity: string;
  xmlContactPersonGrid: CustomerContactPerson[];
  Attachment: unknown[];
  ServerIP: string;
  InCT: string;
}

/** Defaults for the documented SaveCustomerWithContactPerson contract. */
export function createCustomerPayloadDefaults(): CustomerPayload {
  return {
    Id: 0,
    CommercialName: '',
    Code: '',
    Mobile: '',
    Phone: '',
    Name: '',
    JobTitle: '',
    Message: '',
    CommericialName: '',
    ProjectId: 0,
    UnitId: 0,
    Religion: '',
    InvitedEmployeesIds: '',
    NameAR: '',
    NameEN: '',
    Phone2: '',
    Fax: '',
    Email: '',
    Website: '',
    Country: '',
    City: '',
    Address: '',
    KeyWords: '',
    Latitude: null,
    Longitude: null,
    EmpId: 0,
    AccountTypeId: null,
    AccountManagerId: null,
    ClassificationId: null,
    BusinessFieldId: null,
    PaymentProfile: null,
    SchoolName: '',
    NationalID: '',
    BirthDate: null,
    RegistrationDate: null,
    RelatedEmpId: null,
    Gender: null,
    Status: null,
    BranchId: null,
    RequestSourceId: null,
    TaxFileNumber: '',
    TaxRegistrationNumber: '',
    BrothersId: '',
    PreCodeId: null,
    Comment: '',
    Direction: '',
    ContNameAR: '',
    ContNameEN: '',
    ContAddress: '',
    ContMobile: '',
    ContEmail: '',
    ContLatitude: 0,
    ContLongitude: 0,
    ContPhone: '',
    CountryId: null,
    CityId: null,
    RegionId: null,
    PassportNo: '',
    DistrictAR: '',
    DistrictEN: '',
    StreetAR: '',
    StreetEN: '',
    MainClientId: null,
    BuildingNumber: '',
    PostalCode: '',
    VATRegistrationNumber: '',
    GroupVATRegistrationNumber: '',
    AccountNo: '',
    SwiftCode: '',
    PayeeBank: '',
    CommercialRegistrationNumber: '',
    OtherId: null,
    OtherData: '',
    LeadRequestTypeId: null,
    AdditionalAddressNumber: '',
    SubAccountId: null,
    LegalRepresentative: '',
    LegalCapacity: '',
    xmlContactPersonGrid: [],
    Attachment: [],
    ServerIP: '',
    InCT: '',
  };
}

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

/** Keys preferentially used to locate the customer collection in raw payloads. */
const COLLECTION_KEYS: readonly string[] = [
  'Data',
  'data',
  'Records',
  'records',
  'Items',
  'items',
  'Result',
  'result',
  'List',
  'list',
  'Value',
  'value',
  'Payload',
  'payload',
  'Customers',
  'customers',
  'Clients',
  'clients',
  'd',
] as const;

function readString(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value);
}

function readNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Reference ids of `0` are treated as "not set" by the CRM API. */
function readId(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value);
  return text === '' ? null : text;
}

function readDate(value: unknown): string | null {
  const text = readNullableString(value);
  if (!text) {
    return null;
  }
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : text;
}

function pick(raw: Record<string, unknown>, keys: readonly string[], fallback = ''): string {
  for (const key of keys) {
    const value = raw[key];
    if (value !== null && value !== undefined && String(value) !== '') {
      return String(value);
    }
  }
  return fallback;
}

/** Normalizes a single raw client object into a strongly typed record. */
export function normalizeCustomerRecord(raw: unknown): CustomerRecord | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const record = raw as Record<string, unknown>;

  return {
    id: readNumber(pick(record, ['Id', 'id', 'ID'])),
    code: pick(record, ['Code', 'code']),
    commercialName: pick(record, [
      'CommercialName',
      'CommericialName',
      'Name',
      'NameEN',
      'commercialName',
    ]),
    nameEn: pick(record, ['NameEN', 'NameEn', 'nameEN', 'EnglishName']),
    nameAr: pick(record, ['NameAR', 'NameAr', 'nameAR', 'ArabicName']),
    mobile: pick(record, [
      'MobileWithPrefix',
      'mobileWithPrefix',
      'Mobile',
      'mobile',
      'ContMobile',
    ]),
    phone: pick(record, ['PhoneWithPrefix', 'phoneWithPrefix', 'Phone', 'phone', 'ContPhone']),
    phone2: pick(record, ['Phone2', 'phone2', 'ContPhone']),
    fax: pick(record, ['Fax', 'fax', 'ContFax']),
    email: pick(record, ['Email', 'email', 'ContEmail']),
    website: pick(record, ['Website', 'website']),
    jobTitle: pick(record, ['JobTitle', 'jobTitle', 'Employment']),
    address: pick(record, ['Address', 'address', 'ContAddress']),
    city: pick(record, ['CityName', 'cityName', 'City', 'city']),
    cityId: readId(pick(record, ['CityId', 'cityId'])),
    country: pick(record, ['CountryName', 'countryName', 'Country', 'country']),
    countryId: readId(pick(record, ['CountryId', 'countryId'])),
    accountTypeId: readId(pick(record, ['AccountTypeId', 'accountTypeId'])),
    accountTypeName: pick(record, ['AccountTypeName', 'accountTypeName']),
    clientType: pick(record, ['ClientType', 'clientType']),
    accountManagerId: readId(pick(record, ['AccountManagerId', 'accountManagerId'])),
    accountManagerName: pick(record, ['AccountManagerName', 'accountManagerName']),
    classificationName: pick(record, [
      'ClassificationNam',
      'ClassificationName',
      'classificationName',
    ]),
    businessFieldName: pick(record, ['BusinessFieldName', 'businessFieldName']),
    regionName: pick(record, ['RegionName', 'regionName']),
    birthDate: readDate(pick(record, ['BirthDate', 'birthDate'])),
    registrationDate: readDate(pick(record, ['RegistrationDate', 'registrationDate'])),
    createdDate: readDate(pick(record, ['CreatedDate', 'createdDate'])),
    status: readNullableString(pick(record, ['Status', 'status'])),
    gender: readNullableString(pick(record, ['Gender', 'gender'])),
    comment: pick(record, ['Comment', 'comment']),
    taxFileNumber: pick(record, ['TaxFileNumber', 'taxFileNumber']),
    commercialRegistrationNumber: pick(record, [
      'CommercialRegistrationNumber',
      'commercialRegistrationNumber',
    ]),
    vatRegistrationNumber: pick(record, ['VATRegistrationNumber', 'vatRegistrationNumber']),
  };
}

/**
 * Extracts the customer collection from a raw `ReadAllCRMClients` body.
 *
 * Verified contract: `{ "Data": Client[], "Total": number }`. The runtime
 * parser additionally tolerates top-level arrays and common wrapper shapes
 * (including `Result: { Data: [...] }` and ASP.NET `d` envelopes) so the
 * UI keeps working if the staging payload shape changes.
 */
export function normalizeCustomerList(raw: unknown): CustomerListResult {
  if (Array.isArray(raw)) {
    const records = normalizeArray(raw);
    return { records, total: records.length };
  }
  if (typeof raw !== 'object' || raw === null) {
    return { records: [], total: 0 };
  }

  const container = raw as Record<string, unknown>;
  const totalRaw = readNumber(
    container['Total'] ?? container['total'] ?? container['totalCount'] ?? container['count'] ?? 0,
  );

  for (const key of COLLECTION_KEYS) {
    const candidate = container[key];
    if (Array.isArray(candidate)) {
      const records = normalizeArray(candidate);
      return { records, total: Math.max(totalRaw, records.length) };
    }
    if (isRecord(candidate)) {
      const nestedArray = findArrayIn(candidate);
      if (nestedArray.length > 0) {
        const records = normalizeArray(nestedArray);
        return { records, total: Math.max(totalRaw, records.length) };
      }
    }
  }
  return { records: [], total: 0 };
}

function normalizeArray(items: unknown[]): CustomerRecord[] {
  return items
    .map((item) => normalizeCustomerRecord(item))
    .filter((item): item is CustomerRecord => item !== null);
}

function findArrayIn(container: Record<string, unknown>): unknown[] {
  for (const key of COLLECTION_KEYS) {
    const candidate = container[key];
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
