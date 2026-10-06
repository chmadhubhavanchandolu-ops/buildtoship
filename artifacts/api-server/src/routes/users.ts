import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, supportUsersTable } from "@workspace/db";
import {
  GetUsersQueryParams,
  GetUsersResponse,
  UpdateUserBody,
  UpdateUserParams,
  UpdateUserResponse,
} from "@workspace/api-zod";
import { requireSession, toApiUser } from "../lib/session";

const router: IRouter = Router();

router.get("/users", async (req, res): Promise<void> => {
  const admin = await requireSession(req, res, ["admin"]);
  if (!admin) return;
  const query = GetUsersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const search = query.data.search?.trim().toLowerCase();
  let users = await db.select().from(supportUsersTable).orderBy(supportUsersTable.name);
  if (query.data.role) users = users.filter((user) => user.role === query.data.role);
  if (search) {
    users = users.filter((user) =>
      `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(search),
    );
  }
  res.json(GetUsersResponse.parse(users.map(toApiUser)));
});

router.patch("/users/:id", async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  const body = UpdateUserBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({
      error: !params.success ? params.error.message : body.error?.message ?? "Invalid request.",
    });
    return;
  }
  const admin = await requireSession(req, res, ["admin"]);
  if (!admin) return;
  const [target] = await db
    .select()
    .from(supportUsersTable)
    .where(eq(supportUsersTable.id, params.data.id))
    .limit(1);
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  if (target.role === "admin" && body.data.role !== "admin") {
    const admins = await db
      .select({ id: supportUsersTable.id })
      .from(supportUsersTable)
      .where(eq(supportUsersTable.role, "admin"));
    if (admins.length <= 1) {
      res.status(409).json({ error: "The last administrator cannot be demoted." });
      return;
    }
  }
  const [updated] = await db
    .update(supportUsersTable)
    .set({ role: body.data.role })
    .where(eq(supportUsersTable.id, target.id))
    .returning();
  res.json(UpdateUserResponse.parse(toApiUser(updated)));
});

export default router;
