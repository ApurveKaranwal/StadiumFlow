import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
dotenv.config({
  path: resolve(currentDirectory, "../../.env")
});

export const env = {
  port: Number(process.env.PORT ?? 4000),
  sqlitePath: process.env.SQLITE_PATH ?? "",
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000",
  reportVerificationThreshold: Number(process.env.REPORT_VERIFICATION_THRESHOLD ?? 3),
  reportRadiusMeters: Number(process.env.REPORT_RADIUS_METERS ?? 160),
  reportWindowMinutes: Number(process.env.REPORT_WINDOW_MINUTES ?? 8)
};
