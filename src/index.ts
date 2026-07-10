#!/usr/bin/env node

import { Command } from 'commander';
import pc from 'picocolors';
import { handleInit } from './commands/init.js';
import { handleDoctor } from './commands/doctor.js';
import { handleValidate } from './commands/validate.js';
import { handleGenerate } from './commands/generate.js';
import { handleBuild } from './commands/build.js';
import { handleClean } from './commands/clean.js';
import { handleAddFlavor, handleRemoveFlavor } from './commands/manage-flavors.js';

const program = new Command();

program
  .name('rn-flavors')
  .description('React Native Flavor Manager (RNFM) - Manage app variants from a single config')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize a new flavor configuration in the current directory')
  .action(async () => {
    try {
      await handleInit(process.cwd());
    } catch (err: any) {
      console.error(pc.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('generate')
  .description('Generate native flavor files from configuration')
  .option('--dry-run', 'Show proposed file changes without modifying files')
  .action(async (options) => {
    try {
      await handleGenerate(process.cwd(), options);
    } catch (err: any) {
      console.error(pc.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate configuration file structure and assets')
  .action(async () => {
    try {
      const isValid = await handleValidate(process.cwd());
      process.exit(isValid ? 0 : 1);
    } catch (err: any) {
      console.error(pc.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('doctor')
  .description('Diagnose development environment tools and versions')
  .action(async () => {
    try {
      await handleDoctor(process.cwd());
    } catch (err: any) {
      console.error(pc.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('build <flavor>')
  .description('Build the application for the specified flavor')
  .option('-p, --platform <type>', 'Platform to build (android or ios)', 'android')
  .option('--mode <type>', 'Build mode (debug or release)', 'release')
  .option('--bundle', 'Build Android App Bundle (.aab) instead of APK (.apk)')
  .action(async (flavor, options) => {
    try {
      await handleBuild(process.cwd(), flavor, options);
    } catch (err: any) {
      console.error(pc.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('clean')
  .description('Clean generated variant folders, environments, and Android gradle cache')
  .action(async () => {
    try {
      await handleClean(process.cwd());
    } catch (err: any) {
      console.error(pc.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('add <flavor>')
  .description('Add a new flavor configuration and setup directories')
  .action(async (flavor) => {
    try {
      await handleAddFlavor(process.cwd(), flavor);
    } catch (err: any) {
      console.error(pc.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('remove <flavor>')
  .description('Remove an existing flavor configuration and cleanup directories')
  .action(async (flavor) => {
    try {
      await handleRemoveFlavor(process.cwd(), flavor);
    } catch (err: any) {
      console.error(pc.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

// Register placeholder commands for subsequent phases to provide helpful feedback
const pendingCommands = [
  { name: 'diff', desc: 'Compare local configurations with actual native setup (Phase 3)' },
  { name: 'upgrade', desc: 'Upgrade RNFM configuration templates (Phase 3)' }
];

for (const cmd of pendingCommands) {
  program
    .command(cmd.name)
    .description(cmd.desc)
    .action(() => {
      console.log(pc.yellow(`\nThis command is scheduled for development in subsequent phases.`));
      console.log(`Please refer to the PRD roadmap. Currently on Phase 2: Android Complete.\n`);
    });
}

// Fallback interactive mode if no arguments are provided
if (!process.argv.slice(2).length) {
  console.log(pc.bold(pc.cyan('\nReact Native Flavor Manager (RNFM)')));
  program.outputHelp();
} else {
  program.parse(process.argv);
}
