// electron.vite.config.ts
import { resolve as resolve2 } from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, externalizeDepsPlugin, bytecodePlugin } from "electron-vite";
import vue from "@vitejs/plugin-vue";
import tsconfigPaths from "vite-tsconfig-paths";

// vite-plugin-readme.ts
import { readFileSync } from "fs";
import { resolve } from "path";
var __electron_vite_injected_dirname = "C:\\Users\\AA\\Documents\\Development\\Panopticon";
function readmePlugin() {
  const virtualModuleId = "virtual:readme";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;
  return {
    name: "vite-plugin-readme",
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
      return null;
    },
    load(id) {
      if (id === resolvedVirtualModuleId) {
        const readmePath = resolve(__electron_vite_injected_dirname, "README.md");
        const content = readFileSync(readmePath, "utf-8");
        return `export default ${JSON.stringify(content)}`;
      }
      return null;
    }
  };
}

// electron.vite.config.ts
var __electron_vite_injected_dirname2 = "C:\\Users\\AA\\Documents\\Development\\Panopticon";
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin(),
      bytecodePlugin()
      // No PDFium WASM copying needed when using Chromium's built-in viewer
    ]
  },
  preload: {
    plugins: [externalizeDepsPlugin(), bytecodePlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        "@renderer": resolve2("src/renderer/src"),
        "@": resolve2(__electron_vite_injected_dirname2, "./src/renderer/src")
      }
    },
    publicDir: resolve2(__electron_vite_injected_dirname2, "public"),
    plugins: [vue(), tailwindcss(), tsconfigPaths(), readmePlugin()]
  }
});
export {
  electron_vite_config_default as default
};
