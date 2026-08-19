import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" : GitHub Pages 하위 경로 배포 대응 (상대 경로 빌드)
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 5175, strictPort: true },
});
