import { Injectable, computed, inject, signal } from '@angular/core';

import { AuthService } from '@core/services/auth.service';

export interface AppAuthConfig {
  token: string;
}

export interface AppConfig {
  auth: AppAuthConfig;
}

const CONFIG_URL = 'config/app-config.json';

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private readonly config = signal<AppConfig | null>(null);
  private readonly configLoadError = signal<string | null>(null);

  readonly loaded = computed(() => this.config() !== null);

  /** The initial auth block from the runtime config file (empty token when absent). */
  initialAuth(): AppAuthConfig {
    return this.config()?.auth ?? { token: '' };
  }

  /** Promise of the runtime configuration, resolved once during application bootstrap. */
  load(): Promise<void> {
    if (this.config() !== null) {
      return Promise.resolve();
    }
    return fetch(CONFIG_URL, { cache: 'no-store' })
      .then(async (response) => {
        const contentType = response.headers.get('content-type') || '';
        if (!response.ok || contentType.includes('text/html')) {
          throw new Error('Production authentication configuration is missing.');
        }
        const data = (await response.json().catch(() => null)) as AppConfig | null;
        if (!data || typeof data !== 'object') {
          throw new Error('Production authentication configuration is missing.');
        }
        return data;
      })
      .then((cfg) => {
        const sanitized = this.sanitize(cfg);
        if (!sanitized.auth.token) {
          this.configLoadError.set('Production authentication configuration is missing.');
        }
        this.config.set(sanitized);
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Production authentication configuration is missing.';
        this.configLoadError.set(message);
        this.config.set(this.emptyConfig());
      });
  }

  get loadError(): string | null {
    return this.configLoadError();
  }

  private sanitize(cfg: Partial<AppConfig>): AppConfig {
    return {
      auth: {
        token: cfg.auth?.token?.trim() ?? '',
      },
    };
  }

  private emptyConfig(): AppConfig {
    return { auth: { token: '' } };
  }
}

/**
 * Loads the runtime config at bootstrap and seeds the initial JWT from it into
 * localStorage exactly once (see {@link AuthService.seedInitialToken}). The
 * config file is the only place the initial token value lives.
 */
export const appConfigInitializer = (): (() => Promise<void>) => {
  const configService = inject(AppConfigService);
  const authService = inject(AuthService);
  return () =>
    configService.load().then(() => {
      const initialToken = configService.initialAuth().token;
      if (initialToken) {
        authService.seedInitialToken(initialToken);
      } else if (!authService.hasToken()) {
        console.warn('Production authentication configuration is missing.');
      }
    });
};
