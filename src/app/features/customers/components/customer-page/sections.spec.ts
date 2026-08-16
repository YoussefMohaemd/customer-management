import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CustomerActionsComponent } from '@features/customers/components/customer-actions/customer-actions.component';
import { CustomerReportsComponent } from '@features/customers/components/customer-reports/customer-reports.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { provideTestConfig } from '@app/testing/test-utils.spec';

describe('CustomerActionsComponent', () => {
  let fixture: ComponentFixture<CustomerActionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerActionsComponent],
      providers: provideTestConfig(),
    }).compileComponents();
    fixture = TestBed.createComponent(CustomerActionsComponent);
    fixture.detectChanges();
  });

  it('renders the three action cards from the reference', () => {
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Collective Reassign');
    expect(text).toContain('Customer Follow Up');
    expect(text).toContain('Upload Bulk');
  });

  it('opens a toast when a card is clicked', () => {
    const messageService = TestBed.inject(MessageService);
    const addSpy = vi.spyOn(messageService, 'add');

    const button = fixture.nativeElement.querySelectorAll('button')[0];
    button?.click();

    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({ summary: 'Collective Reassign' }),
    );
  });
});

describe('CustomerReportsComponent', () => {
  let fixture: ComponentFixture<CustomerReportsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerReportsComponent],
      providers: provideTestConfig(),
    }).compileComponents();
    fixture = TestBed.createComponent(CustomerReportsComponent);
    fixture.detectChanges();
  });

  it('renders the three report cards from the reference', () => {
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Contacts Report');
    expect(text).toContain('Customer Report');
    expect(text).toContain('Account Follow Up Report');
  });

  it('opens a toast when a report is clicked', () => {
    const messageService = TestBed.inject(MessageService);
    const addSpy = vi.spyOn(messageService, 'add');

    const button = fixture.nativeElement.querySelectorAll('button')[0];
    button?.click();

    expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ summary: 'Contacts Report' }));
  });
});

describe('EmptyStateComponent', () => {
  let fixture: ComponentFixture<EmptyStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent],
      providers: provideTestConfig(),
    }).compileComponents();
    fixture = TestBed.createComponent(EmptyStateComponent);
  });

  it('renders title and description and emits the action', () => {
    fixture.componentRef.setInput('title', 'No customers');
    fixture.componentRef.setInput('description', 'Try again later');
    fixture.componentRef.setInput('actionLabel', 'Retry');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No customers');
    expect(fixture.nativeElement.textContent).toContain('Try again later');

    let acted = 0;
    fixture.componentInstance['action'].subscribe(() => (acted += 1));
    const button = fixture.nativeElement.querySelector('button');
    button?.click();

    expect(acted).toBe(1);
  });

  it('hides the action entirely when requested', () => {
    fixture.componentRef.setInput('actionLabel', 'Retry');
    fixture.componentRef.setInput('actionHidden', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
