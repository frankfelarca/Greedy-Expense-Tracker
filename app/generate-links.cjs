const { createHash } = require("crypto");
const { readFileSync } = require("fs");
const { resolve } = require("path");

const envPath = resolve(__dirname, ".env");
const envContent = readFileSync(envPath, "utf-8");
const env = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const salt = env.VITE_ADMIN_SALT || "";
const baseUrl =
  process.argv[2] || "https://stphiqcdtmcp001.z11.web.core.windows.net";
const names = process.argv.slice(3);

if (names.length === 0) {
  console.log("Usage: node generate-links.cjs <base-url> <name1> <name2> ...");
  console.log(
    "Example: node generate-links.cjs https://stphiqcdtmcp001.z11.web.core.windows.net Frank John Maria",
  );
  process.exit(1);
}

console.log("\nGenerated user links:\n");
names.forEach((name) => {
  const hash = createHash("sha256")
    .update(salt + name.trim().toLowerCase())
    .digest("hex");
  console.log(`  ${name}: ${baseUrl}/?u=${hash}`);
});
console.log("");
