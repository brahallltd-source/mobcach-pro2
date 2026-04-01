import fs from "fs";
import path from "path";

export function dataPath(...segments: string[]) {
  return path.join(process.cwd(), "data", ...segments);
}

export function readJsonArray<T = any>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, "utf-8").trim();
  return text ? JSON.parse(text) : [];
}

export function writeJsonArray(filePath: string, data: unknown) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export function normalize(value: string) {
  return String(value || "").trim().toLowerCase();
}

export function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function nowIso() {
  return new Date().toISOString();
}
