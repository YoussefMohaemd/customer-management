import { Injectable, computed, signal } from '@angular/core';

/** localStorage key holding the JWT used for `Authorization: Bearer <token>`. */
export const AUTH_TOKEN_STORAGE_KEY = 'access_token';

/** Marks that the initial token from the runtime config was seeded into localStorage. */
const INITIAL_TOKEN_SEEDED_KEY = 'crm.auth.initial-seeded';

function readStoredToken(): string | null {
  try {
    const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)?.trim();
    return token || null;
  } catch {
    return null;
  }
}

/**
 * Single source of truth for the JWT in this application.
 *
 * The token is persisted in localStorage (`access_token`); nothing else in the
 * app reads or writes localStorage for auth. The `authInterceptor` consumes
 * this service, so components and API services never touch the token directly.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly token = signal<string | null>(readStoredToken());

  /** True while a non-empty token is available. */
  readonly hasToken = computed(() => this.token() !== null);

  /** Returns the current token (or `null` when none is stored). */
  getToken(): string | null {
    return this.token();
  }

  /** Persists the token to localStorage and activates it immediately. */
  setToken(token: string): void {
    const clean = token.trim();
    try {
      if (clean) {
        window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, clean);
      } else {
        window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      }
    } catch {
      // Storage unavailable (e.g. private mode): the in-memory signal still applies.
    }
    this.token.set(clean || null);
  }

  /** Removes the token from localStorage and deactivates it. */
  removeToken(): void {
    try {
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    } catch {
      // Storage unavailable: the in-memory signal still clears below.
    }
    this.token.set(null);
  }

  /**
   * Seeds the initial JWT (from the runtime config file) into localStorage
   * exactly once per browser. A token the user explicitly removed therefore
   * stays removed across reloads instead of being silently restored.
   */
  seedInitialToken(token: string): void {
    const clean = token.trim();
    if (!clean || this.hasToken()) {
      return;
    }
    try {
      if (window.localStorage.getItem(INITIAL_TOKEN_SEEDED_KEY) !== null) {
        return;
      }
      window.localStorage.setItem(INITIAL_TOKEN_SEEDED_KEY, 'true');
      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, clean);
    } catch {
      return;
    }
    this.token.set(clean);
  }
}
