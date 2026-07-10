import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import { applyClientOverlay } from '../generators/white-label.js';
import { handleImport } from '../commands/import.js';
import type { AppConfig } from '../types.js';

describe('Phase 4: Plugins, White-label & Import Tests', () => {
  const sandboxDir = path.join(__dirname, 'sandbox-p4');

  beforeEach(async () => {
    await fs.ensureDir(sandboxDir);
  });

  afterEach(async () => {
    await fs.remove(sandboxDir);
  });

  it('should successfully overlay client configuration properties on top of flavor configs', async () => {
    const baseConfig: AppConfig = {
      flavors: {
        dev: {
          appName: 'Base Dev App',
          packageName: 'com.base.dev',
          env: {
            API_URL: 'https://dev.base.com',
            IS_PREMIUM: false,
          },
        },
      },
      clients: {
        tesla: {
          appName: 'Tesla App',
          packageName: 'com.tesla.app',
          env: {
            IS_PREMIUM: true,
          },
          CLIENT_ID: 'tesla-1234',
        },
      },
    };

    const merged = await applyClientOverlay(sandboxDir, baseConfig, { clientName: 'tesla' });
    const devFlavor = merged.flavors.dev;

    expect(devFlavor.appName).toBe('Tesla App');
    expect(devFlavor.packageName).toBe('com.tesla.app');
    expect(devFlavor.env).toEqual({
      API_URL: 'https://dev.base.com',
      IS_PREMIUM: true,
      CLIENT_ID: 'tesla-1234',
    });
  });

  it('should import existing gradle product flavors and output flavors.config.ts', async () => {
    const mockGradleContent = `
android {
    defaultConfig {
        applicationId "com.base"
    }
    productFlavors {
        staging {
            applicationId "com.base.staging"
            versionName "1.2.0"
            versionCode 5
        }
    }
}
    `.trim();

    const appDir = path.join(sandboxDir, 'android', 'app');
    await fs.ensureDir(appDir);
    await fs.writeFile(path.join(appDir, 'build.gradle'), mockGradleContent, 'utf8');

    // Run import
    await handleImport(sandboxDir);

    const configPath = path.join(sandboxDir, 'flavors.config.ts');
    expect(fs.existsSync(configPath)).toBe(true);

    const configText = await fs.readFile(configPath, 'utf8');
    expect(configText).toContain('"staging"');
    expect(configText).toContain('"packageName": "com.base.staging"');
    expect(configText).toContain('"version": "1.2.0"');
    expect(configText).toContain('"versionCode": 5');
  });
});
