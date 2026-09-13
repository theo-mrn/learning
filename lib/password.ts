import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

/**
 * Hachage de mot de passe avec `scrypt` de Node.
 *
 * Aucune dépendance ajoutée : `node:crypto` fournit scrypt (fonction de
 * dérivation à coût mémoire, conçue pour résister au matériel dédié) et
 * `timingSafeEqual`. Ça évite argon2/bcrypt, qui sont des modules natifs à
 * recompiler — cohérent avec le choix « auth maison, zéro dépendance ».
 *
 * Paramètres : N=2^15, r=8, p=1, soit ~32 Mo par vérification.
 *
 * `maxmem` doit être passé explicitement : la limite par défaut de Node est
 * de 32 Mo et N·r·128 l'atteint pile, ce qui fait échouer scrypt avec
 * `ERR_CRYPTO_INVALID_SCRYPT_PARAMS` (« memory limit exceeded »). Vérifié :
 * sans ce paramètre, le hachage lève au lieu de produire une empreinte.
 */
const PARAMS = {
  N: 32768,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
} as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** Format auto-descriptif : les paramètres voyagent avec l'empreinte, donc
 * les augmenter plus tard ne cassera pas les mots de passe existants. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await scryptAsync(password.normalize("NFKC"), salt, KEY_LENGTH, PARAMS);
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

/**
 * Vérifie un mot de passe. Ne lève jamais : une empreinte illisible renvoie
 * `false`, pour qu'un enregistrement corrompu ne devienne pas une erreur 500
 * exploitable pour distinguer les comptes.
 */
export async function verifyPassword(
  password: string,
  stored: string | null
): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, saltB64, keyB64] = parts;
  const params = {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: PARAMS.maxmem,
  };
  if (!Number.isFinite(params.N) || !Number.isFinite(params.r) || !Number.isFinite(params.p)) {
    return false;
  }

  try {
    const expected = Buffer.from(keyB64, "base64");
    const actual = await scryptAsync(
      password.normalize("NFKC"),
      Buffer.from(saltB64, "base64"),
      expected.length,
      params
    );
    // Comparaison à temps constant : un `===` fuiterait la longueur du
    // préfixe commun et rendrait l'empreinte attaquable octet par octet.
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
