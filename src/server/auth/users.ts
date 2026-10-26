import { eq } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { users } from "../db/schema";

export type User = typeof users.$inferSelect;

export async function findUserByEmail(db: AppDb, email: string): Promise<User | null> {
  const [row] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
  return row ?? null;
}

export async function findUserById(db: AppDb, id: string): Promise<User | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row ?? null;
}

export async function listUsers(db: AppDb): Promise<User[]> {
  return db.select().from(users);
}

/** Dados do usuário que podem ir para o navegador. */
export function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    device: user.deviceModel ? { model: user.deviceModel, os: user.deviceOs } : null,
    analystLevel: user.analystLevel,
    passwordChangedAt: user.passwordChangedAt,
  };
}
export type PublicUser = ReturnType<typeof publicUser>;
