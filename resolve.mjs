// Lets plain Node import the web app's extensionless TypeScript and its `~/` alias.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const webSrc = path.join(process.cwd(), "src");
const EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

registerHooks({
  resolve(specifier, context, nextResolve) {
    let target;
    if (specifier.startsWith("~/")) target = path.join(webSrc, specifier.slice(2));
    else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:"))
      target = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    if (target && !existsSync(target)) {
      for (const extension of EXTENSIONS) {
        if (existsSync(target + extension)) {
          return nextResolve(pathToFileURL(target + extension).href, context);
        }
      }
    }
    if (target && specifier.startsWith("~/")) return nextResolve(pathToFileURL(target).href, context);
    return nextResolve(specifier, context);
  },
});
