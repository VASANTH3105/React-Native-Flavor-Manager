import pc from 'picocolors';
import { loadConfig, normalizeConfig } from '../config/config-loader.js';
import { generateAndroid } from '../generators/android.js';
import { generateAssets } from '../generators/assets.js';
import { generateFirebase } from '../generators/firebase.js';
import { generateEnv } from '../generators/env.js';
import { generateIOS } from '../generators/ios.js';
import { generateIOSAssets } from '../generators/ios-assets.js';

export interface GenerateOptions {
  dryRun?: boolean;
}

export async function handleGenerate(cwd: string, options: GenerateOptions = {}) {
  const isDryRun = !!options.dryRun;

  if (isDryRun) {
    console.log(pc.yellow('\n--- DRY RUN MODE ---'));
    console.log(pc.gray('No files will be modified on disk.\n'));
  } else {
    console.log(pc.cyan('\nStarting configuration generation...'));
  }

  let loaded;
  try {
    loaded = await loadConfig(cwd);
  } catch (error: any) {
    console.log(pc.red(`\n✖ Error loading config:\n${error.message}\n`));
    process.exit(1);
  }

  const { config } = loaded;
  const normalized = normalizeConfig(config);

  // 1. Android Flavor Generation
  try {
    await generateAndroid(cwd, normalized, { dryRun: isDryRun });
  } catch (error: any) {
    console.log(pc.red(`\n✖ Android Flavor generation failed:\n${error.message}\n`));
    process.exit(1);
  }

  // 2. iOS Project & Scheme Generation
  try {
    await generateIOS(cwd, normalized, { dryRun: isDryRun });
  } catch (error: any) {
    console.log(pc.red(`\n✖ iOS Project generation failed:\n${error.message}\n`));
    process.exit(1);
  }

  // 3. Android Assets/Branding Generation
  try {
    await generateAssets(cwd, normalized, { dryRun: isDryRun });
  } catch (error: any) {
    console.log(pc.red(`\n✖ Android Assets generation failed:\n${error.message}\n`));
    process.exit(1);
  }

  // 4. iOS Assets/Branding Generation
  try {
    await generateIOSAssets(cwd, normalized, { dryRun: isDryRun });
  } catch (error: any) {
    console.log(pc.red(`\n✖ iOS Assets generation failed:\n${error.message}\n`));
    process.exit(1);
  }

  // 5. Firebase Configurations Copy
  try {
    await generateFirebase(cwd, normalized, { dryRun: isDryRun });
  } catch (error: any) {
    console.log(pc.red(`\n✖ Firebase copy failed:\n${error.message}\n`));
    process.exit(1);
  }

  // 6. Environment Variables Generation
  try {
    await generateEnv(cwd, normalized, { dryRun: isDryRun });
  } catch (error: any) {
    console.log(pc.red(`\n✖ Environment file generation failed:\n${error.message}\n`));
    process.exit(1);
  }

  if (isDryRun) {
    console.log(pc.yellow('\n✔ Dry run complete. Inspect proposed changes above.'));
  } else {
    console.log(pc.green('\n✔ Generation complete! Native project files updated.'));
  }
}
