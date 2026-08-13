import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';

import { CustomerRecord } from '@features/customers/models/customer.model';

interface ActionsMenuItem {
  label: string;
  icon: string;
  color: string;
  handler?: (customer: CustomerRecord) => void;
}

/**
 * Row-level "Actions" popup reconstructed as a compact three-column floating
 * card matching the assessment reference. Entries without backend support are
 * still rendered so the popup keeps its exact reference layout.
 *
 * Toggle behavior is fully self-contained: a single document click listener is
 * attached only while a popup is open, so opening another row's menu closes the
 * previous one automatically and only one menu can be open at a time.
 */
@Component({
  selector: 'app-customer-actions-menu',
  templateUrl: './customer-actions-menu.component.html',
  styleUrl: './customer-actions-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerActionsMenuComponent implements OnDestroy {
  readonly customer = input.required<CustomerRecord>();
  readonly onView = input<(customer: CustomerRecord) => void>(() => undefined);
  readonly onEdit = input<(customer: CustomerRecord) => void>(() => undefined);
  readonly onDelete = input<(customer: CustomerRecord) => void>(() => undefined);

  /** Reflects whether this row's popup is currently visible. */
  protected readonly isOpen = signal(false);

  protected readonly popupPosition = signal({ top: 0, left: 0 });

  protected readonly actionColumns = computed<ActionsMenuItem[][]>(() => {
    const view = this.onView();
    const edit = this.onEdit();
    const del = this.onDelete();
    return [
      [
        { label: 'View', icon: 'pi-eye', color: '#f4b400', handler: (c) => view(c) },
        { label: 'Change Status', icon: 'pi-sync', color: '#3b82f6' },
        { label: 'Sales Order', icon: 'pi-shopping-cart', color: '#14b8a6' },
        { label: 'NFC', icon: 'pi-mobile', color: '#ec4899' },
        { label: 'Contacts', icon: 'pi-phone', color: '#8b5cf6' },
      ],
      [
        { label: 'Edit', icon: 'pi-pencil', color: '#22c55e', handler: (c) => edit(c) },
        { label: 'Location', icon: 'pi-map-marker', color: '#22c55e' },
        { label: 'Follow-Up', icon: 'pi-link', color: '#f59e0b' },
        { label: 'Add Potential', icon: 'pi-user-plus', color: '#a855f7' },
      ],
      [
        { label: 'Delete', icon: 'pi-trash', color: '#ef4444', handler: (c) => del(c) },
        { label: 'Attachment', icon: 'pi-paperclip', color: '#a855f7' },
        { label: 'Log', icon: 'pi-clock', color: '#84cc16' },
        { label: 'Potential', icon: 'pi-users', color: '#14b8a6' },
      ],
    ];
  });

  private readonly host = inject(ElementRef<HTMLElement>);

  private anchorRect: DOMRect | null = null;

  private readonly documentClick = (event: MouseEvent): void => {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.closeMenu();
    }
  };

  private readonly scrollClose = (): void => this.closeMenu();

  private readonly resizeReposition = (): void => this.reposition();

  private readonly keyEscape = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.closeMenu();
    }
  };

  protected toggle(): void {
    if (this.isOpen()) {
      this.closeMenu();
      return;
    }
    const trigger = this.host.nativeElement.querySelector('.action-trigger') as HTMLElement | null;
    this.anchorRect = trigger?.getBoundingClientRect() ?? null;
    this.isOpen.set(true);
    document.addEventListener('click', this.documentClick);
    document.addEventListener('scroll', this.scrollClose, true);
    window.addEventListener('resize', this.resizeReposition);
    document.addEventListener('keydown', this.keyEscape);
    window.setTimeout(() => this.reposition(), 0);
  }

  protected runAction(item: ActionsMenuItem): void {
    item.handler?.(this.customer());
    this.closeMenu();
  }

  private closeMenu(): void {
    this.isOpen.set(false);
    document.removeEventListener('click', this.documentClick);
    document.removeEventListener('scroll', this.scrollClose, true);
    window.removeEventListener('resize', this.resizeReposition);
    document.removeEventListener('keydown', this.keyEscape);
  }

  private reposition(): void {
    if (!this.isOpen() || !this.anchorRect) {
      return;
    }
    const popup = this.host.nativeElement.querySelector('.actions-popup') as HTMLElement | null;
    if (!popup) {
      return;
    }
    const rect = popup.getBoundingClientRect();
    const gutter = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = Math.min(window.innerHeight, document.documentElement.clientHeight);

    let left = Math.min(this.anchorRect.left, viewportWidth - rect.width - gutter);
    left = Math.max(gutter, left);
    let top = this.anchorRect.bottom + 4;
    if (top + rect.height > viewportHeight - gutter) {
      top = Math.max(gutter, this.anchorRect.top - rect.height - 4);
    }
    this.popupPosition.set({ top, left });
  }

  ngOnDestroy(): void {
    this.closeMenu();
  }
}
