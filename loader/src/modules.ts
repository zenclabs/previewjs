import type * as core from "@previewjs/core";
import type * as vfs from "@previewjs/vfs";
import execa from "execa";
import { chmodSync, constants, existsSync, lstatSync, readdirSync } from "fs";
import path from "path";

export async function loadModules({
  installDir,
  packageName,
}: {
  installDir: string;
  packageName: string;
}) {
  await execa.command(
    `cd "${installDir}" && ./node_modules/pnpm/bin/pnpm.cjs install @previewjs/core`,
    {
      shell: true,
    }
  );
  const coreModule = requireModule("@previewjs/core") as typeof core;
  const vfsModule = requireModule("@previewjs/vfs") as typeof vfs;
  const setupEnvironment: core.SetupPreviewEnvironment =
    requireModule(packageName);
  const frameworkPluginFactories: core.FrameworkPluginFactory[] = [
    requireModule("@previewjs/plugin-react"),
    requireModule("@previewjs/plugin-solid"),
    requireModule("@previewjs/plugin-svelte"),
    requireModule("@previewjs/plugin-vue2"),
    requireModule("@previewjs/plugin-vue3"),
  ];

  function requireModule(name: string) {
    try {
      return require(require.resolve(name, {
        paths: [installDir],
      }));
    } catch (e) {
      console.error(`Unable to load ${name} from ${installDir}`, e);
      throw e;
    }
  }

  for (const f of readdirSync(path.join(installDir, "node_modules"))) {
    if (f.startsWith("esbuild-")) {
      const binPath = path.join(__dirname, "node_modules", f, "bin", "esbuild");
      if (
        existsSync(binPath) &&
        !(lstatSync(binPath).mode & constants.S_IXUSR)
      ) {
        chmodSync(binPath, "555");
      }
    }
  }

  return {
    core: coreModule,
    vfs: vfsModule,
    setupEnvironment,
    frameworkPluginFactories,
  };
}
