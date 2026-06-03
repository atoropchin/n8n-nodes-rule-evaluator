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

for (const filePath of allFiles) {
	const content = readFileSync(join(ROOT, filePath), 'utf8');
	if (BLOCKED_PATTERN.test(content)) {
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

console.log('Scope check passed: no Decision Table references detected.');
