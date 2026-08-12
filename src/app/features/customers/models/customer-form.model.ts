import {
  CustomerContactPerson,
  CustomerPayload,
  createCustomerPayloadDefaults
} from '@features/customers/models/customer.model';

/**
 * Values produced by the reactive customer form.
 * Dates are kept as ISO strings (`yyyy-MM-dd`) for API compatibility.
 */
export interface CustomerFormValues {
  code: string;
  commercialName: string;
  nameAR: string;
  nameEN: string;
  nameFR: string;
  jobTitle: string;
  birthDate: string | null;
  email: string;
  mobile: string;
  phone: string;
  phone2: string;
  fax: string;
  website: string;
  nationalId: string;
  passportNo: string;
  address: string;
  districtAR: string;
  districtEN: string;
  streetAR: string;
  streetEN: string;
  country: string;
  city: string;
  buildingNumber: string;
  postalCode: string;
  accountNo: string;
  accountManagerId: number | null;
  swiftCode: string;
  payeeBank: string;
  vatRegistrationNumber: string;
  groupVatRegistrationNumber: string;
  commercialRegistrationNumber: string;
  taxFileNumber: string;
  contNameAR: string;
  contNameEN: string;
  contAddress: string;
  contMobile: string;
  contEmail: string;
  contPhone: string;
}

export function emptyCustomerFormValues(): CustomerFormValues {
  return {
    code: '',
    commercialName: '',
    nameAR: '',
    nameEN: '',
    nameFR: '',
    jobTitle: '',
    birthDate: null,
    email: '',
    mobile: '',
    phone: '',
    phone2: '',
    fax: '',
    website: '',
    nationalId: '',
    passportNo: '',
    address: '',
    districtAR: '',
    districtEN: '',
    streetAR: '',
    streetEN: '',
    country: '',
    city: '',
    buildingNumber: '',
    postalCode: '',
    accountNo: '',
    accountManagerId: null,
    swiftCode: '',
    payeeBank: '',
    vatRegistrationNumber: '',
    groupVatRegistrationNumber: '',
    commercialRegistrationNumber: '',
    taxFileNumber: '',
    contNameAR: '',
    contNameEN: '',
    contAddress: '',
    contMobile: '',
    contEmail: '',
    contPhone: ''
  };
}

const CONTACT_PERSON_FIELDS: readonly (keyof CustomerFormValues)[] = [
  'contNameAR',
  'contNameEN',
  'contAddress',
  'contMobile',
  'contEmail',
  'contPhone'
] as const;

/**
 * Maps validated form values onto the documented SaveCustomerWithContactPerson
 * payload. Independent fields keep their defaults; contact person data is
 * mirrored into the `xmlContactPersonGrid` collection expected by the API.
 */
export function toCustomerPayload(values: CustomerFormValues, existingId: number): CustomerPayload {
  const payload = createCustomerPayloadDefaults();

  payload.Id = existingId;
  payload.Code = values.code.trim();
  payload.CommercialName = values.commercialName.trim();
  payload.Name = values.commercialName.trim();
  payload.NameAR = values.nameAR.trim();
  payload.NameEN = values.nameEN.trim();
  payload.CommericialName = values.nameFR.trim();
  payload.JobTitle = values.jobTitle.trim();
  payload.BirthDate = values.birthDate;
  payload.Email = values.email.trim();
  payload.Mobile = values.mobile.trim();
  payload.Phone = values.phone.trim();
  payload.Phone2 = values.phone2.trim();
  payload.Fax = values.fax.trim();
  payload.Website = values.website.trim();
  payload.NationalID = values.nationalId.trim();
  payload.PassportNo = values.passportNo.trim();
  payload.Address = values.address.trim();
  payload.DistrictAR = values.districtAR.trim();
  payload.DistrictEN = values.districtEN.trim();
  payload.StreetAR = values.streetAR.trim();
  payload.StreetEN = values.streetEN.trim();
  payload.Country = values.country.trim();
  payload.City = values.city.trim();
  payload.BuildingNumber = values.buildingNumber.trim();
  payload.PostalCode = values.postalCode.trim();
  payload.AccountNo = values.accountNo.trim();
  payload.AccountManagerId = values.accountManagerId;
  payload.SwiftCode = values.swiftCode.trim();
  payload.PayeeBank = values.payeeBank.trim();
  payload.VATRegistrationNumber = values.vatRegistrationNumber.trim();
  payload.GroupVATRegistrationNumber = values.groupVatRegistrationNumber.trim();
  payload.CommercialRegistrationNumber = values.commercialRegistrationNumber.trim();
  payload.TaxFileNumber = values.taxFileNumber.trim();
  payload.ContNameAR = values.contNameAR.trim();
  payload.ContNameEN = values.contNameEN.trim();
  payload.ContAddress = values.contAddress.trim();
  payload.ContMobile = values.contMobile.trim();
  payload.ContEmail = values.contEmail.trim();
  payload.ContPhone = values.contPhone.trim();

  const hasContactPerson = CONTACT_PERSON_FIELDS.some((field) => String(values[field]).trim() !== '');
  if (hasContactPerson) {
    payload.xmlContactPersonGrid = [buildContactPersonRow(values)];
  }

  return payload;
}

function buildContactPersonRow(values: CustomerFormValues): CustomerContactPerson {
  const row: CustomerContactPerson = {};
  if (values.contNameAR.trim()) {
    row['ContNameAR'] = values.contNameAR.trim();
  }
  if (values.contNameEN.trim()) {
    row['ContNameEN'] = values.contNameEN.trim();
  }
  if (values.contAddress.trim()) {
    row['ContAddress'] = values.contAddress.trim();
  }
  if (values.contMobile.trim()) {
    row['ContMobile'] = values.contMobile.trim();
  }
  if (values.contEmail.trim()) {
    row['ContEmail'] = values.contEmail.trim();
  }
  if (values.contPhone.trim()) {
    row['ContPhone'] = values.contPhone.trim();
  }
  return row;
}