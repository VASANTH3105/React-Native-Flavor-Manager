import path from 'path';
import fs from 'fs-extra';
import pc from 'picocolors';

export async function handleImport(cwd: string) {
  console.log(pc.cyan('\nScanning project files for existing flavor configurations...'));

  const gradlePath = path.join(cwd, 'android', 'app', 'build.gradle');
  const flavors: Record<string, any> = {};

  if (fs.existsSync(gradlePath)) {
    try {
      const content = await fs.readFile(gradlePath, 'utf8');

      // Slice the content to only scan inside and after productFlavors block, preventing matching 'productFlavors' itself
      const pIdx = content.indexOf('productFlavors');
      const searchContent = pIdx !== -1 ? content.substring(pIdx + 'productFlavors'.length) : content;

      // Match blocks like:
      // flavorName {
      //     applicationId "..."
      //     versionName "..."
      //     versionCode ...
      // }
      const flavorRegex = /([a-zA-Z0-9_]+)\s*\{\s*([^}]*?applicationId\s*["']([^"']+)["'][^}]*?)\}/g;
      let match;
      while ((match = flavorRegex.exec(searchContent)) !== null) {
        const flavorName = match[1];
        const flavorBody = match[2];
        const appId = match[3];

        if (flavorName === 'defaultConfig' || flavorName === 'buildTypes' || flavorName === 'android') {
          continue;
        }

        const versionNameMatch = flavorBody.match(/versionName\s*["']([^"']+)["']/);
        const versionCodeMatch = flavorBody.match(/versionCode\s+(\d+)/);
        
        flavors[flavorName] = {
          appName: `App ${flavorName.toUpperCase()}`,
          packageName: appId,
          version: versionNameMatch ? versionNameMatch[1] : '1.0.0',
          versionCode: versionCodeMatch ? parseInt(versionCodeMatch[1], 10) : 1,
          env: {
            apiUrl: `https://${flavorName}.api.com`
          }
        };
      }
    } catch (err: any) {
      console.log(pc.yellow(`⚠ Could not parse existing build.gradle productFlavors: ${err.message}`));
    }
  }

  // If no flavors were parsed, provide some defaults
  if (Object.keys(flavors).length === 0) {
    console.log(pc.yellow('No existing product flavors found. Initializing with default templates.'));
    flavors.dev = {
      appName: 'App Dev',
      packageName: 'com.demo.dev',
      version: '1.0.0',
      versionCode: 1,
      env: {
        apiUrl: 'https://dev.api.com'
      }
    };
    flavors.production = {
      appName: 'App Live',
      packageName: 'com.demo.app',
      version: '1.0.0',
      versionCode: 1,
      env: {
        apiUrl: 'https://api.com'
      }
    };
  }

  const configContent = `export default {\n  flavors: ${JSON.stringify(flavors, null, 2).replace(/\n/g, '\n  ')}\n};\n`;
  const configPath = path.join(cwd, 'flavors.config.ts');

  await fs.writeFile(configPath, configContent, 'utf8');
  console.log(pc.green(`✔ Successfully generated flavors.config.ts from import scan.`));

  // Bootstrap baseline folders
  const folders = ['icons', 'firebase', 'environments', 'plugins', 'assets'];
  for (const f of folders) {
    await fs.ensureDir(path.join(cwd, f));
    // For each flavor, ensure an icon folder exists
    if (f === 'icons' || f === 'firebase') {
      for (const flavorName of Object.keys(flavors)) {
        await fs.ensureDir(path.join(cwd, f, flavorName));
      }
    }
  }

  console.log(pc.bold(pc.green('\nMigration complete! Baseline assets folders bootstrapped.')));
  console.log('Ensure you place your source icons in ' + pc.yellow('icons/[flavorName]/icon.png') + ' before running generate.\n');
}
