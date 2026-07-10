import path from 'path';
import fs from 'fs-extra';
import createJiti from 'jiti';
import { ConfigSchema, type AppConfig } from '../types.js';

// We get the directory name in an ESM context
const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

const CONFIG_FILENAMES = [
  'flavors.config.ts',
  'flavors.config.js',
  'flavors.config.json'
];

export interface LoadedConfig {
  config: AppConfig;
  filepath: string;
  filename: string;
}

export function findConfigFile(cwd: string): string | null {
  for (const filename of CONFIG_FILENAMES) {
    const fullPath = path.join(cwd, filename);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

export async function loadConfig(cwd: string): Promise<LoadedConfig> {
  const filepath = findConfigFile(cwd);
  if (!filepath) {
    throw new Error(
      `No flavor configuration file found. Expected one of: ${CONFIG_FILENAMES.join(', ')}\n` +
      `Run 'npx rn-flavors init' to initialize a new configuration.`
    );
  }

  const filename = path.basename(filepath);
  let rawConfig: any;

  try {
    if (filename.endsWith('.json')) {
      rawConfig = await fs.readJSON(filepath);
    } else {
      // Clear Node require cache for this config file to avoid caching issues during multi-command runs
      try {
        const { createRequire } = await import('module');
        const requireInstance = createRequire(import.meta.url);
        const resolvedPath = requireInstance.resolve(filepath);
        if (requireInstance.cache[resolvedPath]) {
          delete requireInstance.cache[resolvedPath];
        }
      } catch {}

      // Use jiti to dynamically import JS/TS files
      const jitiInstance = createJiti(cwd, {
        esmResolve: true,
        interopDefault: true,
        cache: false, // Ensure we load fresh config
      });
      rawConfig = jitiInstance(filepath);
    }
  } catch (error: any) {
    throw new Error(`Failed to load configuration file at '${filepath}':\n${error.message}`);
  }

  // Validate configuration against schema
  const parsed = ConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    const errors = parsed.error.errors.map(err => {
      const fieldPath = err.path.join('.');
      return `  - [${fieldPath}]: ${err.message}`;
    }).join('\n');
    throw new Error(`Invalid configuration file structure in '${filename}':\n${errors}`);
  }

  return {
    config: parsed.data,
    filepath,
    filename
  };
}

/**
 * Standardizes the flavor configuration, extracting custom top-level fields
 * (like appName, packageName, etc.) and placing everything else in `env`.
 */
export function normalizeConfig(config: AppConfig): AppConfig {
  const normalizedFlavors: Record<string, any> = {};

  for (const [flavorName, flavor] of Object.entries(config.flavors)) {
    const {
      appName,
      displayName,
      packageName,
      bundleId,
      version,
      versionName,
      versionCode,
      env = {},
      ...rest
    } = flavor;

    const resolvedAppName = appName || displayName;
    const resolvedVersion = version || versionName;

    // Build the resolved env object
    const resolvedEnv = { ...env };

    // Any other top-level keys in the object (not defined in the standard schema)
    // should be treated as environment variables.
    for (const [key, value] of Object.entries(rest)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        resolvedEnv[key] = value;
      }
    }

    normalizedFlavors[flavorName] = {
      appName: resolvedAppName,
      packageName,
      bundleId,
      version: resolvedVersion,
      versionCode,
      env: resolvedEnv,
    };
  }

  return {
    flavors: normalizedFlavors,
  };
}
