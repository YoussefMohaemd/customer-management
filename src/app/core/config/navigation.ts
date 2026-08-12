export interface SidebarNavItem {
  label: string;
  icon: string;
  routerLink: string;
  starred: boolean;
  badge?: string;
  enabled: boolean;
}

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  {
    label: 'Dashboard',
    icon: 'pi-th-large',
    routerLink: '/dashboard',
    starred: false,
    enabled: false,
  },
  {
    label: 'Customer',
    icon: 'pi-users',
    routerLink: '/customers',
    starred: true,
    enabled: true,
  },
  {
    label: 'Potential Request',
    icon: 'pi-inbox',
    routerLink: '/potential-request',
    starred: false,
    enabled: false,
  },
  {
    label: 'Quotation',
    icon: 'pi-file-edit',
    routerLink: '/quotation',
    starred: false,
    enabled: false,
  },
  {
    label: 'Sales Order',
    icon: 'pi-shopping-cart',
    routerLink: '/sales-order',
    starred: false,
    badge: '12',
    enabled: false,
  },
  {
    label: 'Tickets',
    icon: 'pi-ticket',
    routerLink: '/tickets',
    starred: false,
    enabled: false,
  },
];
