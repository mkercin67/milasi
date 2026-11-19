// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Deterministic identifier generation for ScoreForge schema migrations.
 *
 * Derives stable UUID-formatted identifiers from structured inputs
 * (staffId, measureId, voiceIndex, counter) using a pure 128-bit FNV-1a hash.
 * Guaranteed to be byte-identical across platforms, Node, and browsers.
 */

/**
 * Computes two 64-bit FNV-1a hashes over the input string to generate
 * a 128-bit deterministic hex string formatted as a standard RFC4122-style UUID.
 *
 * @param staffId - Unique identifier of the staff.
 * @param measureId - Unique identifier of the measure definition.
 * @param voiceIndex - 1-based voice index (1..4).
 * @param counter - Sequence counter for multiple items within the same voice/measure.
 * @param domain - Optional domain discriminator (e.g. 'voice' or 'rest').
 * @returns Deterministic UUID string.
 */
export function generateDeterministicId(
  staffId: string,
  measureId: string,
  voiceIndex: number,
  counter: number,
  domain: string = 'id'
): string {
  const seed = `${domain}:${staffId}:${measureId}:${voiceIndex}:${counter}`;

  // 64-bit FNV-1a prime and offset bases
  // FNV-1a Pass 1
  let h1 = 0xcbf29ce484222325n;
  const p1 = 0x100000001b3n;

  // FNV-1a Pass 2 (different initial seed for independent high 64 bits)
  let h2 = 0x84222325cbf29ce4n;
  const p2 = 0x100000001b3n;

  for (let i = 0; i < seed.length; i++) {
    const code = BigInt(seed.charCodeAt(i));
    h1 ^= code;
    h1 = (h1 * p1) & 0xffffffffffffffffn;

    h2 ^= code;
    h2 = (h2 * p2) & 0xffffffffffffffffn;
  }

  // Format into 32 hex characters
  const hex1 = h1.toString(16).padStart(16, '0');
  const hex2 = h2.toString(16).padStart(16, '0');
  const hex32 = hex1 + hex2;

  // Format as RFC4122 v4/v5 shape: 8-4-4-4-12
  const pA = hex32.slice(0, 8);
  const pB = hex32.slice(8, 12);
  const pC = '4' + hex32.slice(13, 16); // version 4/deterministic
  const pD = ((parseInt(hex32.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + hex32.slice(18, 20);
  const pE = hex32.slice(20, 32);

  return `${pA}-${pB}-${pC}-${pD}-${pE}`;
}
