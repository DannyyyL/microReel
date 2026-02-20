import { build, context } from "esbuild";
import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const dist = resolve(root, "dist");
const watchMode = process.argv.includes("--watch");

const shared = {
  bundle: true,
  sourcemap: true,
  target: "chrome120",
  platform: "browser",
  legalComments: "none",
  logLevel: "info"
};

const tasks = [
  {
    entryPoints: [resolve(root, "src/background.ts")],
    outfile: resolve(dist, "background.js"),
    format: "esm"
  },
  {
    entryPoints: [resolve(root, "src/content/index.ts")],
    outfile: resolve(dist, "content.js"),
    format: "esm"
  },
  {
    entryPoints: [resolve(root, "src/options/main.tsx")],
    outfile: resolve(dist, "options.js"),
    format: "esm"
  }
];

await mkdir(dist, { recursive: true });
await cp(resolve(root, "static"), dist, { recursive: true });

if (watchMode) {
  const contexts = await Promise.all(tasks.map((config) => context({ ...shared, ...config })));
  await Promise.all(contexts.map((item) => item.watch()));
  console.log("Watching extension sources...");
} else {
  await Promise.all(tasks.map((config) => build({ ...shared, ...config })));
}
