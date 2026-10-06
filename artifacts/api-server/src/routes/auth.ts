import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, supportUsersTable } from "@workspace/db";
import {
  DemoLoginBody,
  DemoLoginResponse,
  DemoLogoutResponse,
  GetCurrentUserResponse,
} from "@workspace/api-zod";
import {
  clearDemoSessionCookie,
  getSessionUser,
  setDemoSessionCookie,
  toApiUser,
} from "../lib/session";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = DemoLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const defaultUserId =
    parsed.data.role === "admin"
      ? "admin-001"
      : parsed.data.role === "agent"
        ? "agent-001"
        : "customer-001";
  const [user] = await db
    .select()
    .from(supportUsersTable)
    .where(eq(supportUsersTable.id, parsed.data.userId ?? defaultUserId))
    .limit(1);
  if (!user || user.role !== parsed.data.role) {
    res.status(404).json({ error: "That demo account is not available." });
    return;
  }

  setDemoSessionCookie(res, user.id);
  res.json(DemoLoginResponse.parse({ user: toApiUser(user), demoMode: true }));
});

router.post("/auth/logout", (_req, res): void => {
  clearDemoSessionCookie(res);
  res.json(DemoLogoutResponse.parse({ success: true }));
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const user = await getSessionUser(req);
  res.json(
    GetCurrentUserResponse.parse({
      user: user ? toApiUser(user) : null,
      demoMode: true,
    }),
  );
});

export default router;
