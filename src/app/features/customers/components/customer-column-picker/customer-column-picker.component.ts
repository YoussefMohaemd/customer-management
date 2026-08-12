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

  /** True when every field matching the search is visible (false with no matches). */
  protected readonly searchAllSelected = computed(() => {
    const results = this.filteredColumnDefs();
    return results.length > 0 && results.every((column) => this.store.isColumnVisible(column.field));
  });

  /** True when at least one matching field is already visible (partial state). */
  protected readonly searchSomeSelected = computed(() =>
    this.filteredColumnDefs().some((column) => this.store.isColumnVisible(column.field)),
  );

  /** Neutral/disabled while there is no search term or no matching results. */
  protected readonly searchDisabled = computed(
    () => !this.searchTerm().trim() || this.filteredColumnDefs().length === 0,
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

  /** Explicit click on the search checkbox selects/clears every current match. */
  protected toggleSearchAll(): void {
    const results = this.filteredColumnDefs();
    if (results.length === 0) {
      return;
    }
    const selectAll = !results.every((column) => this.store.isColumnVisible(column.field));
    for (const column of results) {
      this.toggle(column.field, selectAll);
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
    this.searchTerm.set((event.target as HTMLInputElement).value);
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
