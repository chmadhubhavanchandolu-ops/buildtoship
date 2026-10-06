import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET is required to sign demo sessions.");
}

const app: Express = express();

app.set("trust proxy", 1);
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(cookieParser(sessionSecret));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "That support API endpoint does not exist." });
});
app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(
    {
      requestId: req.id,
      errorType: error instanceof Error ? error.name : "UnknownError",
    },
    "Unhandled API request error",
  );
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

export default app;
