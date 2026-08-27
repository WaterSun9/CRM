// Writes public/version.json with a fresh build id before every build.
// The client (UpdateChecker) polls this file in production and prompts a
// reload when the id changes, so a stale cached page doesn't keep serving
// deleted JS/CSS chunk filenames after the next deploy.
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

mkdirSync(publicDir, { recursive: true });

const buildId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

writeFileSync(
    join(publicDir, 'version.json'),
    JSON.stringify({ buildId, builtAt: new Date().toISOString() }, null, 2)
);

console.log(`[write_version] wrote public/version.json (buildId: ${buildId})`);
