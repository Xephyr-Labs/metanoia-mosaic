import { cp, readFile, rm, writeFile } from "node:fs/promises";

const output = new URL("../dist/", import.meta.url);
await rm(output, { recursive: true, force: true });
await cp(new URL("../src/", import.meta.url), output, { recursive: true });
const template = new URL("templates/express/package.json", output);
const app = JSON.parse(await readFile(template, "utf8"));
for (const folder of ["core", "widget"]) {
  const pkg = JSON.parse(await readFile(new URL(`../../${folder}/package.json`, import.meta.url), "utf8"));
  app.dependencies[pkg.name] = `^${pkg.version}`;
}
await writeFile(template, `${JSON.stringify(app, null, 2)}\n`);
