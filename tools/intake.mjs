// Sandbox · Team 15 intake tool
//
// Copies every team submission byte-for-byte into ../modules/<canonical folder>
// and writes a SHA-256 manifest so anyone can prove the folders were not edited.
//
//   node tools/intake.mjs
//
// Sources are read from the course project folder (one level above
// team15_dashboard). Originals are never modified; only team15_dashboard/modules
// and team15_dashboard/integration/manifest.* are written.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");              // team15_dashboard
const projectRoot = path.resolve(root, "..");       // os proj
const modulesDir = path.join(root, "modules");
const integrationDir = path.join(root, "integration");

// Team number, namespace key from Section 4, folder as submitted, canonical folder name.
export const SUBMISSIONS = [
  { team: 1,  key: "team01_fcfs_sjf",        source: "Team01_FCFS_SJF",                    canonical: "team01_fcfs_sjf" },
  { team: 2,  key: "team02_srtf",            source: "team02_srtf",                        canonical: "team02_srtf" },
  { team: 3,  key: "team03_priority",        source: "team03_priority",                    canonical: "team03_priority" },
  { team: 4,  key: "team04_round_robin",     source: "RoundRobin-Team-4",                  canonical: "team04_round_robin" },
  { team: 5,  key: "team05_allocation",      source: "_intake/team05_allocation",          canonical: "team05_allocation",
    provenance: { via: "Google Drive folder \"OS Projects\"", archive: "_intake/team05_allocation.zip", driveFileId: "142O_J2cAec2tEQM8K9t05mYbbUMrpB32", note: "__MACOSX resource-fork entries in the archive were not extracted" } },
  { team: 6,  key: "team06_bankers",         source: "team06_banker's_algorithm",          canonical: "team06_bankers" },
  { team: 7,  key: "team07_prod_cons",       source: "team07_prod_cons",                   canonical: "team07_prod_cons" },
  { team: 8,  key: "team08_readers_writers", source: "_intake/team08_readers_writers",     canonical: "team08_readers_writers",
    provenance: { via: "Google Drive folder \"OS Projects\"", archive: "_intake/team08_readers_writers.zip", driveFileId: "1NcDb2wMqcPkFrd1dQ1P9XmIb-udpz0Dm", note: "Supersedes the single-file export Team-08_Readers&writers.html" } },
  { team: 9,  key: "team09_dining_phil",     source: "team09_dining_phil",                 canonical: "team09_dining_phil" },
  { team: 10, key: "team10_disk_fcfs_sstf",  source: "team 10 fcfs sstf",                  canonical: "team10_disk_fcfs_sstf" },
  { team: 11, key: "team11_disk_scan",       source: "team11_disk_scan",                   canonical: "team11_disk_scan" },
  { team: 12, key: "team12_disk_look",       source: "team12_disk_look",                   canonical: "team12_disk_look" },
  { team: 13, key: "team13_page_fifo_lru",   source: "team13_page_fifo_lru",               canonical: "team13_page_fifo_lru" },
  { team: 14, key: "team14_page_optimal",    source: "team14_page_optimal",                canonical: "team14_page_optimal" },
];

// Loose files in the project folder that are deliberately not copied into /modules.
const NOT_COPIED = [
  { path: "G3_PRIORITY SCHEDULING.html", reason: "Byte-identical to team03_priority/demo.html (duplicate upload)", compareWith: "team03_priority/demo.html" },
  { path: "Team-08_Readers&writers.html", reason: "Earlier single-file export of Team 8, superseded by the team08_readers_writers folder from Drive" },
];

export function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

export function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const child of listFiles(full)) out.push(path.join(entry.name, child));
    } else if (entry.isFile()) {
      out.push(entry.name);
    }
  }
  return out.sort();
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function run() {
  fs.mkdirSync(modulesDir, { recursive: true });
  fs.mkdirSync(integrationDir, { recursive: true });

  const entries = [];
  for (const sub of SUBMISSIONS) {
    const from = path.join(projectRoot, sub.source);
    const to = path.join(modulesDir, sub.canonical);
    if (!fs.existsSync(from)) throw new Error(`Missing submission folder: ${from}`);

    // Only ever clear our own copy inside team15_dashboard/modules.
    if (path.dirname(to) !== modulesDir) throw new Error(`Refusing to write outside modules/: ${to}`);
    fs.rmSync(to, { recursive: true, force: true });

    const files = [];
    for (const rel of listFiles(from)) {
      const src = path.join(from, rel);
      const dst = path.join(to, rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.cpSync(src, dst, { preserveTimestamps: true });
      const a = sha256(src);
      const b = sha256(dst);
      if (a !== b) throw new Error(`Copy mismatch for ${src}`);
      files.push({ name: toPosix(rel), bytes: fs.statSync(dst).size, sha256: b });
    }

    const entry = {
      team: sub.team,
      key: sub.key,
      submittedAs: sub.source.replace(/^_intake\//, ""),
      canonical: `modules/${sub.canonical}`,
      renamed: path.basename(sub.source) !== sub.canonical,
      files,
    };
    if (sub.provenance) {
      const archive = path.join(projectRoot, sub.provenance.archive);
      entry.provenance = { ...sub.provenance, archiveSha256: fs.existsSync(archive) ? sha256(archive) : null };
    }
    entries.push(entry);
    console.log(`team${String(sub.team).padStart(2, "0")}  ${files.length} files  ${entry.submittedAs}  ->  ${entry.canonical}`);
  }

  const notCopied = NOT_COPIED.map((item) => {
    const full = path.join(projectRoot, item.path);
    const record = { path: item.path, reason: item.reason, sha256: fs.existsSync(full) ? sha256(full) : null };
    if (item.compareWith) {
      const other = sha256(path.join(projectRoot, item.compareWith));
      record.identicalTo = record.sha256 === other ? item.compareWith : null;
    }
    return record;
  });

  const manifest = {
    tool: "tools/intake.mjs",
    generated: new Date().toISOString(),
    algorithm: "sha256",
    modules: entries.sort((a, b) => a.team - b.team),
    notCopied,
  };

  fs.writeFileSync(path.join(integrationDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  // Same data as a classic script, because fetch() of local files fails on file://.
  fs.writeFileSync(
    path.join(integrationDir, "manifest.js"),
    "/* Generated by tools/intake.mjs. Do not edit by hand. */\n" +
      "window.SandboxManifest = " + JSON.stringify(manifest, null, 2) + ";\n",
  );
  console.log(`\nmanifest: ${entries.reduce((n, e) => n + e.files.length, 0)} files across ${entries.length} modules`);
  for (const n of notCopied) console.log(`not copied: ${n.path} (${n.identicalTo ? "identical to " + n.identicalTo : n.reason})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
