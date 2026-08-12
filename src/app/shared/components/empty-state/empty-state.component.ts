import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

/**
 * Reusable empty state: icon, title, optional description and an optional
 * retry action. Used by the customer table for the "no records" state.
 */
@Component({
  selector: 'app-empty-state',
  imports: [ButtonModule],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
  readonly icon = input('pi-inbox');
  readonly title = input('No data found');
  readonly description = input('');
  readonly actionLabel = input('');
  readonly actionHidden = input(false);
  readonly action = output<void>();
}