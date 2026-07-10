import path from 'path';
import fs from 'fs-extra';
import pc from 'picocolors';
import { loadConfig, normalizeConfig } from '../config/config-loader.js';

export interface ValidationError {
  type: 'error' | 'warning';
  message: string;
  expectedPath?: string;
}

export async function handleValidate(cwd: string): Promise<boolean> {
  console.log(pc.cyan('\nValidating flavor configuration...'));

  let loaded;
  try {
    loaded = await loadConfig(cwd);
  } catch (error: any) {
    console.log(pc.red(`\n✖ Configuration Loading Error:\n${error.message}\n`));
    return false;
  }

  const { config } = loaded;
  const normalized = normalizeConfig(config);
  const errors: ValidationError[] = [];

  const packageNames = new Set<string>();
  const bundleIds = new Set<string>();

  for (const [flavorName, flavor] of Object.entries(normalized.flavors)) {
    // 1. Check for Duplicate Package Names / Bundle IDs
    if (flavor.packageName) {
      if (packageNames.has(flavor.packageName)) {
        errors.push({
          type: 'warning',
          message: `Duplicate packageName '${flavor.packageName}' found in flavor '${flavorName}'. This is valid but unusual unless sharing variants.`,
        });
      } else {
        packageNames.add(flavor.packageName);
      }
    }

    if (flavor.bundleId) {
      if (bundleIds.has(flavor.bundleId)) {
        errors.push({
          type: 'warning',
          message: `Duplicate bundleId '${flavor.bundleId}' found in flavor '${flavorName}'. This is valid but unusual unless sharing variants.`,
        });
      } else {
        bundleIds.add(flavor.bundleId);
      }
    }

    // 2. Validate Naming Conventions (flavors should be alphanumeric)
    if (!/^[a-zA-Z0-9]+$/.test(flavorName)) {
      errors.push({
        type: 'error',
        message: `Invalid flavor name '${flavorName}'. Flavor names must be strictly alphanumeric (letters and numbers only).`,
      });
    }

    // 3. Check for app icons (Check flavor-specific first, then check global fallback icons)
    const iconDirs = [
      path.join(cwd, 'icons', flavorName),
      path.join(cwd, 'assets', flavorName, 'icons'),
      path.join(cwd, 'assets', flavorName),
    ];
    let iconFound = false;

    for (const iconDir of iconDirs) {
      const possibleIcon = path.join(iconDir, 'icon.png');
      if (fs.existsSync(possibleIcon)) {
        iconFound = true;
        break;
      }
    }

    // Check for global fallback if flavor-specific icon is not found
    if (!iconFound) {
      const globalFallbacks = [
        path.join(cwd, 'icons', 'icon.png'),
        path.join(cwd, 'assets', 'icon.png'),
      ];
      for (const p of globalFallbacks) {
        if (fs.existsSync(p)) {
          iconFound = true;
          break;
        }
      }
    }

    if (!iconFound) {
      errors.push({
        type: 'error',
        message: `Flavor '${flavorName}' icon is missing.`,
        expectedPath: `icons/${flavorName}/icon.png (or global fallback at icons/icon.png)`,
      });
    }

    // 4. Check for Firebase configuration if the root firebase directory exists
    const firebaseBaseDir = path.join(cwd, 'firebase');
    if (fs.existsSync(firebaseBaseDir)) {
      const androidFirebaseFile = path.join(firebaseBaseDir, flavorName, 'google-services.json');
      const iosFirebaseFile = path.join(firebaseBaseDir, flavorName, 'GoogleService-Info.plist');

      if (flavor.packageName && !fs.existsSync(androidFirebaseFile)) {
        errors.push({
          type: 'warning',
          message: `Firebase is configured, but Android config is missing for flavor '${flavorName}'.`,
          expectedPath: `firebase/${flavorName}/google-services.json`,
        });
      }

      if (flavor.bundleId && !fs.existsSync(iosFirebaseFile)) {
        errors.push({
          type: 'warning',
          message: `Firebase is configured, but iOS config is missing for flavor '${flavorName}'.`,
          expectedPath: `firebase/${flavorName}/GoogleService-Info.plist`,
        });
      }
    }

    // 5. Version name & code conflicts
    if (flavor.version && !/^\d+(\.\d+){1,2}$/.test(flavor.version)) {
      errors.push({
        type: 'warning',
        message: `Flavor '${flavorName}' has a non-standard version format: '${flavor.version}'. Standard format is Major.Minor.Patch (e.g. 1.0.0).`,
      });
    }
  }

  // Report errors
  if (errors.length === 0) {
    console.log(pc.green('\n✔ Configuration validation successful! No errors found.'));
    return true;
  }

  console.log();
  let hasErrors = false;
  for (const err of errors) {
    const icon = err.type === 'error' ? pc.red('✖') : pc.yellow('⚠');
    const color = err.type === 'error' ? pc.red : pc.yellow;

    if (err.type === 'error') hasErrors = true;

    console.log(`${icon} ${color(err.message)}`);
    if (err.expectedPath) {
      console.log(`  ${pc.gray('Expected at:')} ${pc.underline(err.expectedPath)}`);
    }
  }

  if (hasErrors) {
    console.log(pc.red('\n✖ Configuration validation failed. Please address the errors above.'));
    return false;
  } else {
    console.log(pc.yellow('\n⚠ Configuration validated with warnings.'));
    return true;
  }
}
