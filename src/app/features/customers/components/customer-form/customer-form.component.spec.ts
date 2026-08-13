import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { beforeEach, describe, expect, it } from 'vitest';

import { CustomerFormComponent } from '@features/customers/components/customer-form/customer-form.component';
import { CustomerPayload } from '@features/customers/models/customer.model';
import { provideTestConfig } from '@app/testing/test-utils.spec';

describe('CustomerFormComponent', () => {
  let fixture: ComponentFixture<CustomerFormComponent>;
  let component: CustomerFormComponent;

  function form(): FormGroup {
    return component['form'] as FormGroup;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerFormComponent],
      providers: provideTestConfig(),
    }).compileComponents();

    fixture = TestBed.createComponent(CustomerFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the form', () => {
    expect(component).toBeTruthy();
  });

  it('is invalid without a commercial name', () => {
    expect(form().get('commercialName')).toBeTruthy();
    expect(form().invalid).toBe(true);
  });

  it('becomes valid with a commercial name and submit emits a payload once', () => {
    const emitted: CustomerPayload[] = [];
    component['saved'].subscribe((value: CustomerPayload) => emitted.push(value));

    form().patchValue({
      commercialName: '  Acme Corp  ',
      email: 'x@y.com',
      mobile: '+20100100200',
    });
    expect(form().valid).toBe(true);

    component['submit']();
    expect(emitted).toHaveLength(1);
    expect(emitted[0].CommercialName).toBe('Acme Corp');
    expect(emitted[0].Id).toBe(0);
  });

  it('flags invalid fields after a submit attempt', () => {
    component['submit']();

    const name = form().get('commercialName');
    expect(name?.touched).toBe(true);
  });

  it('pre-fills an edit customer and preserves its id on submit', () => {
    const emitted: CustomerPayload[] = [];
    component['saved'].subscribe((value: CustomerPayload) => emitted.push(value));

    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initial', {
      id: 18813,
      code: '5-55',
      commercialName: 'Existing Co',
      email: 'old@x.com',
      mobile: '+971 222222',
      nameAr: 'شركة',
      nameEn: '',
      phone: '',
      phone2: '',
      fax: '',
      website: '',
      jobTitle: '',
      address: '',
      city: 'Abu Dhabi',
      cityId: 2779,
      country: 'United Arab Emirates',
      countryId: 2799,
      accountTypeId: null,
      accountTypeName: '',
      clientType: '',
      accountManagerId: null,
      accountManagerName: '',
      classificationId: null,
      classificationName: '',
      businessFieldId: null,
      businessFieldName: '',
      regionName: '',
      birthDate: null,
      registrationDate: null,
      createdDate: null,
      status: null,
      gender: null,
      comment: '',
      taxFileNumber: '',
      commercialRegistrationNumber: '',
      vatRegistrationNumber: '',
    });
    fixture.detectChanges();

    expect(form().get('commercialName')?.value).toBe('Existing Co');
    expect(form().get('email')?.value).toBe('old@x.com');
    expect(form().get('nameAR')?.value).toBe('شركة');

    component['submit']();
    expect(emitted).toHaveLength(1);
    expect(emitted[0].Id).toBe(18813);
  });

  it('does not emit in view mode', () => {
    let emitted = false;
    component['saved'].subscribe(() => (emitted = true));

    fixture.componentRef.setInput('mode', 'view');
    fixture.detectChanges();
    component['submit']();

    expect(emitted).toBe(false);
  });
});