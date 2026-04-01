
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

const dataDir = path.join(process.cwd(), "data");

function readJson(file) {
  const filePath = path.join(dataDir, file);
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, "utf8").trim();
  return text ? JSON.parse(text) : [];
}

function writeJson(file, data) {
  fs.writeFileSync(path.join(dataDir, file), JSON.stringify(data, null, 2), "utf8");
}

function needsHash(value) {
  const s = String(value || "");
  return !(s.startsWith("$2a$") || s.startsWith("$2b$") || s.startsWith("$2y$"));
}

async function main() {
  const users = readJson("users.json");
  let changed = 0;

  for (const user of users) {
    if (needsHash(user.password)) {
      user.password = await bcrypt.hash(String(user.password || "123456"), 10);
      changed += 1;
    }
  }

  writeJson("users.json", users);
  console.log(`Rehashed ${changed} legacy user passwords in data/users.json`);
}

main().catch((error) => {
  console.error("REHASH ERROR:", error);
  process.exit(1);
});
