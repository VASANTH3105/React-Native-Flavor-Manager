import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import { normalizeConfig } from '../config/config-loader.js';
import { ConfigSchema } from '../types.js';

describe('config loader & schema tests', () => {
  it('should validate a correct configuration structure', () => {
    const validJson = {
      flavors: {
        dev: {
          appName: 'My App Dev',
          packageName: 'com.demo.dev',
          version: '1.0.0',
          versionCode: 1,
          apiUrl: 'https://dev.api.com',
        },
        production: {
          appName: 'My App',
          packageName: 'com.demo.prod',
          version: '1.0.0',
          versionCode: 1,
          apiUrl: 'https://api.com',
        },
      },
    };

    const parsed = ConfigSchema.safeParse(validJson);
    expect(parsed.success).toBe(true);
  });

  it('should fail validation on invalid package names', () => {
    const invalidJson = {
      flavors: {
        dev: {
          packageName: 'invalid-package-name', // dashes are invalid in java package names
        },
      },
    };

    const parsed = ConfigSchema.safeParse(invalidJson);
    expect(parsed.success).toBe(false);
  });

  it('should correctly normalize configs and extract custom environment variables', () => {
    const rawConfig = {
      flavors: {
        dev: {
          displayName: 'My App Dev',
          packageName: 'com.demo.dev',
          versionName: '2.1.0',
          versionCode: 42,
          apiUrl: 'https://dev.api.com',
          apiKey: 'dev-key-xyz',
          env: {
            debugMode: true,
          },
        },
      },
    };

    const normalized = normalizeConfig(rawConfig as any);
    const devFlavor = normalized.flavors.dev;

    expect(devFlavor.appName).toBe('My App Dev');
    expect(devFlavor.packageName).toBe('com.demo.dev');
    expect(devFlavor.version).toBe('2.1.0');
    expect(devFlavor.versionCode).toBe(42);

    // Custom environment variables should be merged into flavor.env
    expect(devFlavor.env).toEqual({
      apiUrl: 'https://dev.api.com',
      apiKey: 'dev-key-xyz',
      debugMode: true,
    });
  });
});
