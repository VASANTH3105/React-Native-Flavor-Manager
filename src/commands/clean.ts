import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import pc from 'picocolors';
import { loadConfig } from '../config/config-loader.js';

export async function handleClean(cwd: string) {
  console.log(pc.cyan('\nCleaning generated flavor assets and caches...'));

  let flavors: string[] = [];
  try {
    const loaded = await loadConfig(cwd);
    flavors = Object.keys(loaded.config.flavors);
  } catch {
    // If config loading fails, we check directories manually
    console.log(pc.gray('Could not parse flavors config. Proceeding with directory scans.'));
  }

  // 1. Clean flavor directories inside android/app/src/
  const androidSrcDir = path.join(cwd, 'android', 'app', 'src');
  if (fs.existsSync(androidSrcDir)) {
    const subdirs = await fs.readdir(androidSrcDir);
    // Standard android folders we must NOT delete
    const protectedFolders = ['main', 'androidTest', 'test', 'debug', 'release'];

    for (const subdir of subdirs) {
      if (protectedFolders.includes(subdir)) continue;

      const fullPath = path.join(androidSrcDir, subdir);
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        await fs.remove(fullPath);
        console.log(pc.green(`✔ Removed generated Android source folder: android/app/src/${subdir}`));
      }
    }
  }

  // 1b. Clean iOS Schemes, Configs and AppIcon Assets
  const { findXcodeProject } = await import('../generators/ios.js');
  const xcodeInfo = findXcodeProject(cwd);
  if (xcodeInfo) {
    const { projectPath, projectName } = xcodeInfo;

    // Remove RNFMConfig.xcconfig
    const xcconfigPath = path.join(cwd, 'ios', 'RNFMConfig.xcconfig');
    if (fs.existsSync(xcconfigPath)) {
      await fs.remove(xcconfigPath);
      console.log(pc.green('✔ Removed ios/RNFMConfig.xcconfig'));
    }

    // Remove Scheme files
    const schemesDir = path.join(projectPath, 'xcshareddata', 'xcschemes');
    if (fs.existsSync(schemesDir)) {
      const schemeFiles = await fs.readdir(schemesDir);
      for (const file of schemeFiles) {
        if (file.startsWith(`${projectName}-`) && file.endsWith('.xcscheme')) {
          await fs.remove(path.join(schemesDir, file));
          console.log(pc.green(`✔ Removed generated Xcode Scheme: ${path.basename(file, '.xcscheme')}`));
        }
      }
    }

    // Remove AppIcon sets
    const xcassetsPath = path.join(cwd, 'ios', projectName, 'Images.xcassets');
    if (fs.existsSync(xcassetsPath)) {
      const assets = await fs.readdir(xcassetsPath);
      for (const asset of assets) {
        if (asset.startsWith('AppIcon-') && asset.endsWith('.appiconset')) {
          await fs.remove(path.join(xcassetsPath, asset));
          console.log(pc.green(`✔ Removed generated iOS AppIcon catalog: ${asset}`));
        }
      }
    }
  }

  // 2. Clean environment file outputs
  const envFile = path.join(cwd, '.env');
  if (fs.existsSync(envFile)) {
    await fs.remove(envFile);
    console.log(pc.green('✔ Removed .env'));
  }

  const envJsonFile = path.join(cwd, 'environments', 'env.json');
  if (fs.existsSync(envJsonFile)) {
    await fs.remove(envJsonFile);
    console.log(pc.green('✔ Removed environments/env.json'));
  }

  // 3. Run Android Gradle Clean
  const gradlewPath = path.join(cwd, 'android', 'gradlew');
  if (fs.existsSync(gradlewPath)) {
    try {
      console.log(pc.cyan('\nRunning Gradle clean...'));
      const isWindows = process.platform === 'win32';
      const cmd = isWindows ? 'gradlew.bat clean' : './gradlew clean';
      execSync(cmd, { cwd: path.join(cwd, 'android'), stdio: 'inherit' });
      console.log(pc.green('✔ Gradle clean completed.'));
    } catch (err) {
      console.log(pc.yellow('⚠ Gradle clean failed. Skiped.'));
    }
  }

  console.log(pc.bold(pc.green('\n✔ Clean completed successfully!')));
}
