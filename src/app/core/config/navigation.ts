export interface SidebarNavItem {
  label: string;
  icon: string;
  routerLink: string;
  active: boolean;
  starred: boolean;
  badge?: string;
  enabled: boolean;
}

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  {
    label: 'Dashboard',
    icon: 'pi-th-large',
    routerLink: '/dashboard',
    active: false,
    starred: false,
    enabled: false,
  },
  {
    label: 'Customer',
    icon: 'pi-users',
    routerLink: '/customers',
    active: true,
    starred: true,
    enabled: true,
  },
  {
    label: 'Potential Request',
    icon: 'pi-inbox',
    routerLink: '/potential-request',
    active: false,
    starred: false,
    enabled: false,
  },
  {
    label: 'Quotation',
    icon: 'pi-file-edit',
    routerLink: '/quotation',
    active: false,
    starred: false,
    enabled: false,
  },
  {
    label: 'Sales Order',
    icon: 'pi-shopping-cart',
    routerLink: '/sales-order',
    active: false,
    starred: false,
    badge: '12',
    enabled: false,
  },
  {
    label: 'Tickets',
    icon: 'pi-ticket',
    routerLink: '/tickets',
    active: false,
    starred: false,
    enabled: false,
  },
];
