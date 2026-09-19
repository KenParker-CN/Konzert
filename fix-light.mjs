// 一次性修复脚本：修正震荡后的浅色主题残留问题，运行后删除。
import fs from "node:fs";

/** 全局正则替换（单遍，避免级联） */
const globalRules = [
  // 修复双前缀（脚本 bug 遗留）
  [/hover:hover:text-zinc-900/g, "hover:text-zinc-900"],
  // 禁用态图标：震荡停在 500，目标 400
  [/disabled:text-zinc-500/g, "disabled:text-zinc-400"],
  // 原 text-zinc-200 组（8 处正文 + 13 处 hover:）→ 700
  [/(?<![\w-])text-zinc-600(?![\w/-])/g, "text-zinc-700"],
  // 分隔符：原 text-zinc-700 → 300（负向断言保护 text-zinc-400/80）
  [/(?<![\w-])text-zinc-400(?![\w/-])/g, "text-zinc-300"],
];

/** 文件级唯一串替换：[旧串, 新串] */
const fileRules = new Map([
  // ---- 原 text-zinc-300（内容性次级文字）→ text-zinc-600 ----
  ["components/album-detail.tsx", [
    ["mt-1.5 truncate text-sm text-zinc-500", "mt-1.5 truncate text-sm text-zinc-600"],
  ]],
  ["components/views/settings-view.tsx", [
    ["mt-1 text-xs text-zinc-500", "mt-1 text-xs text-zinc-600"],
    ["px-4 py-2 text-xs text-zinc-500 transition hover:bg-zinc-950/5", "px-4 py-2 text-xs text-zinc-600 transition hover:bg-zinc-950/5"],
    // ---- 原 text-zinc-600（微弱数字/微注）→ text-zinc-400 ----
    ["mt-3 flex items-start gap-1.5 text-[11px] text-zinc-500", "mt-3 flex items-start gap-1.5 text-[11px] text-zinc-400"],
    ["mt-3 flex items-center gap-1.5 text-[11px] text-zinc-500", "mt-3 flex items-center gap-1.5 text-[11px] text-zinc-400"],
    ["mt-2 text-[11px] text-zinc-500", "mt-2 text-[11px] text-zinc-400"],
  ]],
  ["components/views/history-view.tsx", [
    ["mt-1 text-xs text-zinc-500", "mt-1 text-xs text-zinc-600"],
    ["py-1.5 text-xs text-zinc-500 transition hover:bg-zinc-950/5", "py-1.5 text-xs text-zinc-600 transition hover:bg-zinc-950/5"],
    ["px-3 pt-2 text-[11px] text-zinc-500", "px-3 pt-2 text-[11px] text-zinc-400"],
  ]],
  ["components/views/favorites-view.tsx", [
    ["mt-1 text-xs text-zinc-500", "mt-1 text-xs text-zinc-600"],
  ]],
  ["components/player-bar.tsx", [
    ["p-2 text-zinc-500 transition hover:text-zinc-900", "p-2 text-zinc-600 transition hover:text-zinc-900"],
    ["w-10 shrink-0 text-right text-[11px] tabular-nums text-zinc-500", "w-10 shrink-0 text-right text-[11px] tabular-nums text-zinc-400"],
    ["w-10 shrink-0 text-[11px] tabular-nums text-zinc-500", "w-10 shrink-0 text-[11px] tabular-nums text-zinc-400"],
  ]],
  ["components/track-list.tsx", [
    ['? "text-violet-600" : "text-zinc-500"', '? "text-violet-600" : "text-zinc-400"'],
    ['className="truncate text-xs text-zinc-500"', 'className="truncate text-xs text-zinc-600"'],
    ["hidden truncate text-xs text-zinc-500 sm:block", "hidden truncate text-xs text-zinc-600 sm:block"],
    ["hidden text-right text-xs tabular-nums text-zinc-500", "hidden text-right text-xs tabular-nums text-zinc-400"],
  ]],
  // ---- 卡片背景：震荡成 bg-zinc-900，应为 bg-white ----
  ["components/empty-state.tsx", [
    ["rounded-2xl border border-zinc-200 bg-zinc-900", "rounded-2xl border border-zinc-200 bg-white"],
  ]],
  ["components/views/settings-view.tsx", [
    ["rounded-2xl border border-zinc-200 bg-zinc-900", "rounded-2xl border border-zinc-200 bg-white"],
  ]],
  ["components/views/history-view.tsx", [
    ["rounded-xl border border-zinc-200 bg-zinc-900", "rounded-xl border border-zinc-200 bg-white"],
  ]],
  ["components/views/library-view.tsx", [
    ["rounded-xl border border-zinc-200 bg-zinc-900", "rounded-xl border border-zinc-200 bg-white"],
  ]],
]);

let total = 0;
for (const [file, rules] of fileRules) {
  let src = fs.readFileSync(file, "utf8");
  for (const globalRule of globalRules) {
    src = src.replace(globalRule[0], globalRule[1]);
  }
  for (const [from, to] of rules) {
    if (!src.includes(from)) {
      console.error(`!! 未命中: ${file} :: ${from}`);
      continue;
    }
    const n = src.split(from).length - 1;
    src = src.split(from).join(to);
    total += n;
    console.log(`${file}: ${n} 处  ${from.slice(0, 60)}`);
  }
  fs.writeFileSync(file, src);
}
console.log(`=== 完成，共 ${total} 处 ===`);
