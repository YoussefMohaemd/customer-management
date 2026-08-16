import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppConfigService } from '@core/services/app-config.service';

describe('AppConfigService (runtime config)', () => {
  let service: AppConfigService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AppConfigService);
  });

  it('starts unloaded with an empty initial auth block', () => {
    expect(service.loaded()).toBe(false);
    expect(service.initialAuth()).toEqual({ token: '' });
  });

  it('loads the runtime config and exposes the initial token', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ auth: { token: 'file-jwt' } }), { status: 200 }),
      );

    await service.load();

    expect(service.loaded()).toBe(true);
    expect(service.initialAuth()).toEqual({ token: 'file-jwt' });
    expect(service.loadError).toBeNull();
    fetchMock.mockRestore();
  });

  it('trims whitespace from the configured token', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ auth: { token: '  file-jwt  ' } }), { status: 200 }),
      );

    await service.load();

    expect(service.initialAuth()).toEqual({ token: 'file-jwt' });
    fetchMock.mockRestore();
  });

  it('falls back to an empty auth block when the config file cannot be loaded', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('network down'));

    await service.load();

    expect(service.loaded()).toBe(true);
    expect(service.initialAuth()).toEqual({ token: '' });
    expect(service.loadError).not.toBeNull();
    fetchMock.mockRestore();
  });

  it('loads the configuration only once', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ auth: { token: 'file-jwt' } }), { status: 200 }),
      );

    await service.load();
    await service.load();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRestore();
  });
});
