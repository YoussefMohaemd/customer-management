/**
 * Field resolution maps — mirrors the Angular normalizer
 * (`src/app/features/customers/models/customer.model.ts`) so server-side
 * search/filter behaviour is identical to what the client previously derived
 * locally.
 */

/** Raw upstream fields searched by the global `search` term. */
export const SEARCH_FIELDS = [
  'CommercialName',
  'CommericialName',
  'Name',
  'NameEN',
  'NameAR',
  'Code',
  'Email',
  'ContEmail',
  'MobileWithPrefix',
  'Mobile',
  'ContMobile',
  'PhoneWithPrefix',
  'Phone',
  'ContPhone',
  'AccountManagerName',
  'CountryName',
  'Country',
  'CityName',
  'City',
  'AccountTypeName',
  'ClientType',
  'ClassificationNam',
  'BusinessFieldName',
  'RegionName',
];

/**
 * Canonical frontend sort keys → raw API/DB field names. Same map as
 * `SORT_FIELD_MAP` in the Angular service; the BFF accepts both the canonical
 * key and the raw API field name for robustness.
 */
export const CANONICAL_TO_API_FIELD = {
  id: 'Id',
  code: 'Code',
  commercialName: 'CommercialName',
  nameEn: 'NameEN',
  nameAr: 'NameAR',
  clientType: 'ClientType',
  email: 'Email',
  mobile: 'Mobile',
  phone: 'Phone',
  phone2: 'Phone2',
  fax: 'Fax',
  website: 'Website',
  jobTitle: 'JobTitle',
  accountTypeName: 'AccountTypeName',
  accountManagerName: 'AccountManagerName',
  city: 'CityName',
  country: 'CountryName',
  classificationName: 'ClassificationName',
  businessFieldName: 'BusinessFieldName',
  regionName: 'RegionName',
  gender: 'Gender',
  status: 'Status',
  birthDate: 'BirthDate',
  registrationDate: 'RegistrationDate',
  createdDate: 'CreatedDate',
  address: 'Address',
  comment: 'Comment',
  taxFileNumber: 'TaxFileNumber',
  commercialRegistrationNumber: 'CommercialRegistrationNumber',
  vatRegistrationNumber: 'VATRegistrationNumber',
};

const API_FIELD_SET = new Set(Object.values(CANONICAL_TO_API_FIELD));

/** Resolves a requested sort field to a raw record key (or null if unknown). */
export function resolveSortField(value) {
  if (!value) {
    return null;
  }
  if (CANONICAL_TO_API_FIELD[value]) {
    return CANONICAL_TO_API_FIELD[value];
  }
  return API_FIELD_SET.has(value) ? value : null;
}

/**
 * Per-field text filter keys → raw record fields (first populated wins),
 * mirroring `TEXT_FILTER_FIELDS` / the normalizer's `pick()` order.
 */
export const TEXT_FILTER_FIELDS = {
  id: ['Id', 'ID'],
  code: ['Code', 'code'],
  name: ['CommercialName', 'CommericialName', 'Name', 'NameEN'],
  nameEn: ['NameEN', 'NameEn', 'EnglishName'],
  nameAr: ['NameAR', 'NameAr', 'ArabicName'],
  email: ['Email', 'ContEmail'],
  mobile: ['MobileWithPrefix', 'Mobile', 'ContMobile'],
  phone: ['PhoneWithPrefix', 'Phone', 'ContPhone'],
  phone2: ['Phone2', 'ContPhone'],
  fax: ['Fax', 'ContFax'],
  website: ['Website'],
  jobTitle: ['JobTitle', 'Employment'],
  clientType: ['ClientType'],
  classificationName: ['ClassificationNam', 'ClassificationName'],
  businessFieldName: ['BusinessFieldName'],
  regionName: ['RegionName'],
  gender: ['Gender'],
  status: ['Status'],
  birthDate: ['BirthDate'],
  registrationDate: ['RegistrationDate'],
  createdDate: ['CreatedDate'],
  address: ['Address', 'ContAddress'],
  comment: ['Comment'],
  taxFileNumber: ['TaxFileNumber'],
  commercialRegistrationNumber: ['CommercialRegistrationNumber'],
  vatRegistrationNumber: ['VATRegistrationNumber'],
};

/** Categorical filter param → raw id field on the record. */
export const CATEGORICAL_FILTER_FIELDS = {
  clientTypeId: 'AccountTypeId',
  accountManagerId: 'AccountManagerId',
  cityId: 'CityId',
  countryId: 'CountryId',
};

/** Reads the first populated value of a key list (mirrors the normalizer). */
export function firstValue(record, keys) {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return value;
    }
  }
  return null;
}