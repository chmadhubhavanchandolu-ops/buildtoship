import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, supportUsersTable, type SupportUser } from "@workspace/db";

export const SESSION_COOKIE = "supportdesk_session";

export function toApiUser(user: SupportUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
  };
}

export async function getSessionUser(req: Request): Promise<SupportUser | null> {
  const signedCookies = req.signedCookies as Record<string, string | false> | undefined;
  const userId = signedCookies?.[SESSION_COOKIE];
  if (typeof userId !== "string" || userId.length === 0) return null;

  const [user] = await db
    .select()
    .from(supportUsersTable)
    .where(eq(supportUsersTable.id, userId))
    .limit(1);
  return user ?? null;
}

export async function requireSession(
  req: Request,
  res: Response,
  roles: readonly string[] = [],
): Promise<SupportUser | null> {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Sign in to continue." });
    return null;
  }
  if (roles.length > 0 && !roles.includes(user.role)) {
    res.status(403).json({ error: "You do not have access to this action." });
    return null;
  }
  return user;
}

export function mayAccessConversation(
  user: SupportUser,
  customerId: string,
): boolean {
  return user.role !== "customer" || user.id === customerId;
}

export function setDemoSessionCookie(res: Response, userId: string): void {
  res.cookie(SESSION_COOKIE, userId, {
    signed: true,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: "/api",
  });
}

export function clearDemoSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api",
  });
}
