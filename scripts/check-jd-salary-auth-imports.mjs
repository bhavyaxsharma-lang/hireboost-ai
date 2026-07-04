import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const targets = [
  "artifacts/hireboost-ai/src/pages/jd-prep.tsx",
  "artifacts/hireboost-ai/src/pages/salary.tsx",
];

const failures = [];

for (const relativePath of targets) {
  const absolutePath = path.join(repoRoot, relativePath);
  const source = fs.readFileSync(absolutePath, "utf8");

  if (!source.includes('import { getLocalStorageItem } from "@/lib/storage";')) {
    failures.push(`${relativePath}: missing getLocalStorageItem import`);
  }

  if (!source.includes('const token = getLocalStorageItem("authToken");')) {
    failures.push(`${relativePath}: missing authToken lookup before fetch`);
  }
}

if (failures.length > 0) {
  console.error("JD/Salary auth regression check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("JD/Salary auth regression check passed.");
