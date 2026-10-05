#!/usr/bin/env node
// Summarize a `claude -p --output-format stream-json --verbose` transcript:
// model, skills available, skills invoked, letterhead scripts run, turns,
// duration, cost, and the files the run wrote.
//
//   node summarize.mjs <transcript.jsonl>
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node summarize.mjs <transcript.jsonl>');
  process.exit(1);
}

const events = readFileSync(file, 'utf8')
  .split('\n')
  .filter(Boolean)
  .flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });

const init = events.find((e) => e.type === 'system' && e.subtype === 'init') || {};
const result = events.findLast((e) => e.type === 'result') || {};
const toolUses = events
  .filter((e) => e.type === 'assistant')
  .flatMap((e) => (e.message?.content || []).filter((c) => c.type === 'tool_use'));

const skillsInvoked = toolUses.filter((t) => t.name === 'Skill').map((t) => t.input?.skill);
const letterheadScripts = toolUses
  .filter((t) => t.name === 'Bash' && /letterhead\/scripts\/[\w-]+\.mjs/.test(t.input?.command || ''))
  .map((t) => t.input.command.match(/letterhead\/scripts\/([\w-]+\.mjs)/)[1]);
const written = [...new Set(toolUses.filter((t) => t.name === 'Write').map((t) => t.input?.file_path))];

const out = {
  model: init.model,
  cwd: init.cwd,
  skillsAvailable: (init.skills || []).length,
  letterheadAvailable: (init.skills || []).some((s) => /letterhead/.test(s)),
  skillsInvoked,
  letterheadScripts,
  toolCalls: toolUses.length,
  turns: result.num_turns,
  durationSeconds: result.duration_ms ? Math.round(result.duration_ms / 1000) : undefined,
  costUsd: result.total_cost_usd,
  isError: result.is_error,
  filesWritten: written,
  finalMessage: (result.result || '').slice(0, 600),
};
console.log(JSON.stringify(out, null, 2));
