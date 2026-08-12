/**
 * Normalized customer record as displayed by the Read API.
 * Field names are normalized (the backend returns several variants such as
 * `CommericialName` / `CommercialName` / `Name`) via `normalizeCustomerRecord`.
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
  accountManagerId: number | null;
  classificationId: number | null;
  businessFieldId: number | null;
  birthDate: string | null;
  registrationDate: string | null;
  status: string | null;
  gender: string | null;
  comment: string;
  taxFileNumber: string;
  commercialRegistrationNumber: string;
  vatRegistrationNumber: string;
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
    InCT: ''
  };
}

// ---------------------------------------------------------------------------
// Normalization helpers (the Read API payload shape is not strongly documented)
// ---------------------------------------------------------------------------

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

function readNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
    commercialName: pick(record, ['CommercialName', 'CommericialName', 'Name', 'NameEN', 'commercialName']),
    nameEn: pick(record, ['NameEN', 'NameEn', 'nameEN', 'EnglishName']),
    nameAr: pick(record, ['NameAR', 'NameAr', 'nameAR', 'ArabicName']),
    mobile: pick(record, ['Mobile', 'mobile', 'ContMobile']),
    phone: pick(record, ['Phone', 'phone', 'ContPhone']),
    phone2: pick(record, ['Phone2', 'phone2', 'ContPhone']),
    fax: pick(record, ['Fax', 'fax', 'ContFax']),
    email: pick(record, ['Email', 'email', 'ContEmail']),
    website: pick(record, ['Website', 'website']),
    jobTitle: pick(record, ['JobTitle', 'jobTitle']),
    address: pick(record, ['Address', 'address', 'ContAddress']),
    city: pick(record, ['City', 'city']),
    cityId: readNullableNumber(pick(record, ['CityId', 'cityId'])),
    country: pick(record, ['Country', 'country']),
    countryId: readNullableNumber(pick(record, ['CountryId', 'countryId'])),
    accountTypeId: readNullableNumber(pick(record, ['AccountTypeId', 'accountTypeId'])),
    accountManagerId: readNullableNumber(pick(record, ['AccountManagerId', 'accountManagerId'])),
    classificationId: readNullableNumber(pick(record, ['ClassificationId', 'classificationId'])),
    businessFieldId: readNullableNumber(pick(record, ['BusinessFieldId', 'businessFieldId'])),
    birthDate: readDate(pick(record, ['BirthDate', 'birthDate'])),
    registrationDate: readDate(pick(record, ['RegistrationDate', 'registrationDate'])),
    status: readNullableString(pick(record, ['Status', 'status'])),
    gender: readNullableString(pick(record, ['Gender', 'gender'])),
    comment: pick(record, ['Comment', 'comment']),
    taxFileNumber: pick(record, ['TaxFileNumber', 'taxFileNumber']),
    commercialRegistrationNumber: pick(record, ['CommercialRegistrationNumber', 'commercialRegistrationNumber']),
    vatRegistrationNumber: pick(record, ['VATRegistrationNumber', 'vatRegistrationNumber'])
  };
}

/** Extracts the customer collection from raw payloads (array or common wrapper shapes). */
export function normalizeCustomerList(raw: unknown): CustomerRecord[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => normalizeCustomerRecord(item)).filter((item): item is CustomerRecord => item !== null);
  }
  if (typeof raw !== 'object' || raw === null) {
    return [];
  }
  const container = raw as Record<string, unknown>;
  for (const key of ['Data', 'data', 'Items', 'items', 'Result', 'result', 'List', 'list', 'Value', 'value', 'Customers', 'customers', 'Clients', 'clients']) {
    const candidate = container[key];
    if (Array.isArray(candidate)) {
      return candidate.map((item) => normalizeCustomerRecord(item)).filter((item): item is CustomerRecord => item !== null);
    }
  }
  return [];
}