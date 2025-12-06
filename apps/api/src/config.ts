import { z } from 'zod';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Load .env.local for development config
// override: false ensures existing env vars (e.g., DATABASE_URL in devcontainer) are preserved
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local'), override: false });

const configSchema = z.object({
  port: z.coerce.number().default(3001),
  host: z.string().default('0.0.0.0'),
  databaseUrl: z.string(),
  solverUrl: z.string().default('http://localhost:8081'),
  jwtSecret: z.string().min(32),
  jwtAccessExpiry: z.string().default('15m'),
  jwtRefreshExpiry: z.string().default('7d'),
  screenshotPath: z.string().default('./screenshots'),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  return configSchema.parse({
    port: process.env.PORT,
    host: process.env.HOST,
    databaseUrl: process.env.DATABASE_URL,
    solverUrl: process.env.SOLVER_URL,
    jwtSecret: process.env.JWT_SECRET,
    jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY,
    jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY,
    screenshotPath: process.env.SCREENSHOT_PATH,
    nodeEnv: process.env.NODE_ENV,
  });
}
