import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import { generateAndroid } from '../generators/android.js';
import type { AppConfig } from '../types.js';

describe('Android Flavor Generator Tests', () => {
  const sandboxDir = path.join(__dirname, 'sandbox');

  beforeEach(async () => {
    await fs.ensureDir(sandboxDir);
  });

  afterEach(async () => {
    await fs.remove(sandboxDir);
  });

  it('should inject flavor config into build.gradle and edit AndroidManifest.xml', async () => {
    const mockGradleContent = `
apply plugin: "com.android.application"

android {
    compileSdkVersion 34

    defaultConfig {
        applicationId "com.example.app"
        minSdkVersion 21
        targetSdkVersion 34
    }
}
    `.trim();

    const mockManifestContent = `
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application
        android:name=".MainApplication"
        android:label="@string/app_name">
    </application>
</manifest>
    `.trim();

    const androidAppDir = path.join(sandboxDir, 'android', 'app');
    const manifestDir = path.join(androidAppDir, 'src', 'main');

    await fs.ensureDir(manifestDir);
    await fs.writeFile(path.join(androidAppDir, 'build.gradle'), mockGradleContent, 'utf8');
    await fs.writeFile(path.join(manifestDir, 'AndroidManifest.xml'), mockManifestContent, 'utf8');

    const config: AppConfig = {
      flavors: {
        dev: {
          appName: 'App Dev',
          packageName: 'com.example.app.dev',
          version: '1.0.0',
          versionCode: 1,
        },
        production: {
          appName: 'App Live',
          packageName: 'com.example.app.prod',
          version: '2.0.0',
          versionCode: 2,
        },
      },
    };

    // Run generator
    await generateAndroid(sandboxDir, config);

    // Read outputs
    const newGradle = await fs.readFile(path.join(androidAppDir, 'build.gradle'), 'utf8');
    const newManifest = await fs.readFile(path.join(manifestDir, 'AndroidManifest.xml'), 'utf8');

    // Assertions for build.gradle
    expect(newGradle).toContain('// RNFM_START');
    expect(newGradle).toContain('flavorDimensions "default"');
    expect(newGradle).toContain('dev {');
    expect(newGradle).toContain('applicationId "com.example.app.dev"');
    expect(newGradle).toContain('manifestPlaceholders = [appName: "App Dev"]');
    expect(newGradle).toContain('production {');
    expect(newGradle).toContain('applicationId "com.example.app.prod"');
    expect(newGradle).toContain('manifestPlaceholders = [appName: "App Live"]');
    expect(newGradle).toContain('// RNFM_END');

    // Assertions for AndroidManifest.xml
    expect(newManifest).toContain('android:label="${appName}"');
    expect(newManifest).not.toContain('android:label="@string/app_name"');

    // Test Idempotency: Run it a second time and check it does not add duplicate configurations
    const gradleBeforeSecondRun = newGradle;
    await generateAndroid(sandboxDir, config);
    const gradleAfterSecondRun = await fs.readFile(path.join(androidAppDir, 'build.gradle'), 'utf8');
    expect(gradleAfterSecondRun).toBe(gradleBeforeSecondRun);
  });
});
