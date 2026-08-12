import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { provideRouter } from '@angular/router';
import { MainLayoutComponent } from '@core/layout/main-layout.component';
import { AppSidebarComponent } from '@core/layout/sidebar/app-sidebar.component';
import { AppTopbarComponent } from '@core/layout/topbar/app-topbar.component';
import { MessageService } from 'primeng/api';
import { provideTestConfig } from '@app/testing/test-utils.spec';

describe('MainLayoutComponent', () => {
  let fixture: ComponentFixture<MainLayoutComponent>;
  let component: MainLayoutComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent, AppSidebarComponent, AppTopbarComponent],
      providers: [provideRouter([]), ...provideTestConfig()],
    }).compileComponents();

    fixture = TestBed.createComponent(MainLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the shell', () => {
    expect(component).toBeTruthy();
  });

  it('opens the mobile drawer when the toggle is used below lg breakpoint', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });

    component['onMenuToggle']();
    fixture.detectChanges();

    expect(component['mobileOpen']()).toBe(true);
    expect(fixture.nativeElement.querySelector('.fixed')).toBeTruthy();
  });
});

describe('AppSidebarComponent', () => {
  let fixture: ComponentFixture<AppSidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppSidebarComponent],
      providers: [provideRouter([]), ...provideTestConfig()],
    }).compileComponents();

    fixture = TestBed.createComponent(AppSidebarComponent);
    fixture.componentRef.setInput('collapsed', false);
    fixture.detectChanges();
  });

  it('renders the documented navigation with Customer active', () => {
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Dashboard');
    expect(text).toContain('Customer');
    expect(text).toContain('Potential Request');
    expect(text).toContain('Quotation');
    expect(text).toContain('Sales Order');
    expect(text).toContain('Tickets');

    const links = fixture.nativeElement.querySelectorAll('a');
    const customerLink = Array.from(links).find((link) =>
      (link.textContent ?? '').includes('Customer'),
    ) as HTMLElement;
    expect(customerLink.getAttribute('aria-current')).toBe('page');
  });

  it('shows a toast instead of navigating for disabled modules', () => {
    const messageService = TestBed.inject(MessageService);
    const addSpy = vi.spyOn(messageService, 'add');

    const links = fixture.nativeElement.querySelectorAll('a');
    const dashboard = Array.from(links).find((link) =>
      (link.textContent ?? '').includes('Dashboard'),
    ) as HTMLElement;
    dashboard?.click();

    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'info', summary: 'Module unavailable' }),
    );
  });
});

describe('AppTopbarComponent', () => {
  let fixture: ComponentFixture<AppTopbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppTopbarComponent],
      providers: provideTestConfig(),
    }).compileComponents();

    fixture = TestBed.createComponent(AppTopbarComponent);
    fixture.detectChanges();
  });

  it('renders branding, search, language, notifications and profile', () => {
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Customer Management');
    expect(text).toContain('English');
    expect(fixture.nativeElement.querySelector('button[aria-label="Notifications"]')).toBeTruthy();
    expect(text).toContain('Youssef Ahmed');
  });

  it('emits menuToggle from the hamburger button', () => {
    let toggled = 0;
    fixture.componentInstance['menuToggle'].subscribe(() => (toggled += 1));

    const button = fixture.nativeElement.querySelector('button[aria-label="Toggle navigation menu"]');
    button?.click();

    expect(toggled).toBe(1);
  });

  it('shows a toast from the notifications bell', () => {
    const messageService = TestBed.inject(MessageService);
    const addSpy = vi.spyOn(messageService, 'add');

    const bell = fixture.nativeElement.querySelector('button[aria-label="Notifications"]');
    bell?.click();

    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'info', summary: 'Notifications' }),
    );
  });
});