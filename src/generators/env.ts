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

  // Dynamically update package name in react-native.config.js to allow running without --appId
  try {
    const { loadConfig, normalizeConfig } = await import('../config/config-loader.js');
    const loaded = await loadConfig(cwd);
    const normalized = normalizeConfig(loaded.config);
    const flavor = normalized.flavors[flavorName];

    if (flavor && flavor.packageName) {
      const configJsPath = path.join(cwd, 'react-native.config.js');
      const targetPackageName = flavor.packageName;

      if (dryRun) {
        console.log(pc.gray(`  Update react-native.config.js target package -> '${targetPackageName}'`));
      } else {
        if (!fs.existsSync(configJsPath)) {
          const defaultContent = [
            'module.exports = {',
            '  project: {',
            '    android: {',
            `      packageName: '${targetPackageName}',`,
            '    },',
            '  },',
            '};',
            ''
          ].join('\n');
          await fs.writeFile(configJsPath, defaultContent, 'utf8');
          console.log(pc.green(`✔ Created react-native.config.js with active package name '${targetPackageName}'`));
        } else {
          let content = await fs.readFile(configJsPath, 'utf8');
          const packageNameRegex = /(packageName:\s*['"])([^'"]+)(['"])/;

          if (packageNameRegex.test(content)) {
            // Update existing packageName
            content = content.replace(packageNameRegex, `$1${targetPackageName}$3`);
            await fs.writeFile(configJsPath, content, 'utf8');
            console.log(pc.green(`✔ Updated react-native.config.js active package name to '${targetPackageName}'`));
          } else {
            // If react-native.config.js exists but doesn't have packageName, inject it safely using comment boundaries
            const boundaryStart = '// RNFM_START';
            const boundaryEnd = '// RNFM_END';
            const injectContent = `\n  ${boundaryStart}\n  project: {\n    android: {\n      packageName: '${targetPackageName}',\n    },\n  },\n  ${boundaryEnd}`;

            if (content.includes(boundaryStart)) {
              // Replace existing RNFM block
              const startIdx = content.indexOf(boundaryStart);
              const endIdx = content.indexOf(boundaryEnd) + boundaryEnd.length;
              content = content.substring(0, startIdx) + boundaryStart + `\n  project: {\n    android: {\n      packageName: '${targetPackageName}',\n    },\n  },\n  ` + boundaryEnd + content.substring(endIdx);
            } else {
              // Inject before the closing bracket of module.exports
              const exportsMatch = content.match(/(module\.exports\s*=\s*\{)/);
              if (exportsMatch && exportsMatch[1]) {
                const idx = content.indexOf(exportsMatch[1]) + exportsMatch[1].length;
                content = content.substring(0, idx) + injectContent + ',' + content.substring(idx);
              } else {
                // Fallback: append to end of file
                content += `\n${injectContent}\n`;
              }
            }
            await fs.writeFile(configJsPath, content, 'utf8');
            console.log(pc.green(`✔ Injected active package name '${targetPackageName}' into react-native.config.js`));
          }
        }
      }
    }
  } catch (err: any) {
    // Fail silently if config loading fails in dryRun or tests
  }
}
