import path from 'path';
import fs from 'fs-extra';
import prompts from 'prompts';
import pc from 'picocolors';

export async function handleInit(cwd: string) {
  console.log(pc.cyan('\nWelcome to React Native Flavor Manager (RNFM)!\n'));

  // Prompt the user for questions
  const responses = await prompts([
    {
      type: 'number',
      name: 'flavorCount',
      message: 'How many flavors?',
      initial: 2,
      min: 1,
    },
    {
      type: (prev) => 'text',
      name: 'flavorNames',
      message: 'Flavor names (comma-separated):',
      initial: (prev: number) => {
        if (prev === 2) return 'dev, production';
        if (prev === 3) return 'dev, qa, production';
        if (prev === 4) return 'dev, qa, uat, production';
        return Array.from({ length: prev }, (_, i) => `flavor${i + 1}`).join(', ');
      },
    },
    {
      type: 'confirm',
      name: 'android',
      message: 'Enable Android Support?',
      initial: true,
    },
    {
      type: 'confirm',
      name: 'ios',
      message: 'Enable iOS Support?',
      initial: true,
    },
    {
      type: 'confirm',
      name: 'firebase',
      message: 'Enable Firebase Configs?',
      initial: false,
    },
    {
      type: 'confirm',
      name: 'envVars',
      message: 'Enable Environment Variables?',
      initial: true,
    },
  ]);

  if (!responses.flavorNames) {
    console.log(pc.red('\nInitialization cancelled.'));
    return;
  }

  const flavorNames = responses.flavorNames
    .split(',')
    .map((name: string) => name.trim().toLowerCase())
    .filter((name: string) => name.length > 0);

  if (flavorNames.length === 0) {
    console.log(pc.red('\nNo valid flavor names provided.'));
    return;
  }

  // Generate the configuration file string
  let configContent = `export default {\n  flavors: {\n`;
  for (const name of flavorNames) {
    const isProduction = name === 'production';
    configContent += `    ${name}: {\n`;
    configContent += `      appName: "My App${isProduction ? '' : ' ' + name.toUpperCase()}",\n`;
    if (responses.android) {
      configContent += `      packageName: "com.demo.${name === 'production' ? 'app' : name}",\n`;
    }
    if (responses.ios) {
      configContent += `      bundleId: "com.demo.${name === 'production' ? 'app' : name}",\n`;
    }
    if (responses.envVars) {
      configContent += `      apiUrl: "https://${name}.api.com",\n`;
    }
    configContent += `    },\n`;
  }
  configContent += `  }\n};\n`;

  // Create baseline files and directories
  const targetConfigPath = path.join(cwd, 'flavors.config.ts');
  if (fs.existsSync(targetConfigPath)) {
    const { overwrite } = await prompts({
      type: 'confirm',
      name: 'overwrite',
      message: 'flavors.config.ts already exists. Overwrite?',
      initial: false,
    });
    if (!overwrite) {
      console.log(pc.yellow('\nConfig file generation skipped.'));
    } else {
      await fs.writeFile(targetConfigPath, configContent, 'utf8');
      console.log(pc.green(`✔ Created flavors.config.ts`));
    }
  } else {
    await fs.writeFile(targetConfigPath, configContent, 'utf8');
    console.log(pc.green(`✔ Created flavors.config.ts`));
  }

  // Create directories
  const directories = ['assets', 'icons', 'plugins'];
  if (responses.firebase) {
    directories.push('firebase');
    // Also bootstrap nested folders in firebase directory
    for (const name of flavorNames) {
      directories.push(path.join('firebase', name));
    }
  }
  if (responses.envVars) {
    directories.push('environments');
  }

  for (const dir of directories) {
    const fullPath = path.join(cwd, dir);
    await fs.ensureDir(fullPath);
    console.log(pc.green(`✔ Created directory ./${dir}`));
  }

  console.log(pc.bold(pc.green('\nDone. Project successfully initialized!')));
  console.log('You can now run ' + pc.yellow('npx rn-flavors generate') + ' to apply the configuration.\n');
}
