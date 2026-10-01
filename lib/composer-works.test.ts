import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  composerWorksCatalogOf,
  composerWorksFromCsv,
  parseCsv,
} from "./composer-works";

test("maps supported composer names to their catalogue systems", () => {
  assert.deepEqual(composerWorksCatalogOf("Wolfgang Amadeus Mozart"), {
    system: "KV",
    fileName: "KV.csv",
  });
  assert.deepEqual(composerWorksCatalogOf("Mozart, Wolfgang Amadeus"), {
    system: "KV",
    fileName: "KV.csv",
  });
  assert.deepEqual(composerWorksCatalogOf("Georg Philipp Telemann"), {
    system: "TWV",
    fileName: "TWV.csv",
  });
  assert.deepEqual(composerWorksCatalogOf("Antonio Vivaldi"), {
    system: "RV",
    fileName: "RV.csv",
  });
  assert.equal(composerWorksCatalogOf("Leopold Mozart"), null);
  assert.equal(composerWorksCatalogOf("Johann Sebastian Bach"), null);
});

test("parses BOM, escaped quotes, commas, and newlines in CSV fields", () => {
  const rows = parseCsv(
    '\uFEFFCatalogue,Title,Note\r\nKV 1,"Title, with comma","Line 1\nLine ""two"""\r\n',
  );

  assert.deepEqual(rows, [
    {
      Catalogue: "KV 1",
      Title: "Title, with comma",
      Note: 'Line 1\nLine "two"',
    },
  ]);
});

test("creates simple work summaries while retaining every source column", () => {
  const [work] = composerWorksFromCsv(
    "Catalogue,Other,Title,Type,Key,Instrumentation,Note\r\n" +
      'KV 1,No. 1,"Piano, Concerto",Concerto,C major,Piano,"First, version"\r\n',
    "KV",
  );

  assert.equal(work.catalogue, "KV 1");
  assert.equal(work.title, "Piano, Concerto");
  assert.equal(work.type, "Concerto");
  assert.equal(work.key, "C major");
  assert.equal(work.fields.Other, "No. 1");
  assert.equal(work.fields.Note, "First, version");
});

test("uses the RV name when present and movement when it is blank", () => {
  const works = composerWorksFromCsv(
    "Catalogue,Name,Type,Key,Movement,Instrumentation,Note\r\n" +
      'RV 1,"Il Gardellino",Concerto,D major,"I. Allegro",Violin,\r\n' +
      'RV 2,,Sonata,C major,"I. Preludio\\nII. Giga",Violin,\r\n',
    "RV",
  );

  assert.equal(works[0].title, "Il Gardellino");
  assert.equal(works[1].title, "I. Preludio\\nII. Giga");
});

test("reports malformed CSV instead of returning partial records", () => {
  assert.throws(
    () => parseCsv('Catalogue,Title\nKV 1,"unterminated'),
    /unterminated quoted field/,
  );
  assert.throws(
    () => parseCsv("Catalogue,Title\nKV 1,Title,Extra"),
    /expected 2/,
  );
  assert.throws(
    () => parseCsv('Catalogue,Title\nKV 1,"Title"extra'),
    /after quoted CSV field/,
  );
});
