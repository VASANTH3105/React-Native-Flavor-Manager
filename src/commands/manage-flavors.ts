import path from 'path';
import fs from 'fs-extra';
import pc from 'picocolors';
import { loadConfig } from '../config/config-loader.js';
import { handleGenerate } from './generate.js';

export async function handleAddFlavor(cwd: string, flavorName: string) {
  const cleanName = flavorName.trim().toLowerCase();
  if (!/^[a-zA-Z0-9]+$/.test(cleanName)) {
    console.log(pc.red(`\n✖ Invalid flavor name '${flavorName}'. Must be strictly alphanumeric.`));
    process.exit(1);
  }

  let loaded;
  try {
    loaded = await loadConfig(cwd);
  } catch (error: any) {
    console.log(pc.red(`\n✖ Error loading config:\n${error.message}\n`));
    process.exit(1);
  }

  const { config, filepath, filename } = loaded;

  if (config.flavors[cleanName]) {
    console.log(pc.yellow(`\n⚠ Flavor '${cleanName}' already exists in configuration.`));
    return;
  }

  // Add new flavor definition
  config.flavors[cleanName] = {
    appName: `My App ${cleanName.toUpperCase()}`,
    packageName: `com.demo.${cleanName}`,
    bundleId: `com.demo.${cleanName}`,
    version: '1.0.0',
    versionCode: 1,
    env: {
      apiUrl: `https://${cleanName}.api.com`
    }
  };

  // Write config back
  await writeConfigBack(filepath, filename, config);
  console.log(pc.green(`✔ Added flavor '${cleanName}' to ${filename}`));

  // Create baseline folders
  const pathsToCreate = [
    path.join(cwd, 'icons', cleanName),
    path.join(cwd, 'firebase', cleanName),
    path.join(cwd, 'environments')
  ];

  for (const p of pathsToCreate) {
    await fs.ensureDir(p);
  }
  console.log(pc.green(`✔ Created directories for flavor '${cleanName}'`));

  // Run generation automatically to synchronize changes
  console.log(pc.cyan('\nSynchronizing configuration changes...'));
  await handleGenerate(cwd);
}

export async function handleRemoveFlavor(cwd: string, flavorName: string) {
  const cleanName = flavorName.trim().toLowerCase();

  let loaded;
  try {
    loaded = await loadConfig(cwd);
  } catch (error: any) {
    console.log(pc.red(`\n✖ Error loading config:\n${error.message}\n`));
    process.exit(1);
  }

  const { config, filepath, filename } = loaded;

  if (!config.flavors[cleanName]) {
    console.log(pc.red(`\n✖ Flavor '${cleanName}' not found in configuration.`));
    return;
  }

  // Remove flavor definition
  delete config.flavors[cleanName];

  // Write config back
  await writeConfigBack(filepath, filename, config);
  console.log(pc.green(`✔ Removed flavor '${cleanName}' from ${filename}`));

  // Remove flavor icon folder
  const iconFolder = path.join(cwd, 'icons', cleanName);
  if (fs.existsSync(iconFolder)) {
    await fs.remove(iconFolder);
    console.log(pc.green(`✔ Removed directory: icons/${cleanName}`));
  }

  // Remove flavor firebase folder
  const firebaseFolder = path.join(cwd, 'firebase', cleanName);
  if (fs.existsSync(firebaseFolder)) {
    await fs.remove(firebaseFolder);
    console.log(pc.green(`✔ Removed directory: firebase/${cleanName}`));
  }

  // Run generation automatically to synchronize changes
  console.log(pc.cyan('\nSynchronizing configuration changes...'));
  await handleGenerate(cwd);
}

async function writeConfigBack(filepath: string, filename: string, config: any) {
  if (filename.endsWith('.json')) {
    await fs.writeJSON(filepath, config, { spaces: 2 });
  } else {
    // Write back as TS/JS export default
    const fileContent = `export default ${JSON.stringify(config, null, 2)};\n`;
    await fs.writeFile(filepath, fileContent, 'utf8');
  }
}
