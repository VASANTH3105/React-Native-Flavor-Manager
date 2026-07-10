import path from 'path';
import fs from 'fs-extra';
import pc from 'picocolors';
import type { AppConfig } from '../types.js';

export interface OverlayOptions {
  clientName?: string;
  dryRun?: boolean;
}

/**
 * Merges client-specific configuration and overlays resources if clientName is specified.
 */
export async function applyClientOverlay(
  cwd: string,
  config: AppConfig,
  options: OverlayOptions = {}
): Promise<AppConfig> {
  const { clientName, dryRun } = options;
  if (!clientName) return config;

  const clientConfig = config.clients?.[clientName.toLowerCase()];
  if (!clientConfig) {
    throw new Error(`Client '${clientName}' not found in configuration 'clients' block.`);
  }

  console.log(pc.cyan(`\nApplying white-label overlay for client '${clientName}'...`));

  // 1. Copy client-specific assets if they exist (e.g. clients/tesla/icon.png)
  const clientDir = path.join(cwd, 'clients', clientName.toLowerCase());
  const clientIcon = path.join(clientDir, 'icon.png');
  const targetIconDir = path.join(cwd, 'icons', 'dev'); // standard dev fallback or default target
  const targetIcon = path.join(cwd, 'icons', 'icon.png');

  if (fs.existsSync(clientIcon)) {
    if (dryRun) {
      console.log(pc.gray(`  [Overlay] Copy clients/${clientName.toLowerCase()}/icon.png -> icons/icon.png`));
    } else {
      await fs.ensureDir(path.dirname(targetIcon));
      await fs.copy(clientIcon, targetIcon, { overwrite: true });
      console.log(pc.green(`✔ Overlaid client icon from clients/${clientName.toLowerCase()}/icon.png`));
    }
  }

  // 2. Clone and overlay properties on all configurations
  const mergedFlavors: Record<string, any> = {};

  for (const [flavorName, flavor] of Object.entries(config.flavors)) {
    const mergedEnv = {
      ...(flavor.env || {}),
      ...(clientConfig.env || {}),
    };

    // If client config specifies any environmental overrides, merge them
    for (const [key, value] of Object.entries(clientConfig)) {
      if (key !== 'appName' && key !== 'packageName' && key !== 'bundleId' && key !== 'env' && key !== 'displayName') {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          mergedEnv[key] = value;
        }
      }
    }

    mergedFlavors[flavorName] = {
      ...flavor,
      appName: clientConfig.appName || clientConfig.displayName || flavor.appName || flavor.displayName,
      packageName: clientConfig.packageName || flavor.packageName,
      bundleId: clientConfig.bundleId || flavor.bundleId,
      env: mergedEnv,
    };
  }

  return {
    ...config,
    flavors: mergedFlavors,
  };
}
