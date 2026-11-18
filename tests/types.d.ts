// SPDX-License-Identifier: GPL-3.0-or-later
declare module 'node:fs' {
  export function existsSync(filepath: string): boolean;
  export function readdirSync(dir: string, options?: { withFileTypes?: boolean }): Array<{ name: string; isDirectory(): boolean }>;
  export function readFileSync(filepath: string, encoding: string): string;
}

declare module 'node:path' {
  export function resolve(...paths: string[]): string;
  export function join(...paths: string[]): string;
  export function basename(filepath: string, ext?: string): string;
}

declare module 'node:child_process' {
  export function execSync(command: string, options?: { encoding?: string }): string;
}
