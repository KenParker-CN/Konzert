export type ComposerWorkSystem = "KV" | "TWV" | "RV";

export interface ComposerWorksCatalog {
  system: ComposerWorkSystem;
  fileName: `${ComposerWorkSystem}.csv`;
}

export interface ComposerWork {
  fields: Record<string, string>;
  catalogue: string;
  title: string;
  type: string;
  key: string;
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
];

const DATA_BASE_URL =
  "https://raw.githubusercontent.com/KenParker-CN/konzert-public-data/main";

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
    ? { system: catalog.system, fileName: `${catalog.system}.csv` }
    : null;
}

export function parseCsv(text: string): Array<Record<string, string>> {
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

  const headers = rows[0].map((header, index) =>
    index === 0 ? header.replace(/^\uFEFF/, "").trim() : header.trim(),
  );
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
  const rows = parseCsv(csv);
  const headers = Object.keys(rows[0] ?? {});
  const catalogueColumn = headers.find(
    (header) => header.trim().toLocaleLowerCase() === "catalogue",
  );
  if (!catalogueColumn) throw new Error("CSV is missing the Catalogue column");

  const preferredTitleColumns =
    system === "RV" ? ["name", "movement"] : ["title", "name", "movement"];
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
  if (!titleColumn) throw new Error("CSV is missing a work title column");

  return rows.map((fields) => ({
    fields,
    catalogue: fields[catalogueColumn],
    title:
      fields[titleColumn].trim() ||
      fields.Name?.trim() ||
      fields.Movement?.trim() ||
      fields.Type?.trim() ||
      "（未命名作品）",
    type: typeColumn ? fields[typeColumn] : "",
    key: keyColumn ? fields[keyColumn] : "",
  }));
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
