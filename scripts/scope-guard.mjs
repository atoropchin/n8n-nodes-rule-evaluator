import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SCAN_PATHS = [
	'README.md',
	'CHANGELOG.md',
	'package.json',
	'tsconfig.json',
	'nodes',
	'tests',
];
const BLOCKED_PATTERN = /\b(DecisionTable|Decision Table|decisionTable|decision-table|decision table)\b/i;
const EXTENSIONS = new Set(['.md', '.json', '.ts', '.mjs', '.js', '.yml', '.yaml']);
const packageJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const packageVersion = String(packageJson.version ?? '0.0.0');

function isDecisionTableInScope(version) {
	const [major = 0, minor = 0] = version.split('.').map((part) => Number.parseInt(part, 10));

	if (!Number.isFinite(major) || !Number.isFinite(minor)) {
		return false;
	}

	return major > 1 || (major === 1 && minor >= 2);
}

function shouldScanFile(filePath) {
	for (const ext of EXTENSIONS) {
		if (filePath.endsWith(ext)) {
			return true;
		}
	}

	return false;
}

function walk(path) {
	const absolutePath = join(ROOT, path);
	const stats = statSync(absolutePath);

	if (stats.isFile()) {
		return [path];
	}

	if (!stats.isDirectory()) {
		return [];
	}

	const files = [];
	for (const entry of readdirSync(absolutePath)) {
		const nestedPath = join(path, entry);
		const nestedAbsolutePath = join(ROOT, nestedPath);
		const nestedStats = statSync(nestedAbsolutePath);

		if (nestedStats.isDirectory()) {
			files.push(...walk(nestedPath));
			continue;
		}

		if (nestedStats.isFile()) {
			files.push(nestedPath);
		}
	}

	return files;
}

const allFiles = SCAN_PATHS.flatMap((path) => walk(path)).filter((filePath) => shouldScanFile(filePath));
const violations = [];
const decisionTableInScope = isDecisionTableInScope(packageVersion);

for (const filePath of allFiles) {
	const content = readFileSync(join(ROOT, filePath), 'utf8');
	if (!decisionTableInScope && BLOCKED_PATTERN.test(content)) {
		violations.push(filePath);
	}
}

if (violations.length > 0) {
	console.error('Out-of-scope Decision Table references found in package files.');
	for (const violation of violations) {
		console.error(`- ${violation}`);
	}
	process.exit(1);
}

if (decisionTableInScope) {
	console.log(`Scope check passed: Decision Table references are allowed in v${packageVersion}.`);
} else {
	console.log('Scope check passed: no Decision Table references detected.');
}
