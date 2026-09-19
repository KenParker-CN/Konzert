// 从上一轮静态导出（深色主题）中提取所有含 zinc- 的字符串字面量，用于对照恢复。
import fs from "node:fs";
import path from "node:path";

const roots = ["out/_next/static/chunks", "out/index.html", "out/404.html"];
const found = new Map(); // literal -> 首次出现的文件

function scanFile(file, src) {
  let idx = src.indexOf("zinc-");
  while (idx !== -1) {
    // 向两侧扩展到引号/模板边界
    let l = idx;
    let r = idx + 5;
    const isBoundary = (ch) => "\"'`".includes(ch) || ch === "\n" || ch === "\r";
    while (l > 0 && !isBoundary(src[l - 1])) l--;
    while (r < src.length - 1 && !isBoundary(src[r + 1])) r++;
    const literal = src.slice(l, r + 1);
    if (!found.has(literal)) found.set(literal, path.basename(file));
    idx = src.indexOf("zinc-", r + 1);
  }
}

for (const root of roots) {
  const st = fs.statSync(root);
  if (st.isFile()) {
    scanFile(root, fs.readFileSync(root, "utf8"));
  } else {
    for (const f of fs.readdirSync(root)) {
      if (f.endsWith(".js")) {
        scanFile(path.join(root, f), fs.readFileSync(path.join(root, f), "utf8"));
      }
    }
  }
}

const lines = [...found.entries()]
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([s, f]) => `[${f}] ${s}`);
fs.writeFileSync("theme-dump.txt", lines.join("\n"));
console.log(`提取 ${lines.length} 条字面量 → theme-dump.txt`);
