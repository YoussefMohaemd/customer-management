import { Injectable, computed, inject, signal } from '@angular/core';

import { AuthService } from '@core/services/auth.service';

export interface AppAuthConfig {
  token: string;
}

export interface AppConfig {
  auth: AppAuthConfig;
}

const CONFIG_URL = '/config/app-config.json';

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
        if (!response.ok) {
          throw new Error(`Configuration file could not be loaded (HTTP ${response.status}).`);
        }
        const data = (await response.json()) as AppConfig;
        return data;
      })
      .then((cfg) => {
        const sanitized = this.sanitize(cfg);
        this.config.set(sanitized);
        if (typeof console !== 'undefined' && console.debug) {
          console.debug('[AppConfig] config loaded: true');
          console.debug(`[AppConfig] token present: ${Boolean(sanitized.auth.token)}`);
        }
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Unable to load runtime configuration.';
        this.configLoadError.set(message);
        this.config.set(this.emptyConfig());
        if (typeof console !== 'undefined' && console.debug) {
          console.debug('[AppConfig] config loaded: false');
        }
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
