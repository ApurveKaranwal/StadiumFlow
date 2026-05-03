import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import gateRoutes from "./routes/gateRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import rewardRoutes from "./routes/rewardRoutes.js";
import updateRoutes from "./routes/updateRoutes.js";

export const app = express();

app.use(
  cors({
    origin: env.clientOrigin
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/gates", gateRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/updates", updateRoutes);
app.use("/api/rewards", rewardRoutes);
