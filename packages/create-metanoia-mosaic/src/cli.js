#!/usr/bin/env node
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseArgs } from "node:util";

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: npm create metanoia-mosaic -- [--name my-app] [--template express] [--yes]");
  process.exit(0);
}
let prompt;
try {
  const { values } = parseArgs({ args, options: {
    name: { type: "string" }, template: { type: "string" },
    yes: { type: "boolean", short: "y" },
  } });
  const templateArg = values.template;
  const nameArg = values.name;
  prompt = values.yes || !stdin.isTTY ? undefined : createInterface({ input: stdin, output: stdout });
  const template = templateArg ?? ((prompt ? await prompt.question("Template (express): ") : "express") || "express");
  const projectName = nameArg ?? ((prompt ? await prompt.question("Project directory (my-assistant): ") : "my-assistant") || "my-assistant");
  if (template !== "express") throw new Error(`Unknown template '${template}'. Available templates: express.`);
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(projectName)) throw new Error("Choose a directory name using letters, numbers, dots, underscores, and hyphens.");
  const destination = path.resolve(projectName);
  const source = fileURLToPath(new URL("./templates/express/", import.meta.url));
  await mkdir(destination, { recursive: false });
  await cp(source, destination, { recursive: true });
  const packagePath = path.join(destination, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  packageJson.name = projectName.toLowerCase();
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  console.log(`\nCreated ${projectName}. Next:\n  cd ${projectName}\n  cp .env.example .env\n  npm install\n  npm run dev\n\nAdd your application's authenticated identity resolver in src/auth.js before exposing the server.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  prompt?.close();
}
