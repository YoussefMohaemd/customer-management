import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { PopoverModule } from 'primeng/popover';

import { CustomerFieldKey } from '@features/customers/models/customer-column.model';
import { CustomerStore } from '@features/customers/state/customer.store';

interface StripDragState {
  pointerId: number;
  startX: number;
  startScrollLeft: number;
}

/**
 * Column selector (far right of the toolbar).
 *
 * Selected columns are rendered inline as compact removable chips (label +
 * ×) inside a single horizontally scrollable strip. The strip can be
 * scrolled with the mouse wheel/trackpad and by click-and-drag panning
 * (press anywhere in the middle of the strip and drag left/right). The
 * trailing arrow opens the dropdown listing every API-returned field with
 * a compact client-side search; selecting a field immediately shows the
 * matching table column and keeps the filter panel in sync (both are
 * derived from the store's selected column metadata — no page reload is
 * involved). At least one column must remain visible.
 */
@Component({
  selector: 'app-customer-column-picker',
  imports: [PopoverModule],
  templateUrl: './customer-column-picker.component.html',
  styleUrl: './customer-column-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerColumnPickerComponent implements AfterViewInit, OnDestroy {
  protected readonly store = inject(CustomerStore);

  protected popoverOpen = false;

  /** Dropdown field-search term (client-side only, never hits the API). */
  protected readonly searchTerm = signal('');
  /** Field the search ✓ button will select (first result by default). */
  protected readonly activeField = signal<CustomerFieldKey | null>(null);

  /** Every API field matching the search term, in catalog order. */
  protected readonly filteredColumnDefs = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const all = this.store.allColumnDefs();
    if (!term) {
      return all;
    }
    return all.filter(
      (column) =>
        column.label.toLowerCase().includes(term) || column.field.toLowerCase().includes(term),
    );
  });

  /** The field the ✓ button acts on: hovered row, or first filtered result. */
  protected readonly activeOption = computed(
    () => this.activeField() ?? this.filteredColumnDefs()[0]?.field ?? null,
  );

  @ViewChild('chipsScroll', { read: ElementRef })
  private readonly chipsScroll?: ElementRef<HTMLElement>;

  private dragState: StripDragState | null = null;

  ngAfterViewInit(): void {
    this.chipsScroll?.nativeElement.addEventListener('pointerdown', this.onStripPointerDown);
  }

  ngOnDestroy(): void {
    const strip = this.chipsScroll?.nativeElement;
    strip?.removeEventListener('pointerdown', this.onStripPointerDown);
    this.endStripDrag();
  }

  protected toggle(field: CustomerFieldKey, checked: boolean): void {
    this.store.setColumnVisible(field, checked);
  }

  /** Clicking a row toggles that field without disturbing the search. */
  protected toggleOption(field: CustomerFieldKey): void {
    this.toggle(field, !this.store.isColumnVisible(field));
  }

  /** The ✓ button selects the currently active (hovered/first) field. */
  protected confirmActive(): void {
    const field = this.activeOption();
    if (field) {
      this.toggleOption(field);
    }
  }

  /** Removes one selected column without toggling the dropdown itself. */
  protected removeColumn(event: Event, field: CustomerFieldKey): void {
    event.stopPropagation();
    this.store.setColumnVisible(field, false);
  }

  /** The last visible column cannot be unchecked. */
  protected isLastVisible(field: CustomerFieldKey): boolean {
    return this.store.visibleColumnCount() === 1 && this.store.isColumnVisible(field);
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.syncActiveField();
  }

  protected setActive(field: CustomerFieldKey): void {
    this.activeField.set(field);
  }

  private syncActiveField(): void {
    this.activeField.set(this.filteredColumnDefs()[0]?.field ?? null);
  }

  /**
   * Starts click-and-drag panning of the strip when the mouse is pressed
   * anywhere in the middle area. Pressing the X remove button (or any
   * embedded button) does not start a drag.
   */
  private readonly onStripPointerDown = (event: PointerEvent): void => {
    const strip = this.chipsScroll?.nativeElement;
    if (!strip || event.pointerType !== 'mouse' || event.button !== 0 || this.dragState) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest('button')) {
      return;
    }
    this.dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: strip.scrollLeft,
    };
    strip.classList.add('dragging');
    strip.setPointerCapture(event.pointerId);
    strip.addEventListener('pointermove', this.onStripPointerMove);
    strip.addEventListener('pointerup', this.onStripPointerUp);
    strip.addEventListener('pointercancel', this.onStripPointerUp);
    event.preventDefault();
  };

  /** Drags the strip content along with the pointer. */
  private readonly onStripPointerMove = (event: PointerEvent): void => {
    const strip = this.chipsScroll?.nativeElement;
    const drag = this.dragState;
    if (!strip || !drag) {
      return;
    }
    strip.scrollLeft = drag.startScrollLeft - (event.clientX - drag.startX);
  };

  private readonly onStripPointerUp = (): void => {
    this.endStripDrag();
  };

  private endStripDrag(): void {
    const strip = this.chipsScroll?.nativeElement;
    if (strip) {
      strip.classList.remove('dragging');
      if (this.dragState && strip.hasPointerCapture(this.dragState.pointerId)) {
        strip.releasePointerCapture(this.dragState.pointerId);
      }
      strip.removeEventListener('pointermove', this.onStripPointerMove);
      strip.removeEventListener('pointerup', this.onStripPointerUp);
      strip.removeEventListener('pointercancel', this.onStripPointerUp);
    }
    this.dragState = null;
  }
}
