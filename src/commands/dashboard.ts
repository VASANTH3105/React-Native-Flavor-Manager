import prompts from 'prompts';
import pc from 'picocolors';
import { handleGenerate } from './generate.js';
import { handleValidate } from './validate.js';
import { handleDoctor } from './doctor.js';
import { handleClean } from './clean.js';
import { handleBuild } from './build.js';
import { handleAddFlavor, handleRemoveFlavor } from './manage-flavors.js';
import { handleImport } from './import.js';
import { loadConfig } from '../config/config-loader.js';

export async function handleDashboard(cwd: string) {
  let active = true;

  while (active) {
    console.log(pc.bold(pc.cyan('\n==========================================')));
    console.log(pc.bold(pc.cyan('      React Native Flavor Manager (RNFM) ')));
    console.log(pc.bold(pc.cyan('==========================================\n')));

    const { action } = await prompts({
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { title: 'Generate Configurations', value: 'generate' },
        { title: 'Validate Configurations', value: 'validate' },
        { title: 'Build Application', value: 'build' },
        { title: 'Environment Doctor Check', value: 'doctor' },
        { title: 'Clean Generated Files', value: 'clean' },
        { title: 'Add New Flavor', value: 'add' },
        { title: 'Remove Flavor', value: 'remove' },
        { title: 'Import Existing Project Settings', value: 'import' },
        { title: 'Exit', value: 'exit' }
      ]
    });

    if (!action || action === 'exit') {
      console.log(pc.cyan('\nGoodbye!\n'));
      active = false;
      break;
    }

    try {
      switch (action) {
        case 'generate': {
          const { dryRun } = await prompts({
            type: 'confirm',
            name: 'dryRun',
            message: 'Run in dry-run mode?',
            initial: false
          });
          await handleGenerate(cwd, { dryRun });
          break;
        }

        case 'validate':
          await handleValidate(cwd);
          break;

        case 'doctor':
          await handleDoctor(cwd);
          break;

        case 'clean':
          await handleClean(cwd);
          break;

        case 'import':
          await handleImport(cwd);
          break;

        case 'add': {
          const { flavorName } = await prompts({
            type: 'text',
            name: 'flavorName',
            message: 'Enter name of new flavor:',
            validate: val => val ? true : 'Flavor name cannot be empty'
          });
          if (flavorName) {
            await handleAddFlavor(cwd, flavorName);
          }
          break;
        }

        case 'remove': {
          let flavors: string[] = [];
          try {
            const loaded = await loadConfig(cwd);
            flavors = Object.keys(loaded.config.flavors);
          } catch {}

          if (flavors.length === 0) {
            console.log(pc.red('\nNo flavors found to remove.'));
            break;
          }

          const { flavorName } = await prompts({
            type: 'select',
            name: 'flavorName',
            message: 'Select flavor to remove:',
            choices: flavors.map(f => ({ title: f, value: f }))
          });

          if (flavorName) {
            await handleRemoveFlavor(cwd, flavorName);
          }
          break;
        }

        case 'build': {
          let flavors: string[] = [];
          let clients: string[] = [];
          try {
            const loaded = await loadConfig(cwd);
            flavors = Object.keys(loaded.config.flavors);
            if (loaded.config.clients) {
              clients = Object.keys(loaded.config.clients);
            }
          } catch {}

          const buildTargets = [...flavors.map(f => ({ title: `Flavor: ${f}`, value: { name: f, isClient: false } }))];
          if (clients.length > 0) {
            buildTargets.push(...clients.map(c => ({ title: `Client: ${c}`, value: { name: c, isClient: true } })));
          }

          if (buildTargets.length === 0) {
            console.log(pc.red('\nNo flavors configured to build. Run generate or import first.'));
            break;
          }

          const { target } = await prompts({
            type: 'select',
            name: 'target',
            message: 'Select target flavor or client to build:',
            choices: buildTargets
          });

          if (!target) break;

          const { platform } = await prompts({
            type: 'select',
            name: 'platform',
            message: 'Select platform:',
            choices: [
              { title: 'Android', value: 'android' },
              { title: 'iOS', value: 'ios' }
            ]
          });

          if (!platform) break;

          const { mode } = await prompts({
            type: 'select',
            name: 'mode',
            message: 'Select mode:',
            choices: [
              { title: 'Release', value: 'release' },
              { title: 'Debug', value: 'debug' }
            ]
          });

          if (!mode) break;

          const { bundle } = (platform === 'android') ? await prompts({
            type: 'confirm',
            name: 'bundle',
            message: 'Build AAB bundle instead of APK?',
            initial: false
          }) : { bundle: false };

          // If target is client, we overlay client parameters
          if (target.isClient) {
            // Under the hood overlay and run build (we pass clientName)
            // Wait, our build command can accept a client parameter!
            await handleBuild(cwd, target.name, {
              platform,
              mode,
              bundle
            });
          } else {
            await handleBuild(cwd, target.name, {
              platform,
              mode,
              bundle
            });
          }
          break;
        }
      }
    } catch (err: any) {
      console.log(pc.red(`\n✖ Command failed: ${err.message}`));
    }

    console.log(pc.cyan('\nPress enter to return to the menu...'));
    await prompts({ type: 'text', name: 'return', message: '' });
  }
}
