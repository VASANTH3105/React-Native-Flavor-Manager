import path from 'path';
import fs from 'fs-extra';
import pc from 'picocolors';
import type { AppConfig } from '../types.js';

export interface EnvOptions {
  dryRun?: boolean;
}

export async function generateEnv(cwd: string, config: AppConfig, options: EnvOptions = {}) {
  const envBaseDir = path.join(cwd, 'environments');

  if (options.dryRun) {
    console.log(pc.bold('\n[PROPOSED ENVIRONMENT FILES]'));
  } else {
    await fs.ensureDir(envBaseDir);
  }

  const flavorNames = Object.keys(config.flavors);
  if (flavorNames.length === 0) return;

  for (const flavorName of flavorNames) {
    const flavor = config.flavors[flavorName];
    const envVars = flavor.env || {};

    // 1. Generate JSON format
    const jsonContent = JSON.stringify(envVars, null, 2);
    const jsonPath = path.join(envBaseDir, `${flavorName}.json`);

    // 2. Generate .env format
    let dotenvContent = '';
    for (const [key, value] of Object.entries(envVars)) {
      dotenvContent += `${key}=${value}\n`;
    }
    const dotenvPath = path.join(envBaseDir, `${flavorName}.env`);

    if (options.dryRun) {
      console.log(pc.gray(`  Create environments/${flavorName}.json`));
      console.log(pc.gray(`  Create environments/${flavorName}.env`));
    } else {
      await fs.writeFile(jsonPath, jsonContent, 'utf8');
      await fs.writeFile(dotenvPath, dotenvContent, 'utf8');
    }
  }

  // Set the first flavor as default active active environment if root env files do not exist yet
  const defaultFlavor = flavorNames[0];
  if (defaultFlavor) {
    await activateEnvironment(cwd, defaultFlavor, options.dryRun);
  }
}

export async function activateEnvironment(cwd: string, flavorName: string, dryRun: boolean = false) {
  const jsonSrc = path.join(cwd, 'environments', `${flavorName}.json`);
  const dotenvSrc = path.join(cwd, 'environments', `${flavorName}.env`);

  const jsonDest = path.join(cwd, 'environments', 'env.json');
  const dotenvDest = path.join(cwd, '.env');

  if (fs.existsSync(jsonSrc) && fs.existsSync(dotenvSrc)) {
    if (dryRun) {
      console.log(pc.gray(`  Activate environment: Copy environments/${flavorName}.env -> .env`));
      console.log(pc.gray(`  Activate environment: Copy environments/${flavorName}.json -> environments/env.json`));
    } else {
      await fs.copy(jsonSrc, jsonDest, { overwrite: true });
      await fs.copy(dotenvSrc, dotenvDest, { overwrite: true });
      console.log(pc.green(`✔ Activated environment variables for flavor '${flavorName}' (.env & environments/env.json)`));
    }
  }
}
