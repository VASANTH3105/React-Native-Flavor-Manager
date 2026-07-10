import path from 'path';
import fs from 'fs-extra';
import pc from 'picocolors';
import type { AppConfig } from '../types.js';

export interface FirebaseOptions {
  dryRun?: boolean;
}

export async function generateFirebase(cwd: string, config: AppConfig, options: FirebaseOptions = {}) {
  const firebaseBaseDir = path.join(cwd, 'firebase');
  
  // If the user hasn't created a firebase directory, we skip firebase configuration
  if (!fs.existsSync(firebaseBaseDir)) {
    return;
  }

  for (const flavorName of Object.keys(config.flavors)) {
    const srcFile = path.join(firebaseBaseDir, flavorName, 'google-services.json');
    const destFile = path.join(cwd, 'android', 'app', 'src', flavorName, 'google-services.json');

    if (fs.existsSync(srcFile)) {
      if (options.dryRun) {
        console.log(pc.bold(`[PROPOSED COPY] firebase/${flavorName}/google-services.json`));
        console.log(pc.gray(`  -> android/app/src/${flavorName}/google-services.json`));
      } else {
        await fs.ensureDir(path.dirname(destFile));
        await fs.copy(srcFile, destFile, { overwrite: true });
        console.log(pc.green(`✔ Copied Google Firebase configuration for flavor '${flavorName}'`));
      }
    }
  }
}
