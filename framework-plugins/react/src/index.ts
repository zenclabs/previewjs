import type { Component } from "@previewjs/component-detection-api";
import type { FrameworkPluginFactory } from "@previewjs/core";
import { createTypeAnalyzer } from "@previewjs/type-analyzer";
import { createFileSystemReader, createStackedReader } from "@previewjs/vfs";
import react from "@vitejs/plugin-react";
import path from "path";
import ts from "typescript";
import url from "url";
import { extractReactComponents } from "./extract-component.js";
import { reactImportsPlugin } from "./react-js-imports-plugin.js";
import { REACT_SPECIAL_TYPES } from "./special-types.js";

const reactFrameworkPlugin: FrameworkPluginFactory = {
  isCompatible: async (dependencies) => {
    const version = await dependencies["react"]?.readInstalledVersion();
    if (!version) {
      return false;
    }
    const [major, minor] = version.split(".").map((n) => parseInt(n)) as [
      number,
      number
    ];
    if (isNaN(major) || isNaN(minor)) {
      return false;
    }
    return major >= 17 || (major === 16 && minor >= 14);
  },
  async create({ rootDir, reader, logger, dependencies }) {
    const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
    const previewDirPath = path.join(__dirname, "..", "preview");
    const typeAnalyzer = createTypeAnalyzer({
      rootDir,
      reader: createStackedReader([
        reader,
        createFileSystemReader({
          mapping: {
            from: path.join(previewDirPath, "types"),
            to: path.join(rootDir, "node_modules", "@types"),
          },
          watch: false,
        }),
      ]),
      specialTypes: REACT_SPECIAL_TYPES,
      tsCompilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        jsxImportSource: "react",
      },
    });
    return {
      pluginApiVersion: 4,
      name: "@previewjs/plugin-react",
      defaultWrapperPath: "__previewjs__/Wrapper.tsx",
      previewDirPath,
      typeAnalyzer,
      detectComponents: async (absoluteFilePaths) => {
        const resolver = typeAnalyzer.analyze(absoluteFilePaths);
        const components: Component[] = [];
        for (const absoluteFilePath of absoluteFilePaths) {
          components.push(
            ...extractReactComponents(
              logger,
              resolver,
              rootDir,
              absoluteFilePath
            )
          );
          // Ensure this potentially long-running function doesn't block the thread.
          await 0;
        }
        return components;
      },
      viteConfig: (configuredPlugins) => {
        const hasReactPlugin = configuredPlugins.find((plugin) =>
          plugin.name.startsWith("vite:react-")
        );
        return {
          resolve: {
            alias: {
              "react-native": "react-native-web",
            },
          },
          plugins: [
            reactImportsPlugin(),
            ...configuredPlugins,
            ...(!hasReactPlugin
              ? [
                  // @ts-ignore
                  react(),
                ]
              : []),
            {
              name: "previewjs:update-react-import",
              async transform(code: string, id: string) {
                if (!id.endsWith("__previewjs_internal__/renderer/index.tsx")) {
                  return;
                }
                const reactVersion = parseInt(
                  (await dependencies["react"]?.readInstalledVersion()) || "0"
                );
                return code.replace(
                  /__PREVIEWJS_PLUGIN_REACT_IMPORT_PATH__/g,
                  reactVersion >= 18 ? "./render-18" : "./render-16"
                );
              },
            },
            {
              name: "previewjs:disable-react-hmr",
              async transform(code: string, id: string) {
                if (!id.endsWith(".jsx") && !id.endsWith(".tsx")) {
                  return null;
                }
                // HMR prevents preview props from being refreshed.
                // For now, we disable it entirely.
                return code.replace(/import\.meta\.hot/g, "false");
              },
            },
          ],
          define: {
            "process.env.RUNNING_INSIDE_PREVIEWJS": "1",
          },
        };
      },
      dispose: () => {
        typeAnalyzer.dispose();
      },
    };
  },
};

export default reactFrameworkPlugin;
