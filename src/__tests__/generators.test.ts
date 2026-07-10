import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import { generateFirebase } from '../generators/firebase.js';
import { generateEnv, activateEnvironment } from '../generators/env.js';
import { generateAssets } from '../generators/assets.js';
import type { AppConfig } from '../types.js';

// Mock sharp to avoid native dependencies during tests
vi.mock('sharp', () => {
  const resizeMock = vi.fn().mockReturnThis();
  const compositeMock = vi.fn().mockReturnThis();
  const toFileMock = vi.fn().mockResolvedValue({ size: 1000 });

  const sharpMock = vi.fn(() => ({
    resize: resizeMock,
    composite: compositeMock,
    toFile: toFileMock,
  }));

  return {
    default: sharpMock,
    __internalMocks: {
      resizeMock,
      compositeMock,
      toFileMock,
    }
  };
});

describe('Phase 2 Generators tests', () => {
  const sandboxDir = path.join(__dirname, 'sandbox-p2');

  beforeEach(async () => {
    await fs.ensureDir(sandboxDir);
  });

  afterEach(async () => {
    await fs.remove(sandboxDir);
  });

  it('should copy firebase config files correctly', async () => {
    const config: AppConfig = {
      flavors: {
        dev: {},
        production: {},
      },
    };

    // Set up mock firebase source files
    await fs.ensureDir(path.join(sandboxDir, 'firebase', 'dev'));
    await fs.ensureDir(path.join(sandboxDir, 'firebase', 'production'));

    const devMockFile = path.join(sandboxDir, 'firebase', 'dev', 'google-services.json');
    const prodMockFile = path.join(sandboxDir, 'firebase', 'production', 'google-services.json');

    await fs.writeFile(devMockFile, '{"project": "dev-firebase"}', 'utf8');
    await fs.writeFile(prodMockFile, '{"project": "prod-firebase"}', 'utf8');

    // Run generator
    await generateFirebase(sandboxDir, config);

    // Assert files are copied to android source directories
    const devCopied = path.join(sandboxDir, 'android', 'app', 'src', 'dev', 'google-services.json');
    const prodCopied = path.join(sandboxDir, 'android', 'app', 'src', 'production', 'google-services.json');

    expect(fs.existsSync(devCopied)).toBe(true);
    expect(fs.existsSync(prodCopied)).toBe(true);
    expect(await fs.readJSON(devCopied)).toEqual({ project: 'dev-firebase' });
  });

  it('should generate environment files for all flavors and support activation', async () => {
    const config: AppConfig = {
      flavors: {
        dev: {
          env: {
            API_URL: 'https://dev.api.com',
            DEBUG: true,
          },
        },
        prod: {
          env: {
            API_URL: 'https://api.com',
            DEBUG: false,
          },
        },
      },
    };

    // Run env generator
    await generateEnv(sandboxDir, config);

    // Check environments/ files
    const devJson = path.join(sandboxDir, 'environments', 'dev.json');
    const devEnv = path.join(sandboxDir, 'environments', 'dev.env');
    const prodJson = path.join(sandboxDir, 'environments', 'prod.json');

    expect(fs.existsSync(devJson)).toBe(true);
    expect(fs.existsSync(devEnv)).toBe(true);
    expect(fs.existsSync(prodJson)).toBe(true);

    const devContent = await fs.readJSON(devJson);
    expect(devContent.API_URL).toBe('https://dev.api.com');
    expect(devContent.DEBUG).toBe(true);

    const dotenv = await fs.readFile(devEnv, 'utf8');
    expect(dotenv).toContain('API_URL=https://dev.api.com');
    expect(dotenv).toContain('DEBUG=true');

    // Test activation of flavor 'prod'
    await activateEnvironment(sandboxDir, 'prod');

    const activeJson = path.join(sandboxDir, 'environments', 'env.json');
    const activeDotenv = path.join(sandboxDir, '.env');

    expect(fs.existsSync(activeJson)).toBe(true);
    expect(fs.existsSync(activeDotenv)).toBe(true);

    const activeContent = await fs.readJSON(activeJson);
    expect(activeContent.API_URL).toBe('https://api.com');
    expect(activeContent.DEBUG).toBe(false);
  });

  it('should resize launcher icons correctly using sharp', async () => {
    const config: AppConfig = {
      flavors: {
        dev: {},
      },
    };

    // Set up mock source icon file
    const mockIconDir = path.join(sandboxDir, 'icons', 'dev');
    await fs.ensureDir(mockIconDir);
    const mockIconFile = path.join(mockIconDir, 'icon.png');
    await fs.writeFile(mockIconFile, 'dummy-png-data', 'utf8');

    // Run generator
    await generateAssets(sandboxDir, config);

    // Verify sharp resize commands were called
    const sharpMockModule = await import('sharp');
    const mocks = (sharpMockModule as any).__internalMocks;
    
    expect(mocks.resizeMock).toHaveBeenCalled();
    expect(mocks.toFileMock).toHaveBeenCalled();
  });
});
