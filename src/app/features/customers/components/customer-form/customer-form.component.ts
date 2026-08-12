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
  template: `
    <form [formGroup]="form" class="flex flex-col" (ngSubmit)="submit()" novalidate>
      <!-- Error summary -->
      @if (store.saveError()) {
        <div
          class="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          <i class="pi pi-exclamation-circle mt-0.5" aria-hidden="true"></i>
          <div>
            <div class="font-semibold">Save failed</div>
            <div class="text-red-600">{{ store.saveError() }}</div>
          </div>
        </div>
      }

      @for (section of sections; track section.title) {
        <div class="mb-6 last:mb-0">
          <div class="mb-3 flex items-center gap-2">
            <div
              class="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-600"
              aria-hidden="true"
            >
              <i [class]="section.icon" class="pi text-xs"></i>
            </div>
            <h3 class="text-sm font-bold text-slate-800">{{ section.title }}</h3>
            <div class="ml-2 h-px flex-1 bg-slate-100"></div>
          </div>

          <div class="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
            @for (field of section.fields; track field.label) {
              <div [class]="field.span ?? ''">
                <label
                  [for]="'customer-' + field.control"
                  class="mb-1 block text-xs font-semibold text-slate-600"
                >
                  {{ field.label }}
                  @if (isRequired(field.control)) {
                    <span class="text-red-500" aria-hidden="true">*</span>
                    <span class="sr-only">(required)</span>
                  }
                </label>
                @switch (inputKind(field.control)) {
                  @case ('date') {
                    <p-datepicker
                      [id]="'customer-' + field.control"
                      formControlName="{{ field.control }}"
                      dateFormat="dd/mm/yy"
                      [showIcon]="true"
                      [iconDisplay]="'input'"
                      [showButtonBar]="true"
                      [readonlyInput]="true"
                      [maxDate]="today"
                      styleClass="w-full"
                      [disabled]="isViewMode()"
                    />
                  }
                  @case ('select') {
                    <p-select
                      [id]="'customer-' + field.control"
                      formControlName="{{ field.control }}"
                      [options]="store.accountManagerOptions()"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="Select account manager"
                      [showClear]="true"
                      class="w-full"
                      [disabled]="isViewMode()"
                    />
                  }
                  @case ('textarea') {
                    <textarea
                      pTextarea
                      [id]="'customer-' + field.control"
                      formControlName="{{ field.control }}"
                      rows="2"
                      class="w-full resize-none"
                      [readonly]="isViewMode()"
                    ></textarea>
                  }
                  @default {
                    <input
                      pInputText
                      [id]="'customer-' + field.control"
                      formControlName="{{ field.control }}"
                      [class.p-invalid]="isInvalid(field.control)"
                      class="w-full"
                      [readonly]="isViewMode()"
                      [type]="inputType(field.control)"
                    />
                  }
                }
                @if (isInvalid(field.control)) {
                  <small class="mt-1 block text-xs text-red-500">{{
                    errorMessage(field.control)
                  }}</small>
                }
              </div>
            }
          </div>
        </div>
      }

      <!-- Footer actions -->
      <div class="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
        @if (!isViewMode()) {
          <span class="mr-auto text-xs text-slate-400">* Required fields</span>
        }
        <p-button label="Cancel" [text]="true" severity="secondary" (onClick)="cancelled.emit()" />
        @switch (mode()) {
          @case ('create') {
            <p-button
              label="Save Customer"
              icon="pi pi-check"
              [loading]="store.saving()"
              [disabled]="store.saving()"
              (onClick)="submit()"
            />
          }
          @case ('edit') {
            <p-button
              label="Update Customer"
              icon="pi pi-check"
              [loading]="store.saving()"
              [disabled]="store.saving()"
              (onClick)="submit()"
            />
          }
          @case ('view') {
            <p-button label="Close" (onClick)="cancelled.emit()" />
          }
        }
      </div>
    </form>
  `,
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
    if (control === 'nationalId') {
      return 'text';
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
