#!/usr/bin/env node
import { parseEvent, prepareCheckpoint, worktreeId } from './session-state.mjs';

try {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const input = parseEvent(Buffer.concat(chunks).toString('utf8'));
  if (!input.sessionId) throw new Error('sessionId is required; use the ID supplied in the session context.');
  const checkpoint = await prepareCheckpoint({ ...input, worktreeId: input.worktreeId || worktreeId() });
  process.stdout.write(`Prepared local checkpoint and refreshed AGENT_MEMORY.md for ${checkpoint.sessionId}.\n`);
} catch (error) {
  process.stderr.write(`Checkpoint not written: ${error.message}\n`);
  process.exitCode = 1;
}
