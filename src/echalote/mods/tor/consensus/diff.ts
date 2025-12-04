import { Bytes } from '@hazae41/bytes';
import { sha3 } from 'hash-wasm';

export interface ConsensusDiff {
  readonly version: number;
  readonly fromHash: string;
  readonly toHash: string;
  readonly commands: DiffCommand[];
}

export type DiffCommand =
  | { type: 'delete'; start: number; end?: number }
  | { type: 'replace'; start: number; end?: number; lines: string[] }
  | { type: 'append'; line: number; lines: string[] };

/**
 * Computes the SHA3-256 hash of the signed part of a consensus document.
 * The signed part is everything up to and including "directory-signature ".
 */
export async function computeSignedPartHash(preimage: string): Promise<string> {
  const signedPart = Bytes.fromUtf8(preimage);
  const hash = await sha3(signedPart, 256);
  return hash;
}

/**
 * Computes the SHA3-256 hash of the entire consensus document.
 */
export async function computeFullConsensusHash(
  consensusText: string
): Promise<string> {
  const bytes = Bytes.fromUtf8(consensusText);
  const hash = await sha3(bytes, 256);
  return hash;
}

/**
 * Parses a consensus diff in ed-style format.
 */
export function parseDiffOrThrow(diffText: string): ConsensusDiff {
  const lines = diffText.split('\n');
  let i = 0;

  // Parse header
  if (!lines[i] || !lines[i].startsWith('network-status-diff-version ')) {
    throw new Error('Invalid diff: missing version line');
  }
  const version = parseInt(lines[i].split(' ')[1]);
  i++;

  if (!lines[i] || !lines[i].startsWith('hash ')) {
    throw new Error('Invalid diff: missing hash line');
  }
  const [, fromHash, toHash] = lines[i].split(' ');
  i++;

  const commands: DiffCommand[] = [];

  // Parse ed commands
  while (i < lines.length && lines[i].trim()) {
    const line = lines[i];

    // Match delete command: <n1>d or <n1>,<n2>d or <n1>,$d
    const deleteMatch = line.match(/^(\d+)(?:,(\d+|\$))?d$/);
    if (deleteMatch) {
      const start = parseInt(deleteMatch[1]);
      const end =
        deleteMatch[2] === '$'
          ? undefined
          : deleteMatch[2]
            ? parseInt(deleteMatch[2])
            : undefined;
      commands.push({ type: 'delete', start, end });
      i++;
      continue;
    }

    // Match replace command: <n1>c or <n1>,<n2>c
    const replaceMatch = line.match(/^(\d+)(?:,(\d+))?c$/);
    if (replaceMatch) {
      const start = parseInt(replaceMatch[1]);
      const end = replaceMatch[2] ? parseInt(replaceMatch[2]) : undefined;
      i++;

      // Read block until we find a line with just "."
      const blockLines: string[] = [];
      while (i < lines.length && lines[i] !== '.') {
        blockLines.push(lines[i]);
        i++;
      }
      i++; // Skip the "." line

      commands.push({ type: 'replace', start, end, lines: blockLines });
      continue;
    }

    // Match append command: <n1>a
    const appendMatch = line.match(/^(\d+)a$/);
    if (appendMatch) {
      const lineNum = parseInt(appendMatch[1]);
      i++;

      // Read block until we find a line with just "."
      const blockLines: string[] = [];
      while (i < lines.length && lines[i] !== '.') {
        blockLines.push(lines[i]);
        i++;
      }
      i++; // Skip the "." line

      commands.push({ type: 'append', line: lineNum, lines: blockLines });
      continue;
    }

    // Skip empty lines or unrecognized content
    i++;
  }

  return { version, fromHash, toHash, commands };
}

/**
 * Applies a consensus diff to a base consensus preimage.
 * The preimage should be the signed part (everything up to and including "directory-signature ").
 * Returns the full consensus text after applying the diff.
 */
export function applyDiffOrThrow(
  basePreimage: string,
  diff: ConsensusDiff
): string {
  // Start with the signed part from the base consensus
  // Note: If the base ends with \n, split will create an empty string at the end
  let fileLines = basePreimage.split('\n');

  // Ed commands apply from back to front
  for (const command of diff.commands) {
    if (command.type === 'delete') {
      const start = command.start - 1; // Convert to 0-indexed
      const end = command.end ? command.end - 1 : start;

      if (end === undefined || end < 0) {
        // Delete from start to end of file
        fileLines = fileLines.slice(0, start);
      } else {
        // Delete specific range
        fileLines.splice(start, end - start + 1);
      }
    } else if (command.type === 'replace') {
      const start = command.start - 1;
      const end = command.end ? command.end - 1 : start;

      // Remove old lines and insert new ones
      fileLines.splice(start, end - start + 1, ...command.lines);
    } else if (command.type === 'append') {
      const lineNum = command.line; // After this line (0-indexed position to insert)
      fileLines.splice(lineNum, 0, ...command.lines);
    }
  }

  // Join lines with newlines and add trailing newline.
  // Consensus documents end with a newline after the last signature.
  return fileLines.join('\n') + '\n';
}
