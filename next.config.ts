import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * 静态导出：Tauri 会把 out/ 目录内嵌进应用，浏览器部署时也可直接托管。
   * 因此应用不使用任何需要服务端的能力（Server Actions / Route Handlers 等）。
   */
  output: "export",

  /**
   * 生成 /path/index.html，便于 Tauri 的 asset 协议与任意静态服务器按目录解析。
   */
  trailingSlash: true,

  images: {
    // 静态导出没有图片优化服务；封面本身是本地 Blob URL，无需优化器。
    unoptimized: true,
  },
};

export default nextConfig;
