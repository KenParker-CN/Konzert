// 一次性脚本：把深色主题工具类映射为浅色等价类，运行后删除。
import fs from "node:fs";
import path from "node:path";

const map = {
  // 主按钮：白底深字 → 深底浅字
  "bg-white": "bg-zinc-900",
  "bg-zinc-200": "bg-zinc-700",
  // 表面与遮罩
  "bg-white/3": "bg-white",
  "bg-white/5": "bg-zinc-100",
  "bg-white/6": "bg-zinc-950/5",
  "bg-white/10": "bg-zinc-950/5",
  "bg-white/16": "bg-zinc-950/10",
  "bg-white/20": "bg-zinc-900/10",
  "bg-black/30": "bg-zinc-950/5",
  "bg-black/45": "bg-white/70",
  "bg-zinc-950/70": "bg-white/70",
  "bg-zinc-950/90": "bg-white/85",
  // 强调色
  "bg-violet-300": "bg-violet-500",
  "bg-violet-400": "bg-violet-600",
  "bg-violet-500/12": "bg-violet-500/10",
  "bg-violet-500/20": "bg-violet-500/15",
  "bg-rose-950/85": "bg-rose-50",
  "bg-amber-950/80": "bg-amber-50",
  // 边框
  "border-white/5": "border-zinc-200/70",
  "border-white/8": "border-zinc-200",
  "border-white/10": "border-zinc-200",
  "border-white/12": "border-zinc-300",
  "border-white/15": "border-zinc-300",
  "border-violet-400/50": "border-violet-500/40",
  "border-violet-400/60": "border-violet-500/50",
  "border-rose-400/30": "border-rose-300",
  "border-amber-400/30": "border-amber-300",
  // 正文灰阶（深浅反转）
  "text-zinc-50": "text-zinc-900",
  "text-zinc-100": "text-zinc-800",
  "text-zinc-200": "text-zinc-700",
  "text-zinc-300": "text-zinc-600",
  "text-zinc-300/80": "text-zinc-400/80",
  "text-zinc-400": "text-zinc-500",
  "text-zinc-600": "text-zinc-400",
  "text-zinc-700": "text-zinc-300",
  "text-zinc-900": "text-zinc-50",
  // 强调文本
  "text-violet-100": "text-violet-700",
  "text-violet-200": "text-violet-700",
  "text-violet-200/60": "text-violet-700/60",
  "text-violet-200/80": "text-violet-700/80",
  "text-violet-300": "text-violet-600",
  "text-rose-50": "text-rose-900",
  "text-rose-100": "text-rose-800",
  "text-rose-200/70": "text-rose-600/70",
  "text-rose-300": "text-rose-600",
  "text-rose-400": "text-rose-500",
  "text-amber-50": "text-amber-900",
  "text-amber-100": "text-amber-800",
  "text-amber-200/70": "text-amber-600/70",
  "text-amber-300": "text-amber-700",
  // 渐变与光晕
  "from-violet-500/25": "from-violet-500/15",
  "from-violet-500/30": "from-violet-500/20",
  "via-white/5": "via-violet-500/5",
  "to-sky-400/20": "to-sky-400/15",
  "ring-violet-400/25": "ring-violet-500/25",
  // 阴影
  "shadow-black/40": "shadow-zinc-900/15",
  "shadow-black/50": "shadow-zinc-900/20",
  "shadow-black/60": "shadow-zinc-900/25",
  // 变体特例
  "hover:text-white": "hover:text-zinc-900",
};

const re =
  /((?:[a-zA-Z][\w-]*:)*)((?:bg|text|border|from|via|to|ring|shadow|fill|stroke|divide|outline|decoration|accent|caret)-(?:white|black|zinc|violet|rose|slate|neutral|gray|indigo|sky|emerald|amber|red|green|blue|stone)(?:-\d{2,3})?(?:\/\d{1,3})?)/g;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(tsx?|css)$/.test(entry.name)) convert(p);
  }
}

const counts = new Map();
function convert(file) {
  const src = fs.readFileSync(file, "utf8");
  let hit = 0;
  const out = src.replace(re, (_m, variant, token) => {
    const withVariant = variant + token;
    const mapped = map[withVariant] ?? map[token];
    if (!mapped) return _m;
    hit += 1;
    counts.set(_m, (counts.get(_m) ?? 0) + 1);
    return variant + mapped;
  });
  if (hit > 0) {
    fs.writeFileSync(file, out);
    console.log(`${file}: ${hit} 处替换`);
  }
}

for (const dir of ["app", "components", "lib"]) {
  if (fs.existsSync(dir)) walk(dir);
}
console.log("=== 汇总 ===");
for (const [k, v] of [...counts.entries()].sort()) console.log(`${v}\t${k}`);
