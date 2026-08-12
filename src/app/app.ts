import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastModule],
  template: `
    <router-outlet />
    <p-toast position="top-right" [showTransformOptions]="'translateY(100%)'" [showTransitionOptions]="'150ms'" [hideTransitionOptions]="'150ms'" [hideTransformOptions]="'translateY(100%)'" />
  `
})
export class App {}