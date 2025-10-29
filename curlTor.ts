#!/usr/bin/env -S node --enable-source-maps
/* 
  Minimal curl-alike using Node's built-in fetch (Node 18+).

  Supported flags (subset of curl):
    -X, --request <METHOD>
    -H, --header <"Key: Value">  (repeatable)
    -d, --data|--data-raw <DATA or @file or @->stdin>
        --data-binary <DATA or @file or @->stdin>
        --json <JSON string or @file> (sets Content-Type if not present)
    -F, --form <name=value | name=@file> (repeatable; uses FormData)
    -o, --output <file>
    -i, --include          (prepend response headers to output)
    -s, --silent           (suppress progress/info)
    -v, --verbose          (show request + response status/headers)
    -L, --location         (follow redirects; default in fetch)
        --max-time <sec>   (timeout)
        --snowflake-url <url>  (Tor Snowflake proxy URL; default: wss://snowflake.torproject.net/)
  
  Notes:
    * TLS “-k/--insecure” is not supported per-request by built-in fetch.
      (Workaround: set env NODE_TLS_REJECT_UNAUTHORIZED=0 for the whole process.)
    * Redirects: fetch follows automatically; no per-request max-redirs here.
*/

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { stdout, stderr } from 'node:process';

import { TorClient } from './src/index.js';

type Opts = {
  method?: string;
  headers: [string, string][];
  data?: { kind: 'raw' | 'binary' | 'json'; value: string | Buffer };
  form: Array<{
    name: string;
    value: string | { filePath: string; data: Buffer; filename: string };
  }>;
  output?: string;
  include: boolean;
  silent: boolean;
  verbose: boolean;
  follow: boolean;
  maxTimeMs?: number;
  url?: string;
  snowflakeUrl?: string;
};

function die(msg: string, code = 2): never {
  stderr.write(`curlTor.ts: ${msg}\n`);
  process.exit(code);
}

function parseHeader(h: string): [string, string] {
  const idx = h.indexOf(':');
  if (idx < 1) die(`Invalid header: ${h}`);
  return [h.slice(0, idx).trim(), h.slice(idx + 1).trim()];
}

function readFromSourceSpec(spec: string): Buffer {
  // @file -> read file, @- -> stdin, otherwise literal
  if (spec.startsWith('@')) {
    const path = spec.slice(1);
    if (path === '-') {
      const buf = readStdinSync();
      return buf;
    }
    if (!existsSync(path)) die(`No such file: ${path}`);
    return readFileSync(path);
  }
  return Buffer.from(spec, 'utf8');
}

function readStdinSync(): Buffer {
  const chunks: Buffer[] = [];
  const buf = readFileSync(0); // fd 0 (stdin) in Node allows sync read
  chunks.push(buf);
  return Buffer.concat(chunks);
}

function showHelp(): never {
  stdout.write(`Usage: curlTor.ts [options...] <url>

 -d, --data <data>          HTTP POST data
 -F, --form <name=content>  Specify multipart MIME data
 -H, --header <header/@file> Pass custom header(s) to server
 -i, --include              Include response headers in output
 -L, --location             Follow redirects (default)
 -o, --output <file>        Write to file instead of stdout
 -s, --silent               Silent mode
 -v, --verbose              Make the operation more talkative
 -X, --request <command>    Specify request command to use
     --data-binary <data>   HTTP POST binary data
     --data-raw <data>      HTTP POST data, '@' allowed
     --json <JSON>          HTTP POST JSON
     --max-time <seconds>   Maximum time allowed for transfer
     --snowflake-url <url>  Tor Snowflake proxy URL
 -h, --help                 Show this help message

Examples:
  curlTor.ts https://httpbin.org/get
  curlTor.ts -X POST -d "hello=world" https://httpbin.org/post
  curlTor.ts -v --json '{"test":"data"}' https://httpbin.org/post
  curlTor.ts -H "User-Agent: MyApp/1.0" https://httpbin.org/get

This is a Tor-enabled version of curl that routes requests through the Tor network
using Snowflake bridges. All requests are anonymized through a 3-hop circuit.
`);
  process.exit(0);
}

function parseArgs(argv: string[]): Opts {
  const opts: Opts = {
    headers: [],
    form: [],
    include: false,
    silent: false,
    verbose: false,
    follow: true,
  };
  const args = [...argv];

  while (args.length) {
    const a = args.shift()!;
    if (a === '-h' || a === '--help') {
      showHelp();
    } else if (a === '-X' || a === '--request') {
      opts.method = (args.shift() || '').toUpperCase();
    } else if (a === '-H' || a === '--header') {
      const h = args.shift();
      if (!h) die('Missing value for --header');
      opts.headers.push(parseHeader(h));
    } else if (a === '-d' || a === '--data' || a === '--data-raw') {
      const v = args.shift();
      if (!v) die('Missing value for --data');
      const buf = readFromSourceSpec(v);
      opts.data = { kind: 'raw', value: buf.toString('utf8') };
      if (!opts.method) opts.method = 'POST';
    } else if (a === '--data-binary') {
      const v = args.shift();
      if (!v) die('Missing value for --data-binary');
      const buf = readFromSourceSpec(v);
      opts.data = { kind: 'binary', value: buf };
      if (!opts.method) opts.method = 'POST';
    } else if (a === '--json') {
      const v = args.shift();
      if (!v) die('Missing value for --json');
      const buf = readFromSourceSpec(v);
      // Validate JSON? Keep as-is but try to stringify if not valid object string
      const text = buf.toString('utf8');
      // Try to parse to ensure it's valid JSON; otherwise treat as string
      try {
        JSON.parse(text);
      } catch {
        die('Invalid JSON passed to --json');
      }
      opts.data = { kind: 'json', value: text };
      if (!opts.method) opts.method = 'POST';
      // set content-type later if not provided
    } else if (a === '-F' || a === '--form') {
      const v = args.shift();
      if (!v) die('Missing value for --form');
      // name=value or name=@file
      const eq = v.indexOf('=');
      if (eq < 1) die(`Invalid --form part: ${v}`);
      const name = v.slice(0, eq);
      const rhs = v.slice(eq + 1);
      if (rhs.startsWith('@')) {
        const path = rhs.slice(1);
        if (!existsSync(path)) die(`No such file for --form: ${path}`);
        const data = readFileSync(path);
        const filename = path.split(/[\\/]/).pop() || 'file';
        opts.form.push({ name, value: { filePath: path, data, filename } });
      } else {
        opts.form.push({ name, value: rhs });
      }
      if (!opts.method) opts.method = 'POST';
    } else if (a === '-o' || a === '--output') {
      opts.output = args.shift() || die('Missing value for --output');
    } else if (a === '-i' || a === '--include') {
      opts.include = true;
    } else if (a === '-s' || a === '--silent') {
      opts.silent = true;
    } else if (a === '-v' || a === '--verbose') {
      opts.verbose = true;
    } else if (a === '-L' || a === '--location') {
      opts.follow = true; // default; provided for compatibility
    } else if (a === '--max-time') {
      const sec = Number(args.shift());
      if (!Number.isFinite(sec) || sec <= 0) die('Invalid --max-time value');
      opts.maxTimeMs = sec * 1000;
    } else if (a === '--snowflake-url') {
      opts.snowflakeUrl =
        args.shift() || die('Missing value for --snowflake-url');
    } else if (a.startsWith('-')) {
      die(`Unknown option: ${a}`);
    } else {
      // Positional URL (take the last non-option as URL)
      opts.url = a;
      // Consume any trailing token that might be URL fragments… not needed.
    }
  }
  return opts;
}

function hasHeader(headers: [string, string][], name: string): boolean {
  const n = name.toLowerCase();
  return headers.some(([k]) => k.toLowerCase() === n);
}

function formatError(error: unknown): string {
  // Handle standard Error objects
  if (error instanceof Error) {
    return error.message;
  }

  // Handle ErrorEvent objects (common with WebSocket errors)
  if (
    error &&
    typeof error === 'object' &&
    'type' in error &&
    'message' in error
  ) {
    const errorEvent = error as ErrorEvent;
    return errorEvent.message || `${errorEvent.type} event`;
  }

  // Handle CloseEvent objects (WebSocket close events)
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    'reason' in error
  ) {
    const closeEvent = error as CloseEvent;
    return closeEvent.reason || `WebSocket closed with code ${closeEvent.code}`;
  }

  // Handle generic Event objects
  if (error && typeof error === 'object' && 'type' in error) {
    const event = error as Event;
    return `${event.type} event`;
  }

  // Fallback for other types
  return String(error);
}

function getErrorDetails(error: unknown): string {
  if (error instanceof Error) {
    return `Error: ${error.name}: ${error.message}\nStack: ${error.stack}`;
  }

  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    const details: string[] = [];

    // Collect relevant properties
    if ('type' in obj) details.push(`type: ${obj.type}`);
    if ('message' in obj) details.push(`message: ${obj.message}`);
    if ('code' in obj) details.push(`code: ${obj.code}`);
    if ('reason' in obj) details.push(`reason: ${obj.reason}`);
    if ('target' in obj && obj.target) {
      const target = obj.target as Record<string, unknown>;
      details.push(`target: ${target.constructor?.name || 'unknown'}`);
    }

    return details.length > 0
      ? details.join(', ')
      : 'No additional details available';
  }

  return String(error);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.url) die('Usage: curl.ts [options] <url>');

  const controller = new AbortController();
  let timeout: NodeJS.Timeout | undefined;
  if (opts.maxTimeMs) {
    timeout = setTimeout(() => controller.abort(), opts.maxTimeMs);
  }

  const headers = new Headers();
  for (const [k, v] of opts.headers) headers.append(k, v);

  let body: BodyInit | undefined;
  let method = opts.method || 'GET';

  if (opts.form.length) {
    const form = new FormData();
    for (const part of opts.form) {
      if (typeof part.value === 'string') {
        form.append(part.name, part.value);
      } else {
        const b = new Blob([new Uint8Array(part.value.data)]);
        form.append(part.name, b, part.value.filename);
      }
    }
    body = form as unknown as BodyInit;
    // FormData sets its own content-type with boundary.
  } else if (opts.data) {
    if (opts.data.kind === 'json') {
      if (!hasHeader(Array.from(headers.entries()), 'Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      body = opts.data.value as string;
    } else if (opts.data.kind === 'raw') {
      if (!hasHeader(Array.from(headers.entries()), 'Content-Type')) {
        headers.set('Content-Type', 'application/x-www-form-urlencoded');
      }
      body = opts.data.value as string;
    } else {
      // binary
      body = new Uint8Array(opts.data.value as Buffer);
      if (!hasHeader(Array.from(headers.entries()), 'Content-Type')) {
        headers.set('Content-Type', 'application/octet-stream');
      }
    }
  }

  // If method is GET/HEAD and body present, switch to POST like curl does when -d is given without -X
  if ((method === 'GET' || method === 'HEAD') && body !== undefined) {
    method = 'POST';
  }

  const reqInit: RequestInit = {
    method,
    headers,
    body,
    redirect: opts.follow ? 'follow' : 'manual',
    signal: controller.signal,
    // Note: no per-request TLS "insecure" option available with built-in fetch.
  };

  if (opts.verbose && !opts.silent) {
    stderr.write(`> ${method} ${opts.url}\n`);
    headers.forEach((v, k) => stderr.write(`> ${k}: ${v}\n`));
    if (body !== undefined) {
      const size =
        typeof body === 'string'
          ? Buffer.byteLength(body, 'utf8')
          : body instanceof Blob
            ? body.size
            : body instanceof Uint8Array
              ? body.byteLength
              : 'unknown';
      stderr.write(`> (body ${size} bytes)\n`);
    }
  }

  const snowflakeUrl = opts.snowflakeUrl || 'wss://snowflake.torproject.net/';

  let res: Response;
  try {
    const fetchOptions: RequestInit & {
      connectionTimeout?: number;
      circuitTimeout?: number;
      onLog?: (message: string, type?: 'info' | 'success' | 'error') => void;
    } = { ...reqInit };

    // Enable TorClient logging in verbose mode
    if (opts.verbose && !opts.silent) {
      fetchOptions.onLog = (
        message: string,
        type?: 'info' | 'success' | 'error'
      ) => {
        const prefix =
          type === 'error' ? '! ' : type === 'success' ? '✓ ' : '> ';
        stderr.write(`${prefix}${message}\n`);
      };
    }

    res = await TorClient.fetch(snowflakeUrl, opts.url, fetchOptions);
  } catch (e: unknown) {
    if (timeout) clearTimeout(timeout);
    const message = formatError(e);

    // In verbose mode, also show the error object details
    if (opts.verbose && !opts.silent) {
      stderr.write(`Error details: ${getErrorDetails(e)}\n`);
    }

    die(`Request failed: ${message}`, 7);
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  const headerBlock = (() => {
    const lines: string[] = [];
    lines.push(`HTTP ${res.status} ${res.statusText}`);
    res.headers.forEach((v, k) => lines.push(`${k}: ${v}`));
    return lines.join('\n');
  })();

  if ((opts.include || opts.verbose) && !opts.silent) {
    stderr.write(`${headerBlock}\n`);
    if (opts.include) stderr.write('\n');
  }

  // Body
  const arrayBuf = await res.arrayBuffer();
  const buf = Buffer.from(arrayBuf);

  if (opts.output) {
    writeFileSync(opts.output, buf);
    if (!opts.silent)
      stderr.write(`Saved to ${opts.output} (${buf.length} bytes)\n`);
  } else {
    // When -i, curl prints headers into stdout before body; we mimic that
    if (opts.include) {
      stdout.write(headerBlock + '\n\n');
    }
    stdout.write(buf);

    // Force flush of stdout buffer to ensure all data is written
    // This is especially important for binary data or when piping output
    stdout.write('');
  }

  if (opts.verbose) {
    console.log('\n> done');
  }

  // Exit code like curl: non-zero on HTTP errors if --fail was used.
  // We don’t implement --fail; always exit 0 unless fetch errored.

  // FIXME: This shouldn't be needed, but nodejs is not exiting otherwise due
  // to things not being cleaned up in TorClient.
  process.exit(0);
}

main().catch(e => {
  const message = formatError(e);
  die(`Unhandled error: ${message}`);
});
