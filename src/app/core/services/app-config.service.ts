import { Injectable, computed, inject, signal } from '@angular/core';

export interface AppAuthConfig {
  scheme: string;
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
  readonly auth = computed(() => this.config()?.auth ?? null);

  /** Promise of the runtime configuration, resolved once during application bootstrap. */
  load(): Promise<void> {
    if (this.config() !== null) {
      return Promise.resolve();
    }
    return fetch(CONFIG_URL, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Configuration file could not be loaded (HTTP ${response.status}).`);
        }
        return response.json() as Promise<AppConfig>;
      })
      .then((cfg) => this.config.set(this.sanitize(cfg)))
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Unable to load runtime configuration.';
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
        scheme: cfg.auth?.scheme?.trim() || 'Bearer',
        token: cfg.auth?.token?.trim() ?? '',
      },
    };
  }

  private emptyConfig(): AppConfig {
    return { auth: { scheme: 'Bearer', token: '' } };
  }
}

export const appConfigInitializer = (): (() => Promise<void>) => {
  const service = inject(AppConfigService);
  return () => service.load();
};
