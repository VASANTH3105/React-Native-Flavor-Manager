import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import pc from 'picocolors';
import type { DoctorResult } from '../types.js';

function runCmd(cmd: string): string | null {
  try {
    return execSync(cmd, { stdio: 'pipe' }).toString().trim();
  } catch {
    return null;
  }
}

export async function handleDoctor(cwd: string) {
  console.log(pc.cyan('\nRunning environment doctor check...\n'));

  const results: DoctorResult[] = [];

  // 1. React Native CLI Check
  const pkgJsonPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = await fs.readJSON(pkgJsonPath);
      const rnVersion = pkg.dependencies?.['react-native'] || pkg.devDependencies?.['react-native'];
      if (rnVersion) {
        results.push({
          title: 'React Native',
          status: 'success',
          message: `Installed (${rnVersion})`,
        });
      } else {
        results.push({
          title: 'React Native',
          status: 'warning',
          message: 'Not found in package.json dependencies',
        });
      }
    } catch {
      results.push({
        title: 'React Native',
        status: 'error',
        message: 'Could not read package.json',
      });
    }
  } else {
    results.push({
      title: 'React Native',
      status: 'error',
      message: 'No package.json found in current directory',
    });
  }

  // 2. Android SDK Check
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (androidHome && fs.existsSync(androidHome)) {
    results.push({
      title: 'Android SDK',
      status: 'success',
      message: `Installed (${androidHome})`,
    });
  } else {
    // Try standard locations
    const home = process.env.HOME || '';
    const standardPaths = [
      path.join(home, 'Library/Android/sdk'),
      '/Library/Android/sdk',
      path.join(home, 'AppData/Local/Android/Sdk'),
    ];
    let foundPath = null;
    for (const p of standardPaths) {
      if (p && fs.existsSync(p)) {
        foundPath = p;
        break;
      }
    }

    if (foundPath) {
      results.push({
        title: 'Android SDK',
        status: 'success',
        message: `Found at default location (${foundPath})`,
      });
    } else {
      results.push({
        title: 'Android SDK',
        status: 'error',
        message: 'Not found. Please set ANDROID_HOME environment variable.',
      });
    }
  }

  // 3. Java Version Check
  const javaVersionOutput = runCmd('java -version 2>&1');
  if (javaVersionOutput) {
    const versionMatch = javaVersionOutput.match(/version "([^"]+)"/) || javaVersionOutput.match(/openjdk version "([^"]+)"/);
    const ver = versionMatch ? versionMatch[1] : 'Unknown';
    results.push({
      title: 'Java JDK',
      status: 'success',
      message: `Installed (${ver})`,
    });
  } else {
    results.push({
      title: 'Java JDK',
      status: 'error',
      message: 'Not found. Ensure Java is installed and in your PATH.',
    });
  }

  // 4. CocoaPods Check (Only relevant on macOS)
  if (process.platform === 'darwin') {
    const podVersion = runCmd('pod --version');
    if (podVersion) {
      results.push({
        title: 'CocoaPods',
        status: 'success',
        message: `Installed (${podVersion})`,
      });
    } else {
      results.push({
        title: 'CocoaPods',
        status: 'warning',
        message: 'Not installed or not in PATH (Required for iOS development)',
      });
    }

    // Xcode Check
    const xcodeOutput = runCmd('xcodebuild -version');
    if (xcodeOutput) {
      const lines = xcodeOutput.split('\n');
      const version = lines[0] || 'Unknown';
      results.push({
        title: 'Xcode',
        status: 'success',
        message: `Installed (${version})`,
      });
    } else {
      results.push({
        title: 'Xcode',
        status: 'warning',
        message: 'Not found (Required for iOS development)',
      });
    }
  }

  // 5. Gradle Check
  const gradlewAndroid = path.join(cwd, 'android', 'gradlew');
  if (fs.existsSync(gradlewAndroid)) {
    results.push({
      title: 'Gradle Wrapper',
      status: 'success',
      message: 'Found gradle wrapper in ./android',
    });
  } else {
    const gradleVersion = runCmd('gradle --version');
    if (gradleVersion) {
      const match = gradleVersion.match(/Gradle\s+([\d.]+)/);
      const ver = match ? match[1] : 'Unknown';
      results.push({
        title: 'Gradle (Global)',
        status: 'warning',
        message: `Found global Gradle (${ver}), but no local gradle wrapper found in ./android`,
      });
    } else {
      results.push({
        title: 'Gradle wrapper',
        status: 'warning',
        message: 'Not found in ./android',
      });
    }
  }

  // Print results
  let hasErrors = false;
  for (const res of results) {
    let icon = '';
    let colorize = (text: string) => text;

    if (res.status === 'success') {
      icon = pc.green('✔');
      colorize = pc.green;
    } else if (res.status === 'warning') {
      icon = pc.yellow('⚠');
      colorize = pc.yellow;
    } else {
      icon = pc.red('✖');
      colorize = pc.red;
      hasErrors = true;
    }

    console.log(`${icon} ${pc.bold(res.title)}: ${colorize(res.message)}`);
  }

  if (hasErrors) {
    console.log(pc.red('\n✖ Some compatibility checks failed. Please fix them.'));
  } else {
    console.log(pc.green('\n✔ All essential system configurations are healthy!'));
  }
}
