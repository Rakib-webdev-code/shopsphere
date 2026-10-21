import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Resolves the project's `@/*` TypeScript alias for `node --test` runs.
// Node 24 strips the types itself; this hook only handles path mapping.
const srcRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src",
);

function resolveSourceFile(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const resolved = resolveSourceFile(
        path.join(srcRoot, specifier.slice("@/".length)),
      );

      if (resolved) {
        return {
          url: pathToFileURL(resolved).href,
          shortCircuit: true,
        };
      }
    }

    return nextResolve(specifier, context);
  },
});
