import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  catalogReferenceDisplay,
  catalogNumbersMatch,
  catalogNumberOf,
  catalogReferenceOf,
  catalogReferencesOf,
  composerNamesOf,
  groupComposers,
  groupTracksByDisc,
  groupWorks,
  searchTracks,
  workIdentityKeyOf,
  workKeyOf,
  workTitleOf,
} from "./catalog";

test("keeps the colon inside a TWV catalogue number", () => {
  assert.equal(workKeyOf("TWV 51:G9: I. Allegro"), "twv 51:g9");
  assert.equal(workTitleOf("TWV 51:G9: I. Allegro"), "TWV 51:G9");
  assert.equal(workKeyOf("TWV 51:G9: II. Largo"), "twv 51:g9");
  assert.equal(workTitleOf("TWV 51:G9: II. Largo"), "TWV 51:G9");
  assert.equal(catalogNumberOf("TWV 51:G9: I. Allegro"), "TWV 51:G9");
  assert.deepEqual(catalogReferenceOf("TWV 51:G9: I. Allegro"), {
    system: "TWV",
    number: "51:G9",
    display: "TWV 51:G9",
    index: 0,
  });
  assert.equal(
    workTitleOf("Concerto pour alto en sol majeur, TWV 51:G9: I. Allegro"),
    "Concerto pour alto en sol majeur, TWV 51:G9",
  );
});

test("compares TWV catalogue letters case-sensitively", () => {
  assert.deepEqual(catalogReferenceOf("TWV 51:EX1: I. Allegro"), {
    system: "TWV",
    number: "51:EX1",
    display: "TWV 51:EX1",
    index: 0,
  });
  assert.deepEqual(catalogReferenceOf("TWV 51:eX1: I. Allegro"), {
    system: "TWV",
    number: "51:eX1",
    display: "TWV 51:eX1",
    index: 0,
  });
  assert.equal(catalogNumbersMatch("TWV", "51:EX1", "51:eX1"), false);
  assert.equal(catalogNumbersMatch("RV", "1A", "1a"), true);
  assert.notEqual(
    workIdentityKeyOf(track("TWV 51:EX1: I. Allegro", "Telemann", "1")),
    workIdentityKeyOf(track("TWV 51:eX1: I. Allegro", "Telemann", "2")),
  );
});

test("parses multiple catalog numbers for one work", () => {
  assert.deepEqual(
    catalogReferencesOf("Wq. 183/1, H. 663: I. Allegro"),
    [
      { system: "Wq.", number: "183/1", display: "Wq. 183/1", index: 0 },
      { system: "H.", number: "663", display: "H. 663", index: 11 },
    ],
  );
  assert.equal(
    workTitleOf("Wq. 183/1, H. 663: I. Allegro"),
    "Wq. 183/1, H. 663",
  );
  assert.deepEqual(
    catalogReferencesOf("Symphony in D major, Wq. 183/1, H. 663: I. Allegro"),
    [
      { system: "Wq.", number: "183/1", display: "Wq. 183/1", index: 21 },
      { system: "H.", number: "663", display: "H. 663", index: 32 },
    ],
  );
});

test("parses abbreviated CPE Bach catalog numbers and displays standard notation", () => {
  const wotquenne = catalogReferenceOf("Wq 55: I. Allegro");
  const helm = catalogReferenceOf("H515: Allegro");

  assert.equal(wotquenne?.system, "Wq.");
  assert.equal(wotquenne?.number, "55");
  assert.equal(wotquenne && catalogReferenceDisplay(wotquenne), "Wq. 55");
  assert.equal(helm?.system, "H.");
  assert.equal(helm?.number, "515");
  assert.equal(helm && catalogReferenceDisplay(helm), "H. 515");
  assert.equal(catalogReferenceOf("H. 1.5")?.number, "1.5");
});

test("uses the first colon for ordinary work titles", () => {
  assert.equal(workKeyOf("Violin Concerto: Allegro"), "violin concerto");
  assert.equal(workTitleOf("Violin Concerto: Allegro"), "Violin Concerto");
  assert.equal(workKeyOf("Sonata in G major: Largo"), "sonata in g major");
  assert.equal(workTitleOf("Sonata in G major: Largo"), "Sonata in G major");
});

test("recognizes the ratio colon after a K catalogue number", () => {
  const title =
    "Requiem, K. 626 (Compl. & Ed. Ostrzyga)∶ I. Introitus. Requiem aeternam";
  assert.equal(workTitleOf(title), "Requiem, K. 626 (Compl. & Ed. Ostrzyga)");
  assert.equal(
    workKeyOf(title),
    "requiem, k. 626 (compl. & ed. ostrzyga)",
  );
  assert.deepEqual(catalogReferenceOf(title), {
    system: "K",
    number: "626",
    display: "K. 626",
    index: 9,
  });
});

test("normalizes Mozart K and KV title variants to the same catalogue number", () => {
  const references = ["K 211", "K. 211", "KV 211"].map((title) =>
    catalogReferenceOf(title),
  );

  assert.deepEqual(
    references.map((reference) => ({
      system: reference?.system,
      number: reference?.number,
    })),
    [
      { system: "K", number: "211" },
      { system: "K", number: "211" },
      { system: "K", number: "211" },
    ],
  );
});

test("recognizes Vivaldi RV catalogue numbers", () => {
  assert.deepEqual(catalogReferenceOf("RV 1: I. Allegro"), {
    system: "RV",
    number: "1",
    display: "RV 1",
    index: 0,
  });
});

test("recognizes BWV catalogue numbers and grouped number ranges", () => {
  assert.deepEqual(catalogReferenceOf("BWV 1: Wie schön leuchtet der Morgenstern"), {
    system: "BWV",
    number: "1",
    display: "BWV 1",
    index: 0,
  });
  assert.deepEqual(catalogReferenceOf("BWV 1090-1120"), {
    system: "BWV",
    number: "1090-1120",
    display: "BWV 1090-1120",
    index: 0,
  });
  assert.equal(catalogNumbersMatch("BWV", "1090-1120", "1090"), true);
  assert.equal(catalogNumbersMatch("BWV", "1090-1120", "1105"), true);
  assert.equal(catalogNumbersMatch("BWV", "1090-1120", "1120"), true);
  assert.equal(catalogNumbersMatch("BWV", "1090-1120", "1121"), false);
});

test("recognizes Handel HWV catalogue numbers", () => {
  assert.deepEqual(catalogReferenceOf("HWV 1: Almira"), {
    system: "HWV",
    number: "1",
    display: "HWV 1",
    index: 0,
  });
  assert.deepEqual(catalogReferenceOf("HWV 55A"), {
    system: "HWV",
    number: "55A",
    display: "HWV 55A",
    index: 0,
  });
});

test("does not group titles without a valid leading work prefix", () => {
  assert.equal(workKeyOf("No colon title"), null);
  assert.equal(workTitleOf("No colon title"), "No colon title");
  assert.equal(workKeyOf(": Allegro"), null);
  assert.equal(workTitleOf(": Allegro"), ": Allegro");
});

function track(title: string, composer: string, id: string) {
  return {
    id,
    title,
    artist: "Orchestra",
    albumArtist: "Various Artists",
    album: "Concertos",
    genre: "Classical",
    composer,
    releaseDate: { display: null, year: null, sortValue: 0 },
    trackNo: Number(id),
    discNo: null,
    duration: Number(id),
    bitrate: null,
    sampleRate: null,
    bitDepth: null,
    lossless: false,
    fileName: `${id}.flac`,
    fileSize: 1,
    addedAt: 1,
    origin: { kind: "memory" as const, key: id },
    coverId: null,
    playCount: 0,
    lastPlayedAt: null,
    copyright: null,
  };
}

test("searches tracks by ISRC", () => {
  const trackWithIsrc = {...track("Concerto", "Composer", "1"), isrc: "USRC17607839"};
  assert.deepEqual(searchTracks([trackWithIsrc], "usrc17607839"), [trackWithIsrc]);
});

test("splits multi-value composer tags into individual composer groups", () => {
  const tracks = [
    track("Concerto", "Johann Sebastian Bach; Wolfgang Amadeus Mozart", "1"),
    track("Sonata", "Bach, Johann Sebastian", "2"),
  ];
  const composers = groupComposers(tracks);

  assert.deepEqual(composerNamesOf(tracks[0]), [
    "Johann Sebastian Bach",
    "Wolfgang Amadeus Mozart",
  ]);
  assert.deepEqual(
    composers.map(({name, tracks: composerTracks}) => ({
      name,
      ids: composerTracks.map(({id}) => id),
    })),
    [
      {name: "Bach, Johann Sebastian", ids: ["2"]},
      {name: "Johann Sebastian Bach", ids: ["1"]},
      {name: "Wolfgang Amadeus Mozart", ids: ["1"]},
    ],
  );
});

test("does not merge same-title works by different composers", () => {
  const sections = groupWorks([
    track(
      "Concerto for Viola & Orchestra in D major: I. Allegro",
      "Franz Anton Hoffmeister",
      "1",
    ),
    track(
      "Concerto for Viola & Orchestra in D major: I. Allegro",
      "Carl Stamitz",
      "2",
    ),
    track(
      "Concerto for Viola & Orchestra in D major: II. Largo",
      "Franz Anton Hoffmeister",
      "3",
    ),
    track(
      "Concerto for Viola & Orchestra in D major: II. Largo",
      "Carl Stamitz",
      "4",
    ),
  ]);

  assert.equal(sections.length, 2);
  assert.deepEqual(
    sections.map((section) => section.tracks.map((item) => item.id)),
    [["1", "3"], ["2", "4"]],
  );
  assert.deepEqual(
    sections.map((section) => section.composer),
    ["Franz Anton Hoffmeister", "Carl Stamitz"],
  );
});

test("groups tracks by CD while preserving track order within each CD", () => {
  const tracks = [
    track("CD 2: I. Largo", "", "2"),
    track("CD 1: I. Allegro", "", "1"),
    track("CD 2: II. Finale", "", "3"),
  ].map((item) => ({
    ...item,
    discNo: item.id === "1" ? 1 : 2,
  }));

  assert.deepEqual(
    groupTracksByDisc(tracks).map((disc) => ({
      discNo: disc.discNo,
      ids: disc.tracks.map((item) => item.id),
    })),
    [
      { discNo: 1, ids: ["1"] },
      { discNo: 2, ids: ["2", "3"] },
    ],
  );
});
