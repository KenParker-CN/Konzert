import { catalogReferencesOf } from "./catalog";

export type ComposerWorkSystem =
  | "KV"
  | "TWV"
  | "RV"
  | "CPE"
  | "BWV"
  | "HWV"
  | "Hob.";

export interface ComposerWorksCatalog {
  system: ComposerWorkSystem;
  fileName: string;
}

export interface ComposerWork {
  fields: Record<string, string>;
  catalogue: string;
  title: string;
  type: string;
  key: string;
}

export interface ComposerWorkFilters {
  query: string;
  type: string;
  key: string;
}

/** Haydn's source CSV includes three indexing columns that are not work details. */
export function isComposerWorkFieldVisible(
  field: string,
  system: ComposerWorkSystem,
): boolean {
  if (system !== "Hob.") return true;
  return !["sort", "series", "no."].includes(
    field.trim().toLocaleLowerCase(),
  );
}

export const TWV_CATEGORIES = [
  { id: "sacred-vocal", label: "TWV 1-15 宗教声乐作品", from: 1, to: 15 },
  { id: "secular-vocal", label: "TWV 20-25 世俗声乐作品", from: 20, to: 25 },
  { id: "keyboard-lute", label: "TWV 30-39 键盘与鲁特琴作品", from: 30, to: 39 },
  { id: "chamber", label: "TWV 40-45 室内乐作品", from: 40, to: 45 },
  { id: "orchestral", label: "TWV 50-55 管弦乐作品", from: 50, to: 55 },
] as const;

export type TwvCategoryId = (typeof TWV_CATEGORIES)[number]["id"];

export function twvCategoryOfComposerWork(
  work: ComposerWork,
): TwvCategoryId | null {
  const reference = catalogReferencesOf(work.catalogue).find(
    ({ system }) => system === "TWV",
  );
  const section = reference?.number.match(/^(\d+)/)?.[1];
  if (!section) return null;

  const sectionNumber = Number(section);
  return (
    TWV_CATEGORIES.find(
      ({ from, to }) => sectionNumber >= from && sectionNumber <= to,
    )?.id ?? null
  );
}

export function filterComposerWorks(
  works: ComposerWork[],
  filters: ComposerWorkFilters,
): ComposerWork[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return works.filter((work) => {
    if (filters.type && work.type !== filters.type) return false;
    if (filters.key && work.key !== filters.key) return false;
    if (!query) return true;

    return [
      work.catalogue,
      work.title,
      work.type,
      work.key,
      ...Object.values(work.fields),
    ]
      .join("\n")
      .toLocaleLowerCase()
      .includes(query);
  });
}

export function catalogReferenceOfComposerWork(
  work: ComposerWork,
  catalog: ComposerWorksCatalog,
) {
  return catalogReferencesOfComposerWork(work, catalog)[0] ?? null;
}

export function catalogReferencesOfComposerWork(
  work: ComposerWork,
  catalog: ComposerWorksCatalog,
) {
  const expectedSystems =
    catalog.system === "KV"
      ? ["K"]
      : catalog.system === "CPE"
        ? ["Wq.", "H."]
        : [catalog.system];
  return catalogReferencesOf(work.catalogue).filter(({ system }) =>
    expectedSystems.includes(system),
  );
}

const CATALOGS: Array<{
  system: ComposerWorkSystem;
  aliases: string[];
}> = [
  {
    system: "KV",
    aliases: [
      "mozart",
      "wolfgang amadeus mozart",
      "wolfgang a mozart",
      "mozart wolfgang amadeus",
      "w a mozart",
      "mozart w a",
      "johann chrysostom wolfgang amadeus mozart",
    ],
  },
  {
    system: "TWV",
    aliases: [
      "telemann",
      "georg philipp telemann",
      "g p telemann",
      "telemann georg philipp",
      "telemann g p",
    ],
  },
  {
    system: "RV",
    aliases: [
      "vivaldi",
      "antonio vivaldi",
      "a vivaldi",
      "vivaldi antonio",
      "antonio lucio vivaldi",
    ],
  },
  {
    system: "CPE",
    aliases: [
      "cpe bach",
      "c p e bach",
      "bach c p e",
      "carl philipp emanuel bach",
      "bach carl philipp emanuel",
    ],
  },
  {
    system: "BWV",
    aliases: [
      "johann sebastian bach",
      "bach johann sebastian",
      "j s bach",
      "bach j s",
      "js bach",
      "bach js",
    ],
  },
  {
    system: "HWV",
    aliases: [
      "handel",
      "george frideric handel",
      "handel george frideric",
      "georg friedrich handel",
      "handel georg friedrich",
      "g f handel",
      "handel g f",
      "gf handel",
      "handel gf",
    ],
  },
  {
    system: "Hob.",
    aliases: [
      "haydn",
      "joseph haydn",
      "franz joseph haydn",
      "haydn joseph",
      "haydn franz joseph",
      "j haydn",
      "haydn j",
    ],
  },
];

const DATA_BASE_URL =
  "https://raw.githubusercontent.com/KenParker-CN/konzert-public-data/main/csv";

function normalizeComposerName(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[.,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function composerWorksCatalogOf(
  composerName: string,
): ComposerWorksCatalog | null {
  const name = normalizeComposerName(composerName);
  const catalog = CATALOGS.find(({ aliases }) =>
    aliases.some((alias) => {
      const normalizedAlias = normalizeComposerName(alias);
      if (!normalizedAlias.includes(" ")) return name === normalizedAlias;
      return name === normalizedAlias || name.includes(normalizedAlias);
    }),
  );

  return catalog
    ? { system: catalog.system, fileName: `${catalog.system.replace('.', '')}.csv` }
    : null;
}

export function parseCsv(
  text: string,
  options: { emptyHeaderNames?: Record<number, string> } = {},
): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let afterQuote = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
          afterQuote = true;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (afterQuote) {
      if (character === ",") {
        row.push(field);
        field = "";
      } else if (character === "\r" || character === "\n") {
        row.push(field);
        field = "";
        if (row.some((value) => value.length > 0)) rows.push(row);
        row = [];
        if (character === "\r" && text[index + 1] === "\n") index += 1;
      } else {
        throw new Error(
          `Unexpected character after quoted CSV field at character ${index + 1}`,
        );
      }
      afterQuote = false;
      continue;
    }

    if (character === '"' && field.length === 0) {
      inQuotes = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\r" || character === "\n") {
      row.push(field);
      field = "";
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      if (character === "\r" && text[index + 1] === "\n") index += 1;
    } else if (character === '"') {
      throw new Error(`Unexpected quote in CSV field at character ${index + 1}`);
    } else {
      field += character;
    }
  }

  if (inQuotes) throw new Error("CSV contains an unterminated quoted field");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.length > 0)) rows.push(row);
  }

  if (rows.length === 0) throw new Error("CSV is empty");

  const headers = rows[0].map((header, index) => {
    const normalized = index === 0
      ? header.replace(/^\uFEFF/, "").trim()
      : header.trim();
    return normalized || options.emptyHeaderNames?.[index] || "";
  });
  if (headers.some((header) => !header)) {
    throw new Error("CSV contains an empty column name");
  }
  if (new Set(headers).size !== headers.length) {
    throw new Error("CSV contains duplicate column names");
  }

  return rows.slice(1).map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(
        `CSV row ${index + 2} has ${values.length} fields; expected ${headers.length}`,
      );
    }
    return Object.fromEntries(headers.map((header, column) => [header, values[column]]));
  });
}

export function composerWorksFromCsv(
  csv: string,
  system: ComposerWorkSystem,
): ComposerWork[] {
  const rows = parseCsv(csv, {
    // The upstream Haydn (Hoboken) CSV leaves the column above values such as
    // "Hob. I:1" unnamed. Treat that column as the catalogue reference.
    emptyHeaderNames: system === "Hob." ? { 3: "Catalogue" } : undefined,
  });
  const headers = Object.keys(rows[0] ?? {});
  const catalogueColumn = headers.find(
    (header) => header.trim().toLocaleLowerCase() === "catalogue",
  );
  const wotquenneColumn = headers.find(
    (header) => header.trim().toLocaleLowerCase() === "wotquenne",
  );
  const helmColumn = headers.find(
    (header) => header.trim().toLocaleLowerCase() === "helm",
  );
  if (!catalogueColumn && system === "CPE" && !wotquenneColumn && !helmColumn) {
    throw new Error("CPE CSV is missing Wotquenne and Helm catalogue columns");
  }
  if (!catalogueColumn && system !== "CPE") {
    throw new Error("CSV is missing the Catalogue column");
  }

  const preferredTitleColumns =
    system === "RV" ? ["name"] : ["title", "name", "movement"];
  const titleColumn = preferredTitleColumns
    .map((name) =>
      headers.find((header) => header.trim().toLocaleLowerCase() === name),
    )
    .find((header) => header !== undefined);
  const typeColumn = headers.find(
    (header) => header.trim().toLocaleLowerCase() === "type",
  );
  const keyColumn = headers.find(
    (header) => header.trim().toLocaleLowerCase() === "key",
  );
  if (!titleColumn && system !== "RV") {
    throw new Error("CSV is missing a work title column");
  }

  return rows.map((sourceFields) => {
    const fields = sourceFields;
    return {
      fields,
      catalogue: catalogueColumn
        ? fields[catalogueColumn]
        : [wotquenneColumn, helmColumn]
            .map((column) => (column ? fields[column].trim() : ""))
            .filter(Boolean)
            .join(", "),
      title: titleColumn ? fields[titleColumn].trim() : "",
      type: typeColumn ? fields[typeColumn] : "",
      key: keyColumn ? fields[keyColumn] : "",
    };
  });
}

export async function fetchComposerWorks(
  catalog: ComposerWorksCatalog,
  signal?: AbortSignal,
): Promise<ComposerWork[]> {
  const response = await fetch(`${DATA_BASE_URL}/${catalog.fileName}`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new Error(`目录数据请求失败（HTTP ${response.status}）`);
  }

  return composerWorksFromCsv(await response.text(), catalog.system);
}
