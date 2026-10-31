// 临时脚本：验证 Buxtehude 各种常见署名能否匹配到 BuxWV 目录。
import { composerWorksCatalogOf } from "./lib/composer-works";

const NAMES = [
  "Buxtehude",
  "Dietrich Buxtehude",
  "Dieterich Buxtehude",
  "Buxtehude, Dieterich",
  "Buxtehude, Dietrich",
  "D. Buxtehude",
  "Buxtehude D",
  "Dieterich Buxtehude (1637-1707)",
  "Buxtehude, Dieterich (1637-1707)",
  "Dieterich Buxtehude",
  "Dietmann Buxtehude",
  "Buxtehude, D.",
  "D Buxtehude",
  "Theodor Buxtehude",
];

for (const name of NAMES) {
  const catalog = composerWorksCatalogOf(name);
  console.log(
    `${catalog ? "MATCH" : "MISS "} | ${name.padEnd(36)} | ${catalog ? catalog.system + " <- " + catalog.fileName : "-"}`,
  );
}
