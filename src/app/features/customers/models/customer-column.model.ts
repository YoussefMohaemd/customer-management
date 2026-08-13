import { CustomerRecord } from './customer.model';
import { CustomerFilterKey, CustomerTextFilterKey } from './customer-query.model';

export type CustomerFieldKey = keyof CustomerRecord;

/** How a column's cell value is rendered. */
export type CustomerColumnType =
  'id' | 'code' | 'name' | 'text' | 'email' | 'ltr' | 'rtl' | 'link' | 'tag' | 'date';

/** Which store filter key a column maps to, and how it is filtered. */
export interface CustomerColumnFilter {
  kind: 'text' | 'numeric' | 'categorical';
  key: CustomerTextFilterKey | CustomerFilterKey;
}

/**
 * Metadata for one selectable table column.
 *
 * The catalog is the single source of truth for which API fields can be
 * displayed, their labels, rendering type, filter mapping and width. The
 * table header/body, the column picker and the filter panel are all derived
 * from it, so no field is ever hard-coded in a `<th>`/`<td>`.
 */
export interface CustomerColumnDef {
  field: CustomerFieldKey;
  label: string;
  type: CustomerColumnType;
  filter?: CustomerColumnFilter;
  width?: string;
  align?: 'left' | 'center';
}

/** Every customer field the API can return, in a stable display order. */
export const CUSTOMER_COLUMNS: readonly CustomerColumnDef[] = [
  {
    field: 'id',
    label: 'ID',
    type: 'id',
    filter: { kind: 'numeric', key: 'id' },
    width: '80px',
    align: 'center',
  },
  {
    field: 'code',
    label: 'Code',
    type: 'code',
    filter: { kind: 'text', key: 'code' },
    width: '110px',
    align: 'center',
  },
  {
    field: 'commercialName',
    label: 'Name',
    type: 'name',
    filter: { kind: 'text', key: 'name' },
  },
  { field: 'nameEn', label: 'English Name', type: 'text', filter: { kind: 'text', key: 'nameEn' } },
  { field: 'nameAr', label: 'Arabic Name', type: 'rtl', filter: { kind: 'text', key: 'nameAr' } },
  {
    field: 'email',
    label: 'Email',
    type: 'email',
    filter: { kind: 'text', key: 'email' },
  },
  {
    field: 'mobile',
    label: 'Mobile',
    type: 'ltr',
    filter: { kind: 'text', key: 'mobile' },
    width: '130px',
    align: 'center',
  },
  {
    field: 'phone',
    label: 'Phone',
    type: 'ltr',
    filter: { kind: 'text', key: 'phone' },
    align: 'center',
  },
  {
    field: 'phone2',
    label: 'Phone 2',
    type: 'ltr',
    filter: { kind: 'text', key: 'phone2' },
    align: 'center',
  },
  {
    field: 'fax',
    label: 'Fax',
    type: 'ltr',
    filter: { kind: 'text', key: 'fax' },
    align: 'center',
  },
  { field: 'website', label: 'Website', type: 'link', filter: { kind: 'text', key: 'website' } },
  { field: 'jobTitle', label: 'Job Title', type: 'text', filter: { kind: 'text', key: 'jobTitle' } },
  {
    field: 'clientType',
    label: 'Client Type (raw)',
    type: 'text',
    align: 'center',
    filter: { kind: 'text', key: 'clientType' },
  },
  {
    field: 'accountTypeName',
    label: 'Client Type',
    type: 'tag',
    filter: { kind: 'categorical', key: 'clientTypeId' },
    width: '110px',
    align: 'center',
  },
  {
    field: 'accountManagerName',
    label: 'Account Manager',
    type: 'text',
    filter: { kind: 'categorical', key: 'accountManagerId' },
    align: 'center',
  },
  {
    field: 'city',
    label: 'City',
    type: 'text',
    filter: { kind: 'categorical', key: 'cityId' },
    align: 'center',
  },
  {
    field: 'country',
    label: 'Country',
    type: 'text',
    filter: { kind: 'categorical', key: 'countryId' },
    align: 'center',
  },
  {
    field: 'classificationName',
    label: 'Classification',
    type: 'text',
    align: 'center',
    filter: { kind: 'text', key: 'classificationName' },
  },
  {
    field: 'businessFieldName',
    label: 'Business Field',
    type: 'text',
    align: 'center',
    filter: { kind: 'text', key: 'businessFieldName' },
  },
  {
    field: 'regionName',
    label: 'Region',
    type: 'text',
    align: 'center',
    filter: { kind: 'text', key: 'regionName' },
  },
  {
    field: 'gender',
    label: 'Gender',
    type: 'text',
    align: 'center',
    filter: { kind: 'text', key: 'gender' },
  },
  {
    field: 'status',
    label: 'Status',
    type: 'tag',
    align: 'center',
    filter: { kind: 'text', key: 'status' },
  },
  {
    field: 'birthDate',
    label: 'Birth Date',
    type: 'date',
    align: 'center',
    filter: { kind: 'text', key: 'birthDate' },
  },
  {
    field: 'registrationDate',
    label: 'Registration Date',
    type: 'date',
    align: 'center',
    filter: { kind: 'text', key: 'registrationDate' },
  },
  {
    field: 'createdDate',
    label: 'Created Date',
    type: 'date',
    align: 'center',
    filter: { kind: 'text', key: 'createdDate' },
  },
  { field: 'address', label: 'Address', type: 'text', filter: { kind: 'text', key: 'address' } },
  { field: 'comment', label: 'Comment', type: 'text', filter: { kind: 'text', key: 'comment' } },
  {
    field: 'taxFileNumber',
    label: 'Tax File Number',
    type: 'text',
    align: 'center',
    filter: { kind: 'text', key: 'taxFileNumber' },
  },
  {
    field: 'commercialRegistrationNumber',
    label: 'Commercial Reg. No.',
    type: 'text',
    align: 'center',
    filter: { kind: 'text', key: 'commercialRegistrationNumber' },
  },
  {
    field: 'vatRegistrationNumber',
    label: 'VAT Reg. No.',
    type: 'text',
    align: 'center',
    filter: { kind: 'text', key: 'vatRegistrationNumber' },
  },
];

/** Columns visible by default (the reference grid). */
export const DEFAULT_VISIBLE_CUSTOMER_COLUMNS: readonly CustomerFieldKey[] = [
  'id',
  'code',
  'commercialName',
  'email',
  'mobile',
  'accountTypeName',
  'accountManagerName',
  'city',
  'country',
];

/** Default hidden set = every catalog field except the default visible ones. */
export function createDefaultHiddenColumns(): ReadonlySet<CustomerFieldKey> {
  const visible = new Set(DEFAULT_VISIBLE_CUSTOMER_COLUMNS);
  return new Set(
    CUSTOMER_COLUMNS.map((column) => column.field).filter((field) => !visible.has(field)),
  );
}
