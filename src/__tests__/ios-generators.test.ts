import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import { generateIOS } from '../generators/ios.js';
import { generateIOSAssets } from '../generators/ios-assets.js';
import type { AppConfig } from '../types.js';

// Mock sharp to avoid native dependencies during tests
vi.mock('sharp', () => {
  const resizeMock = vi.fn().mockReturnThis();
  const toFileMock = vi.fn().mockResolvedValue({ size: 1000 });
  const sharpMock = vi.fn(() => ({
    resize: resizeMock,
    toFile: toFileMock,
  }));
  return { default: sharpMock };
});

// Mock xcode library to test pbxproj linking safely without parsing real complex pbxproj files
vi.mock('xcode', () => {
  const mockProject = {
    parseSync: vi.fn(),
    addFile: vi.fn().mockReturnValue({ fileRef: 'MOCK_REF_123' }),
    hash: {
      project: {
        objects: {
          XCBuildConfiguration: {
            'CONF_1': {
              buildSettings: {
                PRODUCT_NAME: 'MockApp'
              }
            }
          }
        }
      }
    },
    writeSync: vi.fn().mockReturnValue('Linked RNFMConfig.xcconfig configuration inside pbxproj')
  };

  return {
    default: {
      project: vi.fn().mockReturnValue(mockProject)
    }
  };
});

describe('iOS Project & Asset Generators tests', () => {
  const sandboxDir = path.join(__dirname, 'sandbox-p3');

  beforeEach(async () => {
    await fs.ensureDir(sandboxDir);
  });

  afterEach(async () => {
    await fs.remove(sandboxDir);
  });

  it('should generate RNFMConfig.xcconfig and scheme xml files', async () => {
    const config: AppConfig = {
      flavors: {
        dev: {
          appName: 'Mock App Dev',
          bundleId: 'com.mock.dev',
        },
        prod: {
          appName: 'Mock App',
          bundleId: 'com.mock',
        },
      },
    };

    // Set up mock iOS Xcode project directory
    const iosDir = path.join(sandboxDir, 'ios');
    const xcodeProjDir = path.join(iosDir, 'MockApp.xcodeproj');
    await fs.ensureDir(xcodeProjDir);

    // Write a dummy pbxproj file
    const pbxprojContent = 'dummy project file content\n';
    await fs.writeFile(path.join(xcodeProjDir, 'project.pbxproj'), pbxprojContent, 'utf8');

    // Run generator
    await generateIOS(sandboxDir, config);

    // Assert RNFMConfig.xcconfig is generated
    const xcconfigPath = path.join(iosDir, 'RNFMConfig.xcconfig');
    expect(fs.existsSync(xcconfigPath)).toBe(true);

    const xcconfig = await fs.readFile(xcconfigPath, 'utf8');
    expect(xcconfig).toContain('PRODUCT_BUNDLE_IDENTIFIER = com.mock.dev');
    expect(xcconfig).toContain('PRODUCT_NAME = Mock App Dev');
    expect(xcconfig).toContain('ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon-dev');

    // Assert scheme files are generated
    const devSchemePath = path.join(xcodeProjDir, 'xcshareddata', 'xcschemes', 'MockApp-dev.xcscheme');
    const prodSchemePath = path.join(xcodeProjDir, 'xcshareddata', 'xcschemes', 'MockApp-prod.xcscheme');

    expect(fs.existsSync(devSchemePath)).toBe(true);
    expect(fs.existsSync(prodSchemePath)).toBe(true);

    const devScheme = await fs.readFile(devSchemePath, 'utf8');
    expect(devScheme).toContain('BlueprintIdentifier = "13B07F861A680F5B00A75B9A"'); // Fallback ID
    expect(devScheme).toContain('BuildableName = "MockApp.app"');

    // Assert pbxproj was modified (via mocked writeSync)
    const newPbxproj = await fs.readFile(path.join(xcodeProjDir, 'project.pbxproj'), 'utf8');
    expect(newPbxproj).toContain('RNFMConfig.xcconfig');
  });

  it('should generate iOS AppIcon catalogs with Contents.json', async () => {
    const config: AppConfig = {
      flavors: {
        dev: {},
      },
    };

    const iosDir = path.join(sandboxDir, 'ios');
    const xcodeProjDir = path.join(iosDir, 'MockApp.xcodeproj');
    await fs.ensureDir(xcodeProjDir);

    const xcassetsDir = path.join(iosDir, 'MockApp', 'Images.xcassets');
    await fs.ensureDir(xcassetsDir);

    // Create source icon file
    const iconsDir = path.join(sandboxDir, 'icons', 'dev');
    await fs.ensureDir(iconsDir);
    await fs.writeFile(path.join(iconsDir, 'icon.png'), 'dummy-icon-data', 'utf8');

    // Run generator
    await generateIOSAssets(sandboxDir, config);

    // Check outputs
    const appiconsetDir = path.join(xcassetsDir, 'AppIcon-dev.appiconset');
    const contentsJsonPath = path.join(appiconsetDir, 'Contents.json');

    expect(fs.existsSync(appiconsetDir)).toBe(true);
    expect(fs.existsSync(contentsJsonPath)).toBe(true);

    const contents = await fs.readJSON(contentsJsonPath);
    expect(contents.info.author).toBe('rn-flavors');
    expect(contents.images.length).toBeGreaterThan(0);
    expect(contents.images[0].filename).toBeDefined();
  });
});
