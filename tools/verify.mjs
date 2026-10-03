// Sandbox · Team 15 verification
//
// Proves the "untouched" part of Section 5.4 and 5.3:
//   1. every file under modules/ still has the SHA-256 recorded at intake;
//   2. when the original course folder is next to team15_dashboard (as in the
//      shared project folder), each copy still matches its original byte for byte;
//   3. no extra files have appeared in a team folder;
//   4. the Team 1 and Team 4 compat extractions still equal the bytes they were
//      cut from (so no team code was retyped or edited on the way in).
//
//   node tools/verify.mjs          exit code 0 = all good, 1 = something differs

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { sha256, listFiles, SUBMISSIONS } from "./intake.mjs";
import { extractTeam01, extractTeam04 } from "./extract-compat.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const projectRoot = path.resolve(root, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "integration", "manifest.json"), "utf8"));

let failures = 0;
let checked = 0;
const fail = (msg) => { failures++; console.log("  FAIL " + msg); };

console.log("1-3. modules/ against the intake manifest and the original submissions");
for (const entry of manifest.modules) {
  const dir = path.join(root, entry.canonical);
  const sub = SUBMISSIONS.find((s) => s.key === entry.key);
  const originalDir = sub ? path.join(projectRoot, sub.source) : null;
  const haveOriginal = originalDir && fs.existsSync(originalDir);

  const onDisk = fs.existsSync(dir) ? listFiles(dir).map((f) => f.split(path.sep).join("/")) : [];
  const recorded = entry.files.map((f) => f.name);
  for (const extra of onDisk.filter((f) => !recorded.includes(f))) fail(`${entry.canonical}/${extra} is not in the manifest`);

  for (const file of entry.files) {
    const copy = path.join(dir, file.name);
    checked++;
    if (!fs.existsSync(copy)) { fail(`${entry.canonical}/${file.name} is missing`); continue; }
    const now = sha256(copy);
    if (now !== file.sha256) fail(`${entry.canonical}/${file.name} changed since intake`);
    if (haveOriginal) {
      const original = path.join(originalDir, file.name);
      if (!fs.existsSync(original)) fail(`original of ${entry.canonical}/${file.name} not found`);
      else if (sha256(original) !== now) fail(`${entry.canonical}/${file.name} differs from ${path.relative(projectRoot, original)}`);
    }
  }
  console.log(`  ${entry.key.padEnd(24)} ${entry.files.length} files ${haveOriginal ? "(also compared with the original folder)" : "(manifest only)"}`);
}

console.log("4. compat extractions");
{
  const t1 = extractTeam01(root);
  const file = path.join(root, "shell", "compat", "team01_fcfs_sjf.inline.js");
  const ok = fs.existsSync(file) && Buffer.compare(fs.readFileSync(file), t1.bytes) === 0;
  if (ok) console.log(`  team01 inline script: identical to demo.html bytes [${t1.from}, ${t1.to})`);
  else fail("shell/compat/team01_fcfs_sjf.inline.js is not identical to Team 1's inline script");
}
{
  const t4 = extractTeam04(root);
  const file = path.join(root, "shell", "compat", "team04_round_robin.markup.js");
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox);
  const markup = sandbox.window.Sandbox && sandbox.window.Sandbox.compat && sandbox.window.Sandbox.compat.team04Markup;
  if (markup === t4.markup) console.log(`  team04 markup: identical to demo.html bytes [${t4.from}, ${t4.to})`);
  else fail("shell/compat/team04_round_robin.markup.js does not match Team 4's demo.html markup");
}

console.log(failures ? `\n${failures} problem(s) found in ${checked} files.` : `\nAll ${checked} team files verified. Compat extractions verified.`);
process.exit(failures ? 1 : 0);
