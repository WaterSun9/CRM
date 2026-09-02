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

let gitSha = process.env.VITE_BUILD_ID || process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA;

if (!gitSha) {
    try {
        gitSha = execSync('git rev-parse --short HEAD').toString().trim();
    } catch {
        gitSha = 'rel';
    }
}

gitSha = String(gitSha).trim();
if (/^[0-9a-f]{40}$/i.test(gitSha)) {
    gitSha = gitSha.slice(0, 7);
}

const buildId = `${gitSha}-${Date.now().toString(36)}`;
const builtAt = new Date().toISOString();

writeFileSync(
    join(publicDir, 'version.json'),
    JSON.stringify({ buildId, builtAt }, null, 2)
);

console.log(`[write_version] wrote public/version.json (buildId: ${buildId})`);
