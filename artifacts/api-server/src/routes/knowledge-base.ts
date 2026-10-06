import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { db, knowledgeArticlesTable } from "@workspace/db";
import {
  CreateKnowledgeArticleBody,
  CreateKnowledgeArticleResponse,
  DeleteKnowledgeArticleParams,
  DeleteKnowledgeArticleResponse,
  GetKnowledgeBaseQueryParams,
  GetKnowledgeBaseResponse,
  UpdateKnowledgeArticleBody,
  UpdateKnowledgeArticleParams,
  UpdateKnowledgeArticleResponse,
} from "@workspace/api-zod";
import { requireSession } from "../lib/session";

const router: IRouter = Router();
const editorRoles = ["agent", "admin"] as const;

function toArticle(article: typeof knowledgeArticlesTable.$inferSelect) {
  return {
    id: article.id,
    question: article.question,
    answer: article.answer,
    category: article.category,
    keywords: article.keywords,
    updatedAt: article.updatedAt.toISOString(),
  };
}

router.get("/knowledge-base", async (req, res): Promise<void> => {
  const user = await requireSession(req, res);
  if (!user) return;
  const query = GetKnowledgeBaseQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const search = query.data.search?.trim().toLowerCase();
  const category = query.data.category?.trim().toLowerCase();
  let articles = await db
    .select()
    .from(knowledgeArticlesTable)
    .orderBy(knowledgeArticlesTable.category, knowledgeArticlesTable.question);
  if (category) {
    articles = articles.filter((article) => article.category.toLowerCase() === category);
  }
  if (search) {
    articles = articles.filter((article) =>
      [article.question, article.answer, article.category, ...article.keywords]
        .some((value) => value.toLowerCase().includes(search)),
    );
  }
  res.json(GetKnowledgeBaseResponse.parse(articles.map(toArticle)));
});

router.post("/knowledge-base", async (req, res): Promise<void> => {
  const user = await requireSession(req, res, editorRoles);
  if (!user) return;
  const parsed = CreateKnowledgeArticleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [article] = await db
    .insert(knowledgeArticlesTable)
    .values({
      id: `faq-${randomUUID()}`,
      question: parsed.data.question.trim(),
      answer: parsed.data.answer.trim(),
      category: parsed.data.category.trim(),
      keywords: [...new Set(parsed.data.keywords.map((keyword) => keyword.trim()).filter(Boolean))],
    })
    .returning();
  res.status(201).json(CreateKnowledgeArticleResponse.parse(toArticle(article)));
});

router.put("/knowledge-base/:id", async (req, res): Promise<void> => {
  const params = UpdateKnowledgeArticleParams.safeParse(req.params);
  const body = UpdateKnowledgeArticleBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({
      error: !params.success ? params.error.message : body.error?.message ?? "Invalid request.",
    });
    return;
  }
  const user = await requireSession(req, res, editorRoles);
  if (!user) return;
  const [article] = await db
    .update(knowledgeArticlesTable)
    .set({
      question: body.data.question.trim(),
      answer: body.data.answer.trim(),
      category: body.data.category.trim(),
      keywords: [...new Set(body.data.keywords.map((keyword) => keyword.trim()).filter(Boolean))],
      updatedAt: new Date(),
    })
    .where(eq(knowledgeArticlesTable.id, params.data.id))
    .returning();
  if (!article) {
    res.status(404).json({ error: "Knowledge article not found." });
    return;
  }
  res.json(UpdateKnowledgeArticleResponse.parse(toArticle(article)));
});

router.delete("/knowledge-base/:id", async (req, res): Promise<void> => {
  const params = DeleteKnowledgeArticleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const user = await requireSession(req, res, editorRoles);
  if (!user) return;
  const [article] = await db
    .delete(knowledgeArticlesTable)
    .where(eq(knowledgeArticlesTable.id, params.data.id))
    .returning({ id: knowledgeArticlesTable.id });
  if (!article) {
    res.status(404).json({ error: "Knowledge article not found." });
    return;
  }
  res.json(DeleteKnowledgeArticleResponse.parse({ success: true }));
});

export default router;
