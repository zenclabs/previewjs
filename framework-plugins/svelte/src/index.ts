import { generateComponentId } from "@previewjs/api";
import type {
  AnalyzableComponent,
  FrameworkPluginFactory,
} from "@previewjs/core";
import type sveltekit from "@sveltejs/kit";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import fs from "fs-extra";
import path from "path";
import url from "url";
import { mergeConfig } from "vite";
import { analyzeSvelteComponentFromSFC } from "./analyze-component.js";
import { createSvelteTypeScriptReader } from "./svelte-reader.js";

const svelteFrameworkPlugin: FrameworkPluginFactory = {
  isCompatible: async (dependencies) => {
    const version = await dependencies["svelte"]?.readInstalledVersion();
    if (!version) {
      return false;
    }
    return parseInt(version) === 3;
  },
  async create({ rootDirPath }) {
    const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
    const previewDirPath = path.resolve(__dirname, "..", "preview");
    const svelteConfigPath = path.join(rootDirPath, "svelte.config.js");
    let alias: Record<string, string> = {};
    if (await fs.pathExists(svelteConfigPath)) {
      // Source: https://github.com/sveltejs/kit/blob/168547325c0044bc97c9c60aba1b70942dde22fe/packages/kit/src/core/config/index.js#L70
      const config: sveltekit.Config = await import(
        `${url.pathToFileURL(svelteConfigPath).href}?ts=${Date.now()}`
      );
      alias = config.kit?.alias || {};
    }
    return {
      pluginApiVersion: 3,
      name: "@previewjs/plugin-svelte",
      transformReader: (reader) => createSvelteTypeScriptReader(reader),
      defaultWrapperPath: "__previewjs__/Wrapper.svelte",
      previewDirPath,
      detectComponents: async (reader, typeAnalyzer, absoluteFilePaths) => {
        const components: AnalyzableComponent[] = [];
        for (const absoluteFilePath of absoluteFilePaths) {
          if (absoluteFilePath.endsWith(".svelte")) {
            const entry = await reader.read(absoluteFilePath);
            if (entry?.kind !== "file") {
              continue;
            }
            components.push({
              componentId: generateComponentId({
                filePath: path.relative(rootDirPath, absoluteFilePath),
                name: path.basename(
                  absoluteFilePath,
                  path.extname(absoluteFilePath)
                ),
              }),
              offsets: [[0, (await entry.read()).length]],
              info: {
                kind: "component",
                exported: true,
                analyze: async () =>
                  analyzeSvelteComponentFromSFC(typeAnalyzer, absoluteFilePath),
              },
            });
          }
          // TODO: Storybook support.
        }
        return components;
      },
      viteConfig: (configuredPlugins) => ({
        define: {
          __SVELTEKIT_DEV__: "false",
          __SVELTEKIT_APP_VERSION_POLL_INTERVAL__: "0",
        },
        resolve: {
          alias: {
            $app: "node_modules/@sveltejs/kit/src/runtime/app",
            ...alias,
          },
        },
        plugins: [
          ...configuredPlugins.filter(
            (plugin) =>
              plugin.name !== "vite-plugin-svelte-kit" &&
              plugin.name !== "vite-plugin-sveltekit-build" &&
              plugin.name !== "vite-plugin-sveltekit-middleware" &&
              plugin.name !== "vite-plugin-sveltekit-setup" &&
              plugin.name !== "vite-plugin-sveltekit-compile"
          ),
          configuredPlugins.find(
            (plugin) =>
              plugin.name.includes("sveltekit") ||
              plugin.name.includes("svelte-kit")
          )
            ? {
                name: "previewjs:sveltekit-static-dir",
                config: (config) => {
                  return mergeConfig(
                    {
                      publicDir: "static",
                    },
                    config
                  );
                },
              }
            : null,
          configuredPlugins.find((plugin) => plugin.name.includes("svelte"))
            ? null
            : svelte(),
          {
            name: "previewjs:fake-sveltekit-client",
            transform(code, id) {
              if (
                id.includes("@sveltejs/kit/src/runtime/client/singletons.js")
              ) {
                // Prevent errors with missing client methods such as disable_scroll_handling.
                return code
                  .replace(`export let client`, `export let client = {}`)
                  .replace(
                    `url: notifiable_store({})`,
                    `url: notifiable_store(document.location)`
                  )
                  .replace(
                    `page: notifiable_store({})`,
                    `page: notifiable_store({ url: document.location })`
                  );
              }
              return null;
            },
          },
          {
            name: "previewjs:disable-svelte-hmr",
            async transform(code, id) {
              if (!id.endsWith(".svelte")) {
                return null;
              }
              return code.replace(/import\.meta\.hot/g, "false");
            },
          },
        ],
      }),
    };
  },
};

export default svelteFrameworkPlugin;
