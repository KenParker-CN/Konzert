// 临时脚本：拉取 composers.csv，输出各作曲家的规范名与别名，用于核对 CATALOGS。
import { parseCsv, composerWorksCatalogOf } from "./lib/composer-works";

const URL =
  "https://raw.githubusercontent.com/KenParker-CN/konzert-public-data/main/csv/composers.csv";

async function fetchText(url) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      if (attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error("unreachable");
}

const text = await fetchText(URL);
const rows = parseCsv(text);

const WANT = [
  "buxtehude",
  "schubert",
  "boccherini",
  "mahler",
  "lully",
  "mendelssohn",
  "ravel",
  "rameau",
  "tchaikovsky",
  "corelli",
  "shostakovich",
  "mozart",
  "telemann",
  "vivaldi",
  "handel",
  "haydn",
];

for (const row of rows) {
  const name = row.Name ?? "";
  if (!WANT.some((w) => name.toLowerCase().includes(w))) continue;
  const catalog = composerWorksCatalogOf(name);
  console.log(`\n=== ${name}`);
  console.log(`  Sort: ${row["Sort Name"]}`);
  console.log(`  Catalogue: ${row.Catalogue}`);
  console.log(`  alias_org: ${row.alias_org}`);
  console.log(`  alias_de: ${row.alias_de}`);
  console.log(`  alias_fr: ${row.alias_fr}`);
  console.log(`  alias_cn: ${row.alias_cn}`);
  console.log(
    `  -> ${catalog ? catalog.system + " <- " + catalog.fileName : "!! NO MATCH"}`,
  );
}
