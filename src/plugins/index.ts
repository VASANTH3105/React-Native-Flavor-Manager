import path from 'path';
import fs from 'fs-extra';
import pc from 'picocolors';
import type { Plugin, PluginContext } from '../types.js';
import { findXcodeProject } from '../generators/ios.js';

export function firebase(): Plugin {
  return {
    name: 'firebase',
    onGenerate: async (ctx: PluginContext) => {
      const { cwd, flavorName, isDryRun } = ctx;
      const firebaseBaseDir = path.join(cwd, 'firebase');
      if (!fs.existsSync(firebaseBaseDir)) return;

      // 1. Android google-services.json
      const androidSrc = path.join(firebaseBaseDir, flavorName, 'google-services.json');
      const androidDest = path.join(cwd, 'android', 'app', 'src', flavorName, 'google-services.json');

      if (fs.existsSync(androidSrc)) {
        if (isDryRun) {
          console.log(pc.gray(`  [Plugin: firebase] Copy firebase/${flavorName}/google-services.json -> android/app/src/${flavorName}/google-services.json`));
        } else {
          await fs.ensureDir(path.dirname(androidDest));
          await fs.copy(androidSrc, androidDest, { overwrite: true });
          console.log(pc.green(`✔ [firebase] Copied Android config for flavor '${flavorName}'`));
        }
      }

      // 2. iOS GoogleService-Info.plist
      const iosSrc = path.join(firebaseBaseDir, flavorName, 'GoogleService-Info.plist');
      const xcodeInfo = findXcodeProject(cwd);
      if (xcodeInfo && fs.existsSync(iosSrc)) {
        const { projectName } = xcodeInfo;
        const iosDest = path.join(cwd, 'ios', projectName, 'GoogleService-Info.plist');

        if (isDryRun) {
          console.log(pc.gray(`  [Plugin: firebase] Copy firebase/${flavorName}/GoogleService-Info.plist -> ios/${projectName}/GoogleService-Info.plist`));
        } else {
          await fs.ensureDir(path.dirname(iosDest));
          await fs.copy(iosSrc, iosDest, { overwrite: true });
          console.log(pc.green(`✔ [firebase] Copied iOS config for flavor '${flavorName}'`));
        }
      }
    },
    onClean: async (ctx: PluginContext) => {
      const { cwd, flavorName } = ctx;
      const xcodeInfo = findXcodeProject(cwd);
      if (xcodeInfo) {
        const { projectName } = xcodeInfo;
        const iosDest = path.join(cwd, 'ios', projectName, 'GoogleService-Info.plist');
        if (fs.existsSync(iosDest)) {
          await fs.remove(iosDest);
          console.log(pc.green('✔ [firebase] Removed GoogleService-Info.plist'));
        }
      }
    }
  };
}

export interface SentryConfig {
  org?: string;
  project?: string;
  authToken?: string;
  url?: string;
}

export function sentry(options: SentryConfig = {}): Plugin {
  return {
    name: 'sentry',
    onGenerate: async (ctx: PluginContext) => {
      const { cwd, flavorName, isDryRun } = ctx;
      
      const propertiesContent = [
        `defaults.url=${options.url || 'https://sentry.io/'}`,
        `defaults.org=${options.org || 'mock-org'}`,
        `defaults.project=${options.project || 'mock-project'}`,
        `auth.token=${options.authToken || 'mock-auth-token'}`,
        `cli.executable=node_modules/@sentry/cli/bin/sentry-cli`
      ].join('\n') + '\n';

      const paths = [
        path.join(cwd, 'android', 'sentry.properties'),
        path.join(cwd, 'ios', 'sentry.properties')
      ];

      for (const p of paths) {
        if (isDryRun) {
          console.log(pc.gray(`  [Plugin: sentry] Create ${path.relative(cwd, p)}`));
        } else {
          await fs.ensureDir(path.dirname(p));
          await fs.writeFile(p, propertiesContent, 'utf8');
          console.log(pc.green(`✔ [sentry] Generated ${path.relative(cwd, p)}`));
        }
      }
    },
    onClean: async (ctx: PluginContext) => {
      const { cwd } = ctx;
      const paths = [
        path.join(cwd, 'android', 'sentry.properties'),
        path.join(cwd, 'ios', 'sentry.properties')
      ];
      for (const p of paths) {
        if (fs.existsSync(p)) {
          await fs.remove(p);
          console.log(pc.green(`✔ [sentry] Removed ${path.relative(cwd, p)}`));
        }
      }
    }
  };
}

export interface OneSignalConfig {
  appId?: string;
}

export function oneSignal(options: OneSignalConfig = {}): Plugin {
  return {
    name: 'oneSignal',
    onGenerate: async (ctx: PluginContext) => {
      const { cwd, isDryRun, flavorName } = ctx;
      const appId = options.appId || 'default-onesignal-app-id';

      // Writes OneSignal config to environments folder
      const configPath = path.join(cwd, 'environments', `onesignal.${flavorName}.json`);

      if (isDryRun) {
        console.log(pc.gray(`  [Plugin: oneSignal] Generate environments/onesignal.${flavorName}.json`));
      } else {
        await fs.ensureDir(path.dirname(configPath));
        await fs.writeJSON(configPath, { appId }, { spaces: 2 });
        console.log(pc.green(`✔ [oneSignal] Generated environments/onesignal.${flavorName}.json`));
      }
    },
    onClean: async (ctx: PluginContext) => {
      const { cwd, flavorName } = ctx;
      const configPath = path.join(cwd, 'environments', `onesignal.${flavorName}.json`);
      if (fs.existsSync(configPath)) {
        await fs.remove(configPath);
        console.log(pc.green(`✔ [oneSignal] Removed environments/onesignal.${flavorName}.json`));
      }
    }
  };
}
