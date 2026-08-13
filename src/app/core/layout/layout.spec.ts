import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { MainLayoutComponent } from '@core/layout/main-layout.component';
import { AppSidebarComponent } from '@core/layout/sidebar/app-sidebar.component';
import { AppTopbarComponent } from '@core/layout/topbar/app-topbar.component';
import { MessageService } from 'primeng/api';
import { provideTestConfig } from '@app/testing/test-utils.spec';

@Component({ template: '' })
class StubRouteComponent {}

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

  it('opens the mobile drawer when the toggle is used', () => {
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
      providers: [
        provideRouter([
          { path: 'customers', component: StubRouteComponent },
          { path: 'dashboard', component: StubRouteComponent },
        ]),
        ...provideTestConfig(),
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    fixture = TestBed.createComponent(AppSidebarComponent);
    fixture.componentRef.setInput('collapsed', false);
    fixture.detectChanges();
    await router.navigateByUrl('/customers');
    fixture.detectChanges();
  });

  it('renders the documented navigation with the current route active', () => {
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Dashboard');
    expect(text).toContain('Customer');
    expect(text).toContain('Potential Request');
    expect(text).toContain('Quotation');
    expect(text).toContain('Sales Order');
    expect(text).toContain('Tickets');

    const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLElement[];
    const customerLink = links.find((link) =>
      (link.textContent ?? '').includes('Customer'),
    ) as HTMLElement;
    expect(customerLink.getAttribute('aria-current')).toBe('page');
    expect(customerLink.className).toContain('text-sky-400');
  });

  it('clears the active state when navigating away from the route', async () => {
    const router = TestBed.inject(Router);

    const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLElement[];
    const customerLink = links.find((link) =>
      (link.textContent ?? '').includes('Customer'),
    ) as HTMLElement;
    const dashboardLink = links.find((link) =>
      (link.textContent ?? '').includes('Dashboard'),
    ) as HTMLElement;

    expect(customerLink.getAttribute('aria-current')).toBe('page');
    expect(dashboardLink.getAttribute('aria-current')).toBeNull();

    await router.navigateByUrl('/dashboard');
    fixture.detectChanges();

    expect(customerLink.getAttribute('aria-current')).toBeNull();
  });

  it('emits collapseToggle from the desktop collapse arrow', () => {
    let toggled = 0;
    fixture.componentInstance['collapseToggle'].subscribe(() => (toggled += 1));

    const arrow = fixture.nativeElement.querySelector('button[aria-label="Collapse sidebar"]');
    arrow?.click();
    fixture.detectChanges();

    expect(toggled).toBe(1);
  });

  it('shows a toast instead of navigating for disabled modules', () => {
    const messageService = TestBed.inject(MessageService);
    const addSpy = vi.spyOn(messageService, 'add');

    const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLElement[];
    const dashboard = links.find((link) =>
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
    expect(text).toContain('Hello Youssef');
    expect(fixture.nativeElement.querySelector('button[aria-label="Notifications"]')).toBeTruthy();
    expect(text).toContain('Youssef Ahmed');
  });

  it('emits menuToggle from the hamburger button', () => {
    let toggled = 0;
    fixture.componentInstance['menuToggle'].subscribe(() => (toggled += 1));

    const button = fixture.nativeElement.querySelector(
      'button[aria-label="Toggle navigation menu"]',
    );
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
