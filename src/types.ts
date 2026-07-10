import { z } from 'zod';

export const FlavorSchema = z.object({
  appName: z.string().optional(),
  displayName: z.string().optional(), // Alias for appName
  packageName: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/, {
    message: 'Invalid package name format. Must be a valid Java package name (e.g. com.example.app)',
  }).optional(),
  bundleId: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]*(\.[a-zA-Z][a-zA-Z0-9_-]*)+$/, {
    message: 'Invalid bundle ID format. Must be a valid iOS bundle identifier (e.g. com.example.app)',
  }).optional(),
  version: z.string().optional(),
  versionName: z.string().optional(), // Alias for version
  versionCode: z.number().int().positive().optional(),
  env: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
}).catchall(z.union([z.string(), z.number(), z.boolean()])); // Allow extra arbitrary values as custom env variables

export const ConfigSchema = z.object({
  flavors: z.record(FlavorSchema),
});

export type FlavorConfig = z.infer<typeof FlavorSchema>;
export type AppConfig = z.infer<typeof ConfigSchema>;

export interface DoctorResult {
  title: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}
