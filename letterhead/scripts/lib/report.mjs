// Shared command-line plumbing for check-document.mjs and check-tokens.mjs:
// argument parsing, the one-line-per-finding output, NDJSON with --json,
// and the exit code contract (0 clean or warnings only, 2 errors, 1 usage
// or unreadable input).

export function parseArgs(argv, usage) {
  const files = [];
  let json = false;
  for (const a of argv) {
    if (a === '--json') json = true;
    else if (a === '-h' || a === '--help') {
      console.log(usage);
      process.exit(0);
    } else if (a.startsWith('--')) {
      console.error(`unknown option: ${a}`);
      console.error(usage);
      process.exit(1);
    } else files.push(a);
  }
  if (files.length === 0) {
    console.error(usage);
    process.exit(1);
  }
  return { files, json };
}

const ORDER = { error: 0, warning: 1, info: 2 };

// results: [{ file, findings: [{ line?, locator, severity, rule, message }], fatal? }]
export function emit(results, json) {
  const totals = { files: results.length, error: 0, warning: 0, info: 0, unreadable: 0 };
  for (const r of results) {
    if (r.fatal) {
      totals.unreadable++;
      if (json) console.log(JSON.stringify({ file: r.file, fatal: r.fatal }));
      else console.error(`✗ ${r.file}: ${r.fatal}`);
      continue;
    }
    const sorted = [...r.findings].sort((a, b) =>
      (a.line ?? 0) - (b.line ?? 0) || ORDER[a.severity] - ORDER[b.severity]);
    const counts = { error: 0, warning: 0, info: 0 };
    for (const f of sorted) {
      counts[f.severity]++;
      const where = f.line != null ? String(f.line) : f.locator;
      if (json) {
        console.log(JSON.stringify({ file: r.file, line: f.line ?? null, locator: f.locator, severity: f.severity, rule: f.rule, message: f.message }));
      } else {
        console.log(`${r.file}:${where} ${f.severity} ${f.rule} ${f.message}`);
      }
    }
    totals.error += counts.error;
    totals.warning += counts.warning;
    totals.info += counts.info;
    if (!json) {
      console.log(`${counts.error ? '✗' : '✓'} ${r.file} — ${counts.error} error, ${counts.warning} warning, ${counts.info} info`);
    }
  }
  if (json) console.log(JSON.stringify({ summary: totals }));
  if (totals.unreadable) return 1;
  return totals.error ? 2 : 0;
}
