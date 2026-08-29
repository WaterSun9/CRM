// Writes public/version.json with the commit / release id before building.
// The client (UpdateChecker) polls this file in production and prompts a
// reload ONLY when a new commit/deployment is actually released.
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

mkdirSync(publicDir, { recursive: true });

let buildId = process.env.VITE_BUILD_ID || process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA;

if (!buildId) {
    try {
        buildId = execSync('git rev-parse --short HEAD').toString().trim();
    } catch {
        buildId = 'prod-release';
    }
}

writeFileSync(
    join(publicDir, 'version.json'),
    JSON.stringify({ buildId, builtAt: new Date().toISOString() }, null, 2)
);

console.log(`[write_version] wrote public/version.json (buildId: ${buildId})`);
