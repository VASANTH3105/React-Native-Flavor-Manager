import path from 'path';
import fs from 'fs-extra';
import pc from 'picocolors';
import sharp from 'sharp';
import type { AppConfig } from '../types.js';
import { findXcodeProject } from './ios.js';

export interface IOSAssetOptions {
  dryRun?: boolean;
}

interface IOSIconConfig {
  size: string;
  idiom: 'iphone' | 'ipad' | 'ios-marketing';
  filename: string;
  scale: string;
  pixelSize: number;
}

const IOS_ICON_CONFIGS: IOSIconConfig[] = [
  // iPhone
  { size: '20x20', idiom: 'iphone', filename: 'icon-20@2x.png', scale: '2x', pixelSize: 40 },
  { size: '20x20', idiom: 'iphone', filename: 'icon-20@3x.png', scale: '3x', pixelSize: 60 },
  { size: '29x29', idiom: 'iphone', filename: 'icon-29@2x.png', scale: '2x', pixelSize: 58 },
  { size: '29x29', idiom: 'iphone', filename: 'icon-29@3x.png', scale: '3x', pixelSize: 87 },
  { size: '40x40', idiom: 'iphone', filename: 'icon-40@2x.png', scale: '2x', pixelSize: 80 },
  { size: '40x40', idiom: 'iphone', filename: 'icon-40@3x.png', scale: '3x', pixelSize: 120 },
  { size: '60x60', idiom: 'iphone', filename: 'icon-60@2x.png', scale: '2x', pixelSize: 120 },
  { size: '60x60', idiom: 'iphone', filename: 'icon-60@3x.png', scale: '3x', pixelSize: 180 },
  
  // iPad
  { size: '20x20', idiom: 'ipad', filename: 'icon-ipad-20@2x.png', scale: '2x', pixelSize: 40 },
  { size: '29x29', idiom: 'ipad', filename: 'icon-ipad-29@2x.png', scale: '2x', pixelSize: 58 },
  { size: '40x40', idiom: 'ipad', filename: 'icon-ipad-40@2x.png', scale: '2x', pixelSize: 80 },
  { size: '76x76', idiom: 'ipad', filename: 'icon-ipad-76@2x.png', scale: '2x', pixelSize: 152 },
  { size: '83.5x83.5', idiom: 'ipad', filename: 'icon-ipad-83.5@2x.png', scale: '2x', pixelSize: 167 },

  // App Store / Marketing
  { size: '1024x1024', idiom: 'ios-marketing', filename: 'icon-1024.png', scale: '1x', pixelSize: 1024 },
];

export async function generateIOSAssets(cwd: string, config: AppConfig, options: IOSAssetOptions = {}) {
  const xcodeInfo = findXcodeProject(cwd);
  if (!xcodeInfo) return;

  const { projectName } = xcodeInfo;
  
  // Locate Images.xcassets
  const xcassetsPath = path.join(cwd, 'ios', projectName, 'Images.xcassets');
  if (!fs.existsSync(xcassetsPath)) {
    console.log(pc.yellow(`⚠ Images.xcassets not found at ${xcassetsPath}. Skipping iOS app icons.`));
    return;
  }

  for (const flavorName of Object.keys(config.flavors)) {
    // Look for flavor specific icons
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
      // Fallback
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
      console.log(pc.yellow(`⚠ No launcher icon found for flavor '${flavorName}'. Skipping iOS icon generation.`));
      continue;
    }

    const appiconsetPath = path.join(xcassetsPath, `AppIcon-${flavorName}.appiconset`);

    if (options.dryRun) {
      console.log(pc.bold(`\n[PROPOSED iOS ASSETS] Flavor '${flavorName}':`));
      console.log(pc.gray(`  Source: ${srcIconPath}`));
      console.log(pc.gray(`  Create catalog: ios/${projectName}/Images.xcassets/AppIcon-${flavorName}.appiconset/`));
      for (const cfg of IOS_ICON_CONFIGS) {
        console.log(pc.gray(`    -> ${cfg.filename} (${cfg.pixelSize}x${cfg.pixelSize})`));
      }
    } else {
      await fs.ensureDir(appiconsetPath);

      // Generate all sizes
      for (const cfg of IOS_ICON_CONFIGS) {
        const destPath = path.join(appiconsetPath, cfg.filename);
        await sharp(srcIconPath)
          .resize(cfg.pixelSize, cfg.pixelSize)
          .toFile(destPath);
      }

      // Generate Contents.json
      const contentsJson = {
        images: IOS_ICON_CONFIGS.map(cfg => ({
          size: cfg.size,
          idiom: cfg.idiom,
          filename: cfg.filename,
          scale: cfg.scale,
        })),
        info: {
          version: 1,
          author: 'rn-flavors',
        },
      };

      await fs.writeJSON(path.join(appiconsetPath, 'Contents.json'), contentsJson, { spaces: 2 });
      console.log(pc.green(`✔ Generated iOS app icons for flavor '${flavorName}'`));
    }
  }
}
