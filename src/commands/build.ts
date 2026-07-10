import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import pc from 'picocolors';
import { loadConfig, normalizeConfig } from '../config/config-loader.js';
import { activateEnvironment } from '../generators/env.js';
import { findXcodeProject, activateIOSConfig } from '../generators/ios.js';
import { applyClientOverlay } from '../generators/white-label.js';
import { handleGenerate } from './generate.js';

export interface BuildOptions {
  platform?: 'android' | 'ios';
  mode?: 'debug' | 'release';
  bundle?: boolean;
}

export async function handleBuild(cwd: string, flavorOrClientName: string, options: BuildOptions = {}) {
  const platform = options.platform || 'android';
  const mode = options.mode || 'release';

  let loaded;
  try {
    loaded = await loadConfig(cwd);
  } catch (error: any) {
    console.log(pc.red(`\n✖ Error loading config:\n${error.message}\n`));
    process.exit(1);
  }

  let { config } = loaded;

  // Check if it's a client name or flavor name
  const isClient = config.clients && Object.keys(config.clients).some(c => c.toLowerCase() === flavorOrClientName.toLowerCase());
  let targetFlavorName = flavorOrClientName;

  if (isClient) {
    const matchedClient = Object.keys(config.clients).find(c => c.toLowerCase() === flavorOrClientName.toLowerCase())!;
    
    // 1. Overlay client configurations and run generate to synchronize native projects
    console.log(pc.cyan(`\nBuilding Client '${matchedClient}'...`));
    await handleGenerate(cwd, { clientName: matchedClient });
    
    // Reload overlay config to get updated flavors
    const reloaded = await loadConfig(cwd);
    config = await applyClientOverlay(cwd, reloaded.config, { clientName: matchedClient });
    
    // Default to build the first flavor for this client (e.g. production)
    targetFlavorName = Object.keys(config.flavors)[0] || 'production';
  }

  const normalized = normalizeConfig(config);
  const flavorNames = Object.keys(normalized.flavors);
  const matchedFlavor = flavorNames.find(f => f.toLowerCase() === targetFlavorName.toLowerCase());

  if (!matchedFlavor) {
    console.log(pc.red(`\n✖ Flavor '${targetFlavorName}' not found in configuration.`));
    console.log(`Available flavors: ${flavorNames.join(', ')}\n`);
    process.exit(1);
  }

  // 2. Activate environment variables for the target flavor
  console.log(pc.cyan(`\nActivating environment for '${matchedFlavor}'...`));
  await activateEnvironment(cwd, matchedFlavor);

  if (platform === 'android') {
    await buildAndroid(cwd, matchedFlavor, mode, !!options.bundle);
  } else if (platform === 'ios') {
    await buildIOS(cwd, matchedFlavor, mode);
  } else {
    console.log(pc.red(`\n✖ Unsupported platform '${platform}'. Supported platforms: android, ios`));
    process.exit(1);
  }
}

async function buildAndroid(cwd: string, flavorName: string, mode: string, bundle: boolean) {
  const buildType = bundle ? 'bundle' : 'assemble';
  const gradlewPath = path.join(cwd, 'android', 'gradlew');
  const isWindows = process.platform === 'win32';
  const gradleBin = isWindows ? 'gradlew.bat' : './gradlew';

  if (!fs.existsSync(gradlewPath)) {
    console.log(pc.red(`\n✖ Gradle wrapper not found at ${gradlewPath}.`));
    console.log('Ensure you are running build inside a valid React Native project root.\n');
    process.exit(1);
  }

  // Convert flavor name to Gradle target (e.g. dev -> Dev, production -> Production)
  const camelFlavor = flavorName.charAt(0).toUpperCase() + flavorName.slice(1);
  const camelMode = mode.charAt(0).toUpperCase() + mode.slice(1);
  const gradleTask = `${buildType}${camelFlavor}${camelMode}`;

  console.log(pc.cyan(`\nStarting Android build for flavor '${flavorName}' (${mode} mode)...`));
  console.log(pc.yellow(`Running: ${gradleBin} ${gradleTask} inside ./android\n`));

  // Spawn gradle command stream
  const gradleProcess = spawn(gradleBin, [gradleTask], {
    cwd: path.join(cwd, 'android'),
    stdio: 'inherit',
    shell: true,
  });

  gradleProcess.on('close', (code) => {
    if (code === 0) {
      console.log(pc.bold(pc.green(`\n✔ Android Build completed successfully! (Task: ${gradleTask})`)));
    } else {
      console.log(pc.bold(pc.red(`\n✖ Android Build failed with exit code ${code}.`)));
      process.exit(code || 1);
    }
  });
}

async function buildIOS(cwd: string, flavorName: string, mode: string) {
  const xcodeInfo = findXcodeProject(cwd);
  if (!xcodeInfo) {
    console.log(pc.red(`\n✖ Xcode project directory not found. iOS build is only supported on macOS.\n`));
    process.exit(1);
  }

  const { projectName } = xcodeInfo;

  // 1. Activate iOS configuration values inside RNFMConfig.xcconfig
  await activateIOSConfig(cwd, flavorName);

  // 2. Resolve target Scheme & Configurations
  const schemeName = `${projectName}-${flavorName}`;
  const camelMode = mode.charAt(0).toUpperCase() + mode.slice(1);

  // Check if workspace exists
  const workspacePath = path.join(cwd, 'ios', `${projectName}.xcworkspace`);
  const useWorkspace = fs.existsSync(workspacePath);

  const xcodebuildArgs = [
    useWorkspace ? '-workspace' : '-project',
    useWorkspace ? `ios/${projectName}.xcworkspace` : `ios/${projectName}.xcodeproj`,
    '-scheme',
    schemeName,
    '-configuration',
    camelMode,
    '-sdk',
    'iphonesimulator',
  ];

  console.log(pc.cyan(`\nStarting iOS build for flavor '${flavorName}' (${mode} mode)...`));
  console.log(pc.yellow(`Running: xcodebuild ${xcodebuildArgs.join(' ')}\n`));

  const xcodebuildProcess = spawn('xcodebuild', xcodebuildArgs, {
    cwd,
    stdio: 'inherit',
  });

  xcodebuildProcess.on('close', (code) => {
    if (code === 0) {
      console.log(pc.bold(pc.green(`\n✔ iOS Build completed successfully! (Scheme: ${schemeName})`)));
    } else {
      console.log(pc.bold(pc.red(`\n✖ iOS Build failed with exit code ${code}.`)));
      process.exit(code || 1);
    }
  });
}
