import bcrypt from "bcryptjs";

// Cost factor 12 balances hashing time (~150-250ms) against brute-force
// resistance. Re-evaluate upward as hardware improves.
const SALT_ROUNDS = 12;

const MIN_PASSWORD_LENGTH = 10;

export function isPasswordStrongEnough(password: string): boolean {
  if (password.length < MIN_PASSWORD_LENGTH) return false;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumberOrSymbol = /[0-9^$*.[\]{}()?"!@#%&/\\,><':;|_~`+=-]/.test(password);
  return hasLetter && hasNumberOrSymbol;
}

export async function hashPassword(plainTextPassword: string): Promise<string> {
  return bcrypt.hash(plainTextPassword, SALT_ROUNDS);
}

export async function verifyPassword(
  plainTextPassword: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(plainTextPassword, passwordHash);
}
