import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CustomerActionsMenuComponent } from '@features/customers/components/customer-actions-menu/customer-actions-menu.component';
import { customerFixture, provideTestConfig } from '@app/testing/test-utils.spec';

const ALL_LABELS = [
  'View',
  'Change Status',
  'Sales Order',
  'NFC',
  'Contacts',
  'Edit',
  'Location',
  'Follow-Up',
  'Add Potential',
  'Delete',
  'Attachment',
  'Log',
  'Potential',
];

const ALL_ICONS = [
  'pi-eye',
  'pi-sync',
  'pi-shopping-cart',
  'pi-mobile',
  'pi-phone',
  'pi-pencil',
  'pi-map-marker',
  'pi-link',
  'pi-user-plus',
  'pi-trash',
  'pi-paperclip',
  'pi-clock',
  'pi-users',
];

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('CustomerActionsMenuComponent', () => {
  let fixture: ComponentFixture<CustomerActionsMenuComponent>;
  let component: CustomerActionsMenuComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerActionsMenuComponent],
      providers: provideTestConfig(),
    }).compileComponents();

    fixture = TestBed.createComponent(CustomerActionsMenuComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('customer', customerFixture({ id: 42, commercialName: 'Acme' }));
    fixture.detectChanges();
  });

  async function openMenu(): Promise<void> {
    const trigger = fixture.nativeElement.querySelector('.action-trigger') as HTMLButtonElement;
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();
  }

  it('creates the menu', () => {
    expect(component).toBeTruthy();
  });

  it('builds the reference three-column action layout', () => {
    const columns = component['actionColumns']();
    expect(columns.map((column) => column.length)).toEqual([5, 4, 4]);
    expect(columns.flat().map((item) => item.label)).toEqual(ALL_LABELS);
    expect(columns.flat().map((item) => item.icon)).toEqual(ALL_ICONS);
    expect(columns.flat().every((item) => item.color)).toBe(true);
  });

  it('wires View, Edit and Delete to their callbacks and keeps the rest static', () => {
    const view = vi.fn();
    const edit = vi.fn();
    const deleteFn = vi.fn();
    fixture.componentRef.setInput('onView', view);
    fixture.componentRef.setInput('onEdit', edit);
    fixture.componentRef.setInput('onDelete', deleteFn);
    fixture.detectChanges();

    const items = component['actionColumns']().flat();
    items.find((item) => item.label === 'Edit')?.handler?.(customerFixture({ id: 42 }));

    expect(edit).toHaveBeenCalledOnce();
    expect(edit).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }));
    expect(items.find((item) => item.label === 'View')?.handler).toBeDefined();
    expect(items.find((item) => item.label === 'Delete')?.handler).toBeDefined();
    expect(items.find((item) => item.label === 'Change Status')?.handler).toBeUndefined();
    expect(items.find((item) => item.label === 'Contacts')?.handler).toBeUndefined();
  });

  it('renders every action as a menu item, including static ones', async () => {
    await openMenu();

    const items = Array.from(
      fixture.nativeElement.querySelectorAll('.actions-popup__item'),
    ) as HTMLElement[];
    expect(items.map((item) => item.textContent?.trim())).toEqual(ALL_LABELS);

    const changeStatus = items.find((item) => item.textContent?.trim() === 'Change Status');
    expect(changeStatus).toBeTruthy();
    expect(changeStatus?.querySelector('.pi-sync')).toBeTruthy();
    expect(changeStatus?.querySelector('.pi-eye')).toBeNull();

    const contacts = items.find((item) => item.textContent?.trim() === 'Contacts');
    expect(contacts?.querySelector('.pi-phone')).toBeTruthy();
    expect(contacts?.querySelector('.pi-phone')?.getAttribute('style')).toContain(
      'rgb(139, 92, 246)',
    );
  });

  it('toggles open/closed and flips the chevron', async () => {
    const trigger = fixture.nativeElement.querySelector('.action-trigger') as HTMLButtonElement;
    const caret = trigger.querySelector('.action-caret') as HTMLElement;

    expect(caret.classList.contains('pi-chevron-down')).toBe(true);
    expect(fixture.nativeElement.querySelector('.actions-popup')).toBeNull();

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(component['isOpen']()).toBe(true);
    expect(caret.classList.contains('pi-chevron-up')).toBe(true);
    expect(fixture.nativeElement.querySelector('.actions-popup')).toBeTruthy();
    await tick();
    fixture.detectChanges();

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(component['isOpen']()).toBe(false);
    expect(caret.classList.contains('pi-chevron-down')).toBe(true);
    expect(fixture.nativeElement.querySelector('.actions-popup')).toBeNull();
  });

  it('closes after running a wired action', async () => {
    const edit = vi.fn();
    fixture.componentRef.setInput('onEdit', edit);
    fixture.detectChanges();
    await openMenu();

    const item = Array.from(fixture.nativeElement.querySelectorAll('.actions-popup__item')).find(
      (el) => (el as HTMLElement).textContent?.trim() === 'Edit',
    ) as HTMLButtonElement;
    item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(component['isOpen']()).toBe(false);
    expect(edit).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }));
  });

  it('closes when clicking a static action', async () => {
    await openMenu();

    const item = Array.from(fixture.nativeElement.querySelectorAll('.actions-popup__item')).find(
      (el) => (el as HTMLElement).textContent?.trim() === 'Change Status',
    ) as HTMLButtonElement;
    item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(component['isOpen']()).toBe(false);
  });

  it('closes when clicking outside the menu', async () => {
    await openMenu();

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(component['isOpen']()).toBe(false);
  });

  it('closes on Escape', async () => {
    await openMenu();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(component['isOpen']()).toBe(false);
  });

  it('keeps only one menu open across rows', async () => {
    const fixtureB = TestBed.createComponent(CustomerActionsMenuComponent);
    fixtureB.componentRef.setInput('customer', customerFixture({ id: 7, commercialName: 'Beta' }));
    fixtureB.detectChanges();
    const componentB = fixtureB.componentInstance;

    await openMenu();
    expect(component['isOpen']()).toBe(true);

    const triggerB = fixtureB.nativeElement.querySelector('.action-trigger') as HTMLButtonElement;
    triggerB.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixtureB.detectChanges();
    await tick();
    fixture.detectChanges();
    fixtureB.detectChanges();

    expect(component['isOpen']()).toBe(false);
    expect(componentB['isOpen']()).toBe(true);
  });

  it('positions the popup below the trigger within the viewport', async () => {
    await openMenu();

    const rect = (
      fixture.nativeElement.querySelector('.actions-popup') as HTMLElement
    ).getBoundingClientRect();
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.left).toBeGreaterThanOrEqual(0);
  });
});
