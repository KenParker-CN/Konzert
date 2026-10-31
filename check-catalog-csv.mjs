/**
 * 校验在线作品目录数据：从 konzert-public-data 拉取全部 CSV，
 * 用 lib/composer-works 的真实解析器验证可解析且目录号可识别。
 *
 * 用法：npx tsx check-catalog-csv.mjs
 */
import {
  catalogReferencesOfComposerWork,
  composerWorksCatalogOf,
  composerWorksFromCsv,
} from "./lib/composer-works";

const BASE = "https://raw.githubusercontent.com/KenParker-CN/konzert-public-data/main/csv/";
const COMPOSERS = [
  "Wolfgang Amadeus Mozart",
  "Georg Philipp Telemann",
  "Antonio Vivaldi",
  "Carl Philipp Emanuel Bach",
  "Johann Sebastian Bach",
  "George Frideric Handel",
  "Joseph Haydn",
  "Dietrich Buxtehude",
  "Franz Schubert",
  "Luigi Boccherini",
  "Gustav Mahler",
  "Jean-Baptiste Lully",
  "Felix Mendelssohn",
  "Maurice Ravel",
  "Jean-Philippe Rameau",
  "Pyotr Ilyich Tchaikovsky",
  "Arcangelo Corelli",
  "Dmitri Shostakovich",
];

let failures = 0;

for (const composer of COMPOSERS) {
  const catalog = composerWorksCatalogOf(composer);
  if (!catalog) {
    failures += 1;
    console.log(`!! ${composer}: no catalog mapping`);
    continue;
  }

  let text = null;
  for (let attempt = 0; attempt < 3 && !text; attempt += 1) {
    try {
      const response = await fetch(`${BASE}${catalog.fileName}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      text = await response.text();
    } catch (error) {
      if (attempt === 2) {
        failures += 1;
        console.log(`?? ${composer}: fetch failed (${error?.message})`);
      }
    }
  }
  if (!text) continue;

  try {
    const works = composerWorksFromCsv(text, catalog.system);
    const sample = works.slice(0, 20);
    const withReferences = sample.filter(
      (work) => catalogReferencesOfComposerWork(work, catalog).length > 0,
    ).length;
    console.log(
      `ok ${composer}: ${catalog.system} <- ${catalog.fileName} | works=${works.length} | refs ${withReferences}/${sample.length} | first="${works[0].catalogue}"`,
    );
  } catch (error) {
    failures += 1;
    console.log(`!! ${composer}: parse failed — ${error?.message}`);
  }
}

process.exitCode = failures > 0 ? 1 : 0;
