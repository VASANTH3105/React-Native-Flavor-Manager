import path from 'path';
import fs from 'fs-extra';
import pc from 'picocolors';
import sharp from 'sharp';
import type { AppConfig } from '../types.js';

export interface AssetOptions {
  dryRun?: boolean;
}

interface MipmapConfig {
  folder: string;
  size: number;
}

const MIPMAP_CONFIGS: MipmapConfig[] = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

export async function generateAssets(cwd: string, config: AppConfig, options: AssetOptions = {}) {
  for (const flavorName of Object.keys(config.flavors)) {
    // Look for icon in icons/<flavorName>/icon.png or assets/<flavorName>/icon.png
    const iconDirs = [
      path.join(cwd, 'icons', flavorName),
      path.join(cwd, 'assets', flavorName, 'icons'),
      path.join(cwd, 'assets', flavorName),
    ];
    let srcIconPath = null;
    for (const dir of iconDirs) {
      const p = path.join(dir, 'icon.png');
      if (fs.existsSync(p)) {
        srcIconPath = p;
        break;
      }
    }

    if (!srcIconPath) {
      // If no flavor-specific icon is found, look for a global fallback icon at icons/icon.png or assets/icon.png
      const fallbacks = [
        path.join(cwd, 'icons', 'icon.png'),
        path.join(cwd, 'assets', 'icon.png'),
      ];
      for (const p of fallbacks) {
        if (fs.existsSync(p)) {
          srcIconPath = p;
          break;
        }
      }
    }

    if (!srcIconPath) {
      console.log(pc.yellow(`⚠ No launcher icon found for flavor '${flavorName}'. Skipping icon generation.`));
      continue;
    }

    if (options.dryRun) {
      console.log(pc.bold(`\n[PROPOSED ASSETS] Flavor '${flavorName}':`));
      console.log(pc.gray(`  Source: ${srcIconPath}`));
      for (const cfg of MIPMAP_CONFIGS) {
        console.log(pc.gray(`  -> android/app/src/${flavorName}/res/${cfg.folder}/ic_launcher.png (${cfg.size}x${cfg.size})`));
        console.log(pc.gray(`  -> android/app/src/${flavorName}/res/${cfg.folder}/ic_launcher_round.png (Circular, ${cfg.size}x${cfg.size})`));
      }
    } else {
      const resBaseDir = path.join(cwd, 'android', 'app', 'src', flavorName, 'res');
      
      for (const cfg of MIPMAP_CONFIGS) {
        const destFolder = path.join(resBaseDir, cfg.folder);
        await fs.ensureDir(destFolder);

        const destIconPath = path.join(destFolder, 'ic_launcher.png');
        const destRoundIconPath = path.join(destFolder, 'ic_launcher_round.png');

        // 1. Regular Icon
        await sharp(srcIconPath)
          .resize(cfg.size, cfg.size)
          .toFile(destIconPath);

        // 2. Round Icon (Cropped to circle)
        const r = cfg.size / 2;
        const circleSvg = Buffer.from(
          `<svg><circle cx="${r}" cy="${r}" r="${r}" /></svg>`
        );
        await sharp(srcIconPath)
          .resize(cfg.size, cfg.size)
          .composite([
            {
              input: circleSvg,
              blend: 'dest-in',
            },
          ])
          .toFile(destRoundIconPath);
      }
      console.log(pc.green(`✔ Generated Android mipmap launcher icons for flavor '${flavorName}'`));
    }
  }
}
