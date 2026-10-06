import { desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, conversationMessagesTable, supportSettingsTable } from "@workspace/db";
import {
  GetAnalyticsResponse,
  GetDashboardResponse,
  GetSupportSettingsResponse,
  UpdateSupportSettingsBody,
  UpdateSupportSettingsResponse,
} from "@workspace/api-zod";
import { requireSession } from "../lib/session";
import { listConversationRecords, mapConversationSummaries } from "../lib/support-data";

const router: IRouter = Router();
const staffRoles = ["agent", "admin"] as const;

async function supportSettings() {
  const [settings] = await db
    .select()
    .from(supportSettingsTable)
    .where(eq(supportSettingsTable.id, 1))
    .limit(1);
  if (settings) return settings;
  const [created] = await db
    .insert(supportSettingsTable)
    .values({ id: 1, confidenceThreshold: 0.72 })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [retried] = await db
    .select()
    .from(supportSettingsTable)
    .where(eq(supportSettingsTable.id, 1))
    .limit(1);
  if (!retried) throw new Error("Support settings could not be loaded.");
  return retried;
}

function countBy<T extends string>(
  values: T[],
  allLabels: readonly T[],
) {
  return allLabels.map((label) => ({
    label,
    count: values.filter((value) => value === label).length,
  }));
}

async function averageFirstResponseMinutes(conversationIds: string[]) {
  if (conversationIds.length === 0) return 0;
  const messages = await db
    .select()
    .from(conversationMessagesTable)
    .where(eq(conversationMessagesTable.senderType, "customer"))
    .orderBy(desc(conversationMessagesTable.createdAt));
  const responseMessages = await db
    .select()
    .from(conversationMessagesTable)
    .where(eq(conversationMessagesTable.senderType, "ai"))
    .orderBy(desc(conversationMessagesTable.createdAt));
  const seconds: number[] = [];
  for (const id of conversationIds) {
    const firstCustomer = messages
      .filter((message) => message.conversationId === id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    const firstResponse = responseMessages
      .filter((message) => message.conversationId === id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    if (firstCustomer && firstResponse) {
      seconds.push(
        Math.max(0, (firstResponse.createdAt.getTime() - firstCustomer.createdAt.getTime()) / 1000),
      );
    }
  }
  if (seconds.length === 0) return 0;
  return Math.round((seconds.reduce((total, value) => total + value, 0) / seconds.length / 60) * 10) / 10;
}

router.get("/dashboard", async (req, res): Promise<void> => {
  const user = await requireSession(req, res, staffRoles);
  if (!user) return;
  const records = await listConversationRecords();
  const summaries = await mapConversationSummaries(records);
  const total = records.length;
  const resolved = records.filter((record) => record.status === "resolved").length;
  const pending = records.filter((record) => record.status === "waiting_for_agent").length;
  const active = total - resolved;
  const aiResolved = records.filter((record) => record.aiResolved).length;
  const responseMinutes = await averageFirstResponseMinutes(records.map((record) => record.id));
  res.json(
    GetDashboardResponse.parse({
      totalConversations: total,
      activeConversations: active,
      pendingEscalations: pending,
      resolvedConversations: resolved,
      averageResponseMinutes: responseMinutes,
      aiResolutionRate: total ? Math.round((aiResolved / total) * 1000) / 10 : 0,
      recentConversations: summaries.slice(0, 7),
      priorityCounts: countBy(
        records.map((record) => record.priority),
        ["low", "medium", "high", "critical"] as const,
      ),
    }),
  );
});

router.get("/analytics", async (req, res): Promise<void> => {
  const user = await requireSession(req, res, staffRoles);
  if (!user) return;
  const records = await listConversationRecords();
  const total = records.length;
  const aiResolved = records.filter((record) => record.aiResolved).length;
  const escalated = records.filter((record) => record.ticketNumber !== null).length;
  const resolvedRecords = records.filter(
    (record) => record.status === "resolved" && record.resolvedAt,
  );
  const averageResolutionMinutes = resolvedRecords.length
    ? Math.round(
        (resolvedRecords.reduce(
          (sum, record) =>
            sum +
            Math.max(0, record.resolvedAt!.getTime() - record.createdAt.getTime()) / 60_000,
          0,
        ) /
          resolvedRecords.length) *
          10,
      ) / 10
    : 0;
  const weeklyVolume = Array.from({ length: 7 }, (_, index) => {
    const dayDate = new Date();
    dayDate.setDate(dayDate.getDate() - (6 - index));
    const dayRecords = records.filter(
      (record) => record.createdAt.toDateString() === dayDate.toDateString(),
    );
    return {
      day: dayDate.toLocaleDateString("en-US", { weekday: "short" }),
      conversations: dayRecords.length,
      aiResolved: dayRecords.filter((record) => record.aiResolved).length,
      escalated: dayRecords.filter((record) => record.ticketNumber !== null).length,
    };
  });
  res.json(
    GetAnalyticsResponse.parse({
      totalConversations: total,
      aiResolvedConversations: aiResolved,
      humanEscalatedConversations: escalated,
      aiResolutionRate: total ? Math.round((aiResolved / total) * 1000) / 10 : 0,
      averageResponseMinutes: await averageFirstResponseMinutes(records.map((record) => record.id)),
      averageResolutionMinutes,
      openTickets: records.filter((record) => record.ticketNumber && record.status !== "resolved").length,
      resolvedTickets: records.filter((record) => record.ticketNumber && record.status === "resolved").length,
      weeklyVolume,
      statusBreakdown: countBy(
        records.map((record) => record.status),
        ["ai_handling", "waiting_for_agent", "assigned", "in_progress", "resolved"] as const,
      ),
    }),
  );
});

router.get("/settings", async (req, res): Promise<void> => {
  const user = await requireSession(req, res, staffRoles);
  if (!user) return;
  const settings = await supportSettings();
  res.json(GetSupportSettingsResponse.parse({
    confidenceThreshold: settings.confidenceThreshold,
  }));
});

router.put("/settings", async (req, res): Promise<void> => {
  const user = await requireSession(req, res, ["admin"]);
  if (!user) return;
  const parsed = UpdateSupportSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [settings] = await db
    .insert(supportSettingsTable)
    .values({
      id: 1,
      confidenceThreshold: parsed.data.confidenceThreshold,
    })
    .onConflictDoUpdate({
      target: supportSettingsTable.id,
      set: { confidenceThreshold: parsed.data.confidenceThreshold },
    })
    .returning();
  res.json(
    UpdateSupportSettingsResponse.parse({
      confidenceThreshold: settings.confidenceThreshold,
    }),
  );
});

export default router;
