import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';

import { CustomerPayload, CustomerRecord } from '@features/customers/models/customer.model';
import {
  CustomerFormValues,
  toCustomerPayload,
} from '@features/customers/models/customer-form.model';
import { CustomerStore } from '@features/customers/state/customer.store';

export type CustomerFormMode = 'create' | 'edit' | 'view';

/** Validator helpers (kept small and shared). */
const PHONE_PATTERN = /^[+0-9][0-9 .\-()]{5,19}$/;
const SWIFT_PATTERN = /^[A-Z0-9]{8,11}$/;
const NATIONAL_ID_PATTERN = /^[0-9]{8,20}$/;

interface Section {
  title: string;
  icon: string;
  fields: { label: string; control: string; span?: string }[];
}

/**
 * Reusable create/edit/view customer form.
 *
 * - Reactive Forms with typed controls and meaningful validation.
 * - Never submits directly: emits `saved` with the final payload; the dialog
 *   layer owns success/error feedback and closing.
 * - `view` mode renders the same structure read-only.
 */
@Component({
  selector: 'app-customer-form',
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    DatePickerModule,
    SelectModule,
    TextareaModule,
    ButtonModule,
    DividerModule,
  ],
  templateUrl: './customer-form.component.html',
  styleUrl: './customer-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerFormComponent {
  readonly mode = input<CustomerFormMode>('create');
  readonly initial = input<CustomerRecord | null>(null);
  readonly saved = output<CustomerPayload>();
  readonly cancelled = output<void>();

  protected readonly store = inject(CustomerStore);
  protected readonly today = new Date();

  protected readonly form = new FormGroup({
    code: new FormControl('', [Validators.maxLength(50)]),
    commercialName: new FormControl('', [Validators.required, Validators.maxLength(200)]),
    nameAR: new FormControl('', [Validators.maxLength(100)]),
    nameEN: new FormControl('', [Validators.maxLength(100)]),
    nameFR: new FormControl('', [Validators.maxLength(100)]),
    jobTitle: new FormControl('', [Validators.maxLength(100)]),
    birthDate: new FormControl<Date | null>(null),
    email: new FormControl('', [Validators.email, Validators.maxLength(150)]),
    mobile: new FormControl('', [Validators.pattern(PHONE_PATTERN), Validators.maxLength(20)]),
    phone: new FormControl('', [Validators.pattern(PHONE_PATTERN), Validators.maxLength(20)]),
    phone2: new FormControl('', [Validators.pattern(PHONE_PATTERN), Validators.maxLength(20)]),
    fax: new FormControl('', [Validators.maxLength(20)]),
    website: new FormControl('', [Validators.maxLength(200), webValidator]),
    nationalId: new FormControl('', [Validators.pattern(NATIONAL_ID_PATTERN)]),
    passportNo: new FormControl('', [Validators.minLength(3), Validators.maxLength(20)]),
    address: new FormControl('', [Validators.maxLength(300)]),
    districtAR: new FormControl('', [Validators.maxLength(150)]),
    districtEN: new FormControl('', [Validators.maxLength(150)]),
    streetAR: new FormControl('', [Validators.maxLength(150)]),
    streetEN: new FormControl('', [Validators.maxLength(150)]),
    country: new FormControl('', [Validators.maxLength(100)]),
    city: new FormControl('', [Validators.maxLength(100)]),
    buildingNumber: new FormControl('', [Validators.maxLength(20)]),
    postalCode: new FormControl('', [Validators.maxLength(20)]),
    accountNo: new FormControl('', [Validators.maxLength(50)]),
    accountManagerId: new FormControl<number | null>(null),
    swiftCode: new FormControl('', [Validators.pattern(SWIFT_PATTERN)]),
    payeeBank: new FormControl('', [Validators.maxLength(200)]),
    vatRegistrationNumber: new FormControl('', [Validators.minLength(8), Validators.maxLength(20)]),
    groupVatRegistrationNumber: new FormControl('', [
      Validators.minLength(8),
      Validators.maxLength(20),
    ]),
    commercialRegistrationNumber: new FormControl('', [Validators.maxLength(50)]),
    taxFileNumber: new FormControl('', [Validators.maxLength(50)]),
    contNameAR: new FormControl('', [Validators.maxLength(100)]),
    contNameEN: new FormControl('', [Validators.maxLength(100)]),
    contAddress: new FormControl('', [Validators.maxLength(300)]),
    contMobile: new FormControl('', [Validators.pattern(PHONE_PATTERN), Validators.maxLength(20)]),
    contEmail: new FormControl('', [Validators.email, Validators.maxLength(150)]),
    contPhone: new FormControl('', [Validators.pattern(PHONE_PATTERN), Validators.maxLength(20)]),
  });

  protected readonly sections = this.buildSections();

  /** Resets or pre-fills the form whenever the target customer changes. */
  private readonly prefill = effect(() => {
    const customer = this.initial();
    this.form.reset();
    if (customer) {
      this.patchFromCustomer(customer);
    }
  });

  private patchFromCustomer(customer: CustomerRecord): void {
    this.form.patchValue({
      code: customer.code,
      commercialName: customer.commercialName,
      nameAR: customer.nameAr,
      nameEN: customer.nameEn,
      email: customer.email,
      mobile: customer.mobile,
      phone: customer.phone,
      phone2: customer.phone2,
      fax: customer.fax,
      jobTitle: customer.jobTitle,
      birthDate: customer.birthDate ? new Date(customer.birthDate) : null,
      address: customer.address,
      country: customer.country,
      city: customer.city,
      accountManagerId: customer.accountManagerId,
      vatRegistrationNumber: customer.vatRegistrationNumber,
      commercialRegistrationNumber: customer.commercialRegistrationNumber,
      taxFileNumber: customer.taxFileNumber,
    });
  }

  protected isViewMode(): boolean {
    return this.mode() === 'view';
  }

  protected submit(): void {
    if (this.isViewMode() || this.store.saving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const values = this.toFormValues();
    const existingId = this.mode() === 'edit' ? (this.initial()?.id ?? 0) : 0;
    this.saved.emit(toCustomerPayload(values, existingId));
  }

  private toFormValues(): CustomerFormValues {
    const raw = this.form.getRawValue();
    return {
      code: raw.code ?? '',
      commercialName: raw.commercialName ?? '',
      nameAR: raw.nameAR ?? '',
      nameEN: raw.nameEN ?? '',
      nameFR: raw.nameFR ?? '',
      jobTitle: raw.jobTitle ?? '',
      birthDate: raw.birthDate instanceof Date ? toIsoDate(raw.birthDate) : null,
      email: raw.email ?? '',
      mobile: raw.mobile ?? '',
      phone: raw.phone ?? '',
      phone2: raw.phone2 ?? '',
      fax: raw.fax ?? '',
      website: raw.website ?? '',
      nationalId: raw.nationalId ?? '',
      passportNo: raw.passportNo ?? '',
      address: raw.address ?? '',
      districtAR: raw.districtAR ?? '',
      districtEN: raw.districtEN ?? '',
      streetAR: raw.streetAR ?? '',
      streetEN: raw.streetEN ?? '',
      country: raw.country ?? '',
      city: raw.city ?? '',
      buildingNumber: raw.buildingNumber ?? '',
      postalCode: raw.postalCode ?? '',
      accountNo: raw.accountNo ?? '',
      accountManagerId: raw.accountManagerId ?? null,
      swiftCode: raw.swiftCode ?? '',
      payeeBank: raw.payeeBank ?? '',
      vatRegistrationNumber: raw.vatRegistrationNumber ?? '',
      groupVatRegistrationNumber: raw.groupVatRegistrationNumber ?? '',
      commercialRegistrationNumber: raw.commercialRegistrationNumber ?? '',
      taxFileNumber: raw.taxFileNumber ?? '',
      contNameAR: raw.contNameAR ?? '',
      contNameEN: raw.contNameEN ?? '',
      contAddress: raw.contAddress ?? '',
      contMobile: raw.contMobile ?? '',
      contEmail: raw.contEmail ?? '',
      contPhone: raw.contPhone ?? '',
    };
  }

  protected isRequired(control: string): boolean {
    return this.form.get(control)?.hasValidator(Validators.required) ?? false;
  }

  protected isInvalid(control: string): boolean {
    const field = this.form.get(control);
    return field !== null && field.invalid && (field.touched || field.dirty);
  }

  protected errorMessage(control: string): string {
    const field = this.form.get(control);
    if (!field) {
      return '';
    }
    if (field.errors?.['required']) {
      return 'This field is required.';
    }
    if (field.errors?.['email']) {
      return 'Enter a valid email address.';
    }
    if (field.errors?.['pattern']) {
      return 'Enter a valid value for this field.';
    }
    if (field.errors?.['minlength']) {
      return `Minimum ${field.errors['minlength'].requiredLength} characters.`;
    }
    if (field.errors?.['maxlength']) {
      return `Maximum ${field.errors['maxlength'].requiredLength} characters.`;
    }
    if (field.errors?.['invalidWebsite']) {
      return 'Enter a valid URL (e.g. https://example.com).';
    }
    return 'Invalid value.';
  }

  protected inputKind(control: string): 'date' | 'select' | 'textarea' | 'text' {
    if (control === 'birthDate') {
      return 'date';
    }
    if (control === 'accountManagerId') {
      return 'select';
    }
    if (control === 'address' || control === 'contAddress') {
      return 'textarea';
    }
    return 'text';
  }

  protected inputType(control: string): string {
    if (control === 'email' || control === 'contEmail') {
      return 'email';
    }
    if (control === 'website') {
      return 'url';
    }
    return 'text';
  }

  private buildSections(): Section[] {
    return [
      {
        title: 'Basic Information',
        icon: 'pi-id-card',
        fields: [
          { label: 'Code', control: 'code' },
          { label: 'Commercial Name', control: 'commercialName' },
          { label: 'Legal Arabic Name', control: 'nameAR' },
          { label: 'Legal English Name', control: 'nameEN' },
          { label: 'Legal French Name', control: 'nameFR' },
          { label: 'Job Title', control: 'jobTitle' },
          { label: 'Birth Date', control: 'birthDate' },
        ],
      },
      {
        title: 'Contact Information',
        icon: 'pi-phone',
        fields: [
          { label: 'Email', control: 'email' },
          { label: 'Mobile', control: 'mobile' },
          { label: 'Phone', control: 'phone' },
          { label: 'Phone 2', control: 'phone2' },
          { label: 'Fax', control: 'fax' },
          { label: 'Website', control: 'website' },
        ],
      },
      {
        title: 'Identity',
        icon: 'pi-shield',
        fields: [
          { label: 'National ID', control: 'nationalId' },
          { label: 'Passport Number', control: 'passportNo' },
        ],
      },
      {
        title: 'Address',
        icon: 'pi-map-marker',
        fields: [
          { label: 'Address', control: 'address', span: 'md:col-span-2 xl:col-span-4' },
          { label: 'District (Arabic)', control: 'districtAR' },
          { label: 'District (English)', control: 'districtEN' },
          { label: 'Street (Arabic)', control: 'streetAR' },
          { label: 'Street (English)', control: 'streetEN' },
          { label: 'Country', control: 'country' },
          { label: 'City', control: 'city' },
          { label: 'Building Number', control: 'buildingNumber' },
          { label: 'Postal Code', control: 'postalCode' },
        ],
      },
      {
        title: 'Business / Financial',
        icon: 'pi-wallet',
        fields: [
          { label: 'Main Account Number', control: 'accountNo' },
          { label: 'Account Manager', control: 'accountManagerId' },
          { label: 'VAT Registration Number', control: 'vatRegistrationNumber' },
          { label: 'Group VAT Registration Number', control: 'groupVatRegistrationNumber' },
          { label: 'Payee Bank', control: 'payeeBank' },
          { label: 'Swift Number', control: 'swiftCode' },
          { label: 'Commercial Registration Number', control: 'commercialRegistrationNumber' },
          { label: 'Tax File Number', control: 'taxFileNumber' },
        ],
      },
      {
        title: 'Contact Person',
        icon: 'pi-address-book',
        fields: [
          { label: 'Contact Name (Arabic)', control: 'contNameAR' },
          { label: 'Contact Name (English)', control: 'contNameEN' },
          { label: 'Contact Address', control: 'contAddress', span: 'md:col-span-2 xl:col-span-2' },
          { label: 'Contact Mobile', control: 'contMobile' },
          { label: 'Contact Email', control: 'contEmail' },
          { label: 'Contact Phone', control: 'contPhone' },
        ],
      },
    ];
  }
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function webValidator(control: AbstractControl<string | null>): Record<string, boolean> | null {
  const value = (control.value ?? '').trim();
  if (!value) {
    return null;
  }
  const isUrl = /^https?:\/\/[^\s]+$/.test(value);
  return isUrl ? null : { invalidWebsite: true };
}