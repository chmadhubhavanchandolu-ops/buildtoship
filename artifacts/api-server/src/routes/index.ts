import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import conversationRouter from "./conversations";
import ticketRouter from "./tickets";
import knowledgeBaseRouter from "./knowledge-base";
import dashboardRouter from "./dashboard";
import usersRouter from "./users";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(conversationRouter);
router.use(ticketRouter);
router.use(knowledgeBaseRouter);
router.use(dashboardRouter);
router.use(usersRouter);

export default router;
