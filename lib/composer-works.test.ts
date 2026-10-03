import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  catalogReferenceOfComposerWork,
  catalogReferencesOfComposerWork,
  composerWorksCatalogOf,
  composerWorksFromCsv,
  filterComposerWorks,
  parseCsv,
  twvCategoryOfComposerWork,
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
  assert.deepEqual(composerWorksCatalogOf("Carl Philipp Emanuel Bach"), {
    system: "CPE",
    fileName: "CPE.csv",
  });
  assert.deepEqual(composerWorksCatalogOf("Bach, Carl Philipp Emanuel"), {
    system: "CPE",
    fileName: "CPE.csv",
  });
  assert.deepEqual(composerWorksCatalogOf("Bach, C. P. E."), {
    system: "CPE",
    fileName: "CPE.csv",
  });
  assert.deepEqual(composerWorksCatalogOf("Johann Sebastian Bach"), {
    system: "BWV",
    fileName: "BWV.csv",
  });
  assert.deepEqual(composerWorksCatalogOf("Bach, Johann Sebastian"), {
    system: "BWV",
    fileName: "BWV.csv",
  });
  assert.deepEqual(composerWorksCatalogOf("J. S. Bach"), {
    system: "BWV",
    fileName: "BWV.csv",
  });
  assert.deepEqual(composerWorksCatalogOf("George Frideric Handel"), {
    system: "HWV",
    fileName: "HWV.csv",
  });
  assert.deepEqual(composerWorksCatalogOf("Georg Friedrich Händel"), {
    system: "HWV",
    fileName: "HWV.csv",
  });
  assert.deepEqual(composerWorksCatalogOf("Handel, George Frideric"), {
    system: "HWV",
    fileName: "HWV.csv",
  });
  assert.equal(composerWorksCatalogOf("Leopold Mozart"), null);
  assert.equal(composerWorksCatalogOf("Johann Christian Bach"), null);
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

test("maps catalogue CSV references to the matching track catalogue system", () => {
  const [mozartWork] = composerWorksFromCsv(
    "Catalogue,Title\r\nKV 1,Minuet\r\n",
    "KV",
  );
  const [telemannWork] = composerWorksFromCsv(
    "Catalogue,Title\r\nTWV 51:G9,Concerto\r\n",
    "TWV",
  );
  const [bachWork] = composerWorksFromCsv(
    "Catalogue,Title,Type,Key\r\nBWV 1,Wie schön leuchtet der Morgenstern,Cantata,F major\r\n",
    "BWV",
  );
  const [handelWork] = composerWorksFromCsv(
    "SORT,Opus,Catalogue,Date,Title,Type,Key,Movements,Instrumentation,Note\r\n" +
      "1,,HWV 1,1704,Almira,Opera,,,Orchestra,\r\n",
    "HWV",
  );

  assert.deepEqual(
    catalogReferenceOfComposerWork(mozartWork, {
      system: "KV",
      fileName: "KV.csv",
    }),
    { system: "K", number: "1", display: "KV 1", index: 0 },
  );
  assert.deepEqual(
    catalogReferenceOfComposerWork(telemannWork, {
      system: "TWV",
      fileName: "TWV.csv",
    }),
    { system: "TWV", number: "51:G9", display: "TWV 51:G9", index: 0 },
  );
  assert.deepEqual(
    catalogReferenceOfComposerWork(bachWork, {
      system: "BWV",
      fileName: "BWV.csv",
    }),
    { system: "BWV", number: "1", display: "BWV 1", index: 0 },
  );
  assert.equal(bachWork.title, "Wie schön leuchtet der Morgenstern");
  assert.equal(bachWork.type, "Cantata");
  assert.equal(bachWork.key, "F major");
  assert.deepEqual(
    catalogReferenceOfComposerWork(handelWork, {
      system: "HWV",
      fileName: "HWV.csv",
    }),
    { system: "HWV", number: "1", display: "HWV 1", index: 0 },
  );
  assert.equal(handelWork.fields.Date, "1704");
  assert.equal(handelWork.fields.Instrumentation, "Orchestra");
  assert.equal(
    catalogReferenceOfComposerWork(mozartWork, {
      system: "RV",
      fileName: "RV.csv",
    }),
    null,
  );
});

test("classifies TWV works into the specified catalogue-number ranges", () => {
  const works = composerWorksFromCsv(
    "Catalogue,Title\r\n" +
      "TWV 1:1,Sacred vocal\r\n" +
      "TWV 15:1,Sacred vocal upper bound\r\n" +
      "TWV 16:1,Unclassified\r\n" +
      "TWV 20:1,Secular vocal\r\n" +
      "TWV 25:1,Secular vocal upper bound\r\n" +
      "TWV 30:1,Keyboard and lute\r\n" +
      "TWV 39:1,Keyboard and lute upper bound\r\n" +
      "TWV 40:1,Chamber\r\n" +
      "TWV 45:1,Chamber upper bound\r\n" +
      "TWV 50:1,Orchestral\r\n" +
      "TWV 55:1,Orchestral upper bound\r\n" +
      "TWV 56:1,Unclassified upper bound\r\n",
    "TWV",
  );

  assert.deepEqual(
    works.map(twvCategoryOfComposerWork),
    [
      "sacred-vocal",
      "sacred-vocal",
      null,
      "secular-vocal",
      "secular-vocal",
      "keyboard-lute",
      "keyboard-lute",
      "chamber",
      "chamber",
      "orchestral",
      "orchestral",
      null,
    ],
  );
});

test("maps both Wq and H references from CPE catalogue records", () => {
  const [work] = composerWorksFromCsv(
    "Date,Wotquenne,Helm,Title,Type,Key,Movement,Instrumentation,Note\r\n" +
      '1731,Wq. 111,H. 1.5,"Menuet, en do majeur, pour clavier",Menuet,C major,,Clavier,\r\n',
    "CPE",
  );

  assert.equal(work.catalogue, "Wq. 111, H. 1.5");
  assert.equal(work.title, "Menuet, en do majeur, pour clavier");
  assert.equal(work.fields.Date, "1731");
  assert.deepEqual(
    catalogReferencesOfComposerWork(work, {
      system: "CPE",
      fileName: "CPE.csv",
    }).map(({ system, number }) => ({ system, number })),
    [
      { system: "Wq.", number: "111" },
      { system: "H.", number: "1.5" },
    ],
  );
});

test("preserves CPE work-field diacritics from the CSV", () => {
  const [work] = composerWorksFromCsv(
    "Date,Wotquenne,Helm,Title,Type,Key,Movement,Instrumentation,Note\r\n" +
      "1756,Wq. 117/32,H. 112,La journalière,Klavierstück,C minor,,Clavier,arrangé pour flûte\r\n",
    "CPE",
  );

  assert.equal(work.title, "La journalière");
  assert.equal(work.fields.Type, "Klavierstück");
  assert.equal(work.fields.Note, "arrangé pour flûte");
});

test("searches all work fields and combines type and key filters", () => {
  const works = composerWorksFromCsv(
    "Catalogue,Name,Type,Key,Movement,Instrumentation\r\n" +
      "RV 1,Il Gardellino,Concerto,D major,I. Allegro,Violin\r\n" +
      "RV 2,La Primavera,Concerto,E major,I. Allegro,Violin\r\n" +
      "RV 3,Sonata,Sonata,D major,I. Adagio,Cello\r\n",
    "RV",
  );

  assert.deepEqual(
    filterComposerWorks(works, {
      query: "VIOLIN",
      type: "Concerto",
      key: "D major",
    }).map(({ catalogue }) => catalogue),
    ["RV 1"],
  );
  assert.deepEqual(
    filterComposerWorks(works, {
      query: "la primavera",
      type: "",
      key: "",
    }).map(({ catalogue }) => catalogue),
    ["RV 2"],
  );
});

test("leaves the RV title blank when the name is blank", () => {
  const works = composerWorksFromCsv(
    "Catalogue,Name,Type,Key,Movement,Instrumentation,Note\r\n" +
      'RV 1,"Il Gardellino",Concerto,D major,"I. Allegro",Violin,\r\n' +
      'RV 2,,Sonata,C major,"I. Preludio\\nII. Giga",Violin,\r\n',
    "RV",
  );

  assert.equal(works[0].title, "Il Gardellino");
  assert.equal(works[1].title, "");
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
