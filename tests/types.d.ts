declare module 'node:fs' {
  export function readdirSync(dir: string, options?: { withFileTypes?: boolean }): Array<{ name: string; isDirectory(): boolean }>;
  export function readFileSync(filepath: string, encoding: string): string;
}

declare module 'node:path' {
  export function resolve(...paths: string[]): string;
  export function join(...paths: string[]): string;
}
