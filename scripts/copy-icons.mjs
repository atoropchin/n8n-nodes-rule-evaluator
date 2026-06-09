import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function copySvgs(srcDir, destDir) {
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);

    if (entry.isDirectory()) {
      copySvgs(srcPath, destPath);
      continue;
    }

    if (!entry.name.endsWith(".svg")) {
      continue;
    }

    mkdirSync(dirname(destPath), { recursive: true });
    cpSync(srcPath, destPath);
  }
}

const nodesDir = join(packageRoot, "nodes");
const distNodesDir = join(packageRoot, "dist", "nodes");

if (existsSync(nodesDir)) {
  copySvgs(nodesDir, distNodesDir);
}
