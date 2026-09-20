import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  catalogNumberOf,
  catalogReferenceOf,
  catalogReferencesOf,
  groupTracksByDisc,
  groupWorks,
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

test("uses the first colon for ordinary work titles", () => {
  assert.equal(workKeyOf("Violin Concerto: Allegro"), "violin concerto");
  assert.equal(workTitleOf("Violin Concerto: Allegro"), "Violin Concerto");
  assert.equal(workKeyOf("Sonata in G major: Largo"), "sonata in g major");
  assert.equal(workTitleOf("Sonata in G major: Largo"), "Sonata in G major");
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
