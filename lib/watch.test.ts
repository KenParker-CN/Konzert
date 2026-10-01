import { strict as assert } from "node:assert";
import { test } from "node:test";
import { Debouncer, normalizeWatchEvent } from "./watch";
import {
  buildOutcome,
  normalizePathKey,
  pathSourceKey,
  trackIdFor,
  type ParsedEntry,
  type ScanCandidate,
} from "./scan";
import type { ParsedAudio } from "./metadata";
import type { ReleaseInfo, Track } from "./types";

// ---------------------------------------------------------------- helpers

const releaseInfo: ReleaseInfo = { display: null, year: null, sortValue: 0 };

function makePathCandidate(
  filePath: string,
  fileSize = 0,
  fileModifiedAt?: number,
): ScanCandidate {
  return {
    key: pathSourceKey(filePath),
    fileName: filePath.split(/[/\\]/).pop() ?? "",
    fileSize,
    fileModifiedAt,
    origin: { kind: "path", path: filePath },
    displayPath: filePath,
  };
}

function makeParsedAudio(overrides: Partial<ParsedAudio> = {}): ParsedAudio {
  return {
    title: "Test Title",
    artist: "Test Artist",
    albumArtist: "Test Artist",
    composer: "",
    isrc: "",
    album: "Test Album",
    genre: "",
    releaseDate: releaseInfo,
    trackNo: 1,
    discNo: 1,
    duration: 180,
    bitrate: 320000,
    bitDepth: 16,
    sampleRate: 44100,
    lossless: false,
    copyright: null,
    cover: null,
    ...overrides,
  };
}

interface ParsedEntryOptions {
  parsedOverrides?: Partial<ParsedAudio>;
  fileSize?: number;
  fileModifiedAt?: number;
}

function makeParsedEntry(
  filePath: string,
  opts: ParsedEntryOptions = {},
): ParsedEntry {
  const { parsedOverrides, fileSize = 5000000, fileModifiedAt } = opts;
  return {
    candidate: makePathCandidate(filePath, fileSize, fileModifiedAt),
    parsed: makeParsedAudio(parsedOverrides),
  };
}

function makeTrack(
  filePath: string,
  overrides: Partial<Track> = {},
): Track {
  const id = trackIdFor(pathSourceKey(filePath));
  return {
    id,
    title: "Old Title",
    artist: "Old Artist",
    albumArtist: "Old Artist",
    composer: "",
    isrc: "",
    album: "Old Album",
    genre: "",
    releaseDate: releaseInfo,
    trackNo: 1,
    discNo: 1,
    duration: 180,
    bitrate: 320000,
    bitDepth: 16,
    sampleRate: 44100,
    lossless: false,
    fileName: filePath.split(/[/\\]/).pop() ?? "",
    fileSize: 5000000,
    addedAt: 1000,
    origin: { kind: "path", path: filePath },
    coverId: null,
    playCount: 3,
    lastPlayedAt: 2000,
    copyright: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------- normalizeWatchEvent

test("normalizeWatchEvent: maps create-file to FileChangeEvent", () => {
  const event = normalizeWatchEvent(
    { create: { kind: "file" } },
    "/music/new-track.flac",
  );
  assert.deepEqual(event, {
    path: "/music/new-track.flac",
    kind: "create",
    isDirectory: false,
  });
});

test("normalizeWatchEvent: filters create-folder events", () => {
  assert.equal(
    normalizeWatchEvent({ create: { kind: "folder" } }, "/music/new-dir"),
    null,
  );
});

test("normalizeWatchEvent: maps modify-data to modify event", () => {
  const event = normalizeWatchEvent(
    { modify: { kind: "data", mode: "content" } },
    "/music/existing-track.flac",
  );
  assert.deepEqual(event, {
    path: "/music/existing-track.flac",
    kind: "modify",
    isDirectory: false,
  });
});

test("normalizeWatchEvent: maps remove-file to remove event", () => {
  const event = normalizeWatchEvent(
    { remove: { kind: "file" } },
    "/music/deleted-track.flac",
  );
  assert.deepEqual(event, {
    path: "/music/deleted-track.flac",
    kind: "remove",
    isDirectory: false,
  });
});

test("normalizeWatchEvent: filters remove-folder events", () => {
  assert.equal(
    normalizeWatchEvent({ remove: { kind: "folder" } }, "/music/old-dir"),
    null,
  );
});

test("normalizeWatchEvent: treats 'any' as modify", () => {
  const event = normalizeWatchEvent("any", "/music/track.flac");
  assert.deepEqual(event, {
    path: "/music/track.flac",
    kind: "modify",
    isDirectory: false,
  });
});

test("normalizeWatchEvent: filters access events", () => {
  assert.equal(
    normalizeWatchEvent(
      { access: { kind: "open", mode: "read" } },
      "/music/track.flac",
    ),
    null,
  );
});

test("normalizeWatchEvent: filters 'other' events", () => {
  assert.equal(normalizeWatchEvent("other", "/music/track.flac"), null);
});

test("normalizeWatchEvent: passes create-other events through (handler filters non-audio)", () => {
  const event = normalizeWatchEvent({ create: { kind: "other" } }, "/music/something");
  assert.deepEqual(event, {
    path: "/music/something",
    kind: "create",
    isDirectory: false,
  });
});

// ---------------------------------------------------------------- Debouncer

test("Debouncer: coalesces duplicate calls with same key", () => {
  const debouncer = new Debouncer();
  let count = 0;
  const increment = () => {
    count += 1;
  };

  debouncer.schedule("file-a", increment);
  debouncer.schedule("file-a", increment);
  debouncer.schedule("file-a", increment);

  // At this point, the timer hasn't fired yet — only 1 call is scheduled.
  assert.equal(count, 0);
});

test("Debouncer: calls last callback only after debounce delay", () => {
  const debouncer = new Debouncer();
  let value = "";

  debouncer.schedule("key", () => {
    value = "first";
  });
  debouncer.schedule("key", () => {
    value = "second";
  });

  // Value shouldn't be set yet (timer pending)
  assert.equal(value, "");

  // After debounce, only the last callback fires
  // We can't easily wait for the timer in a sync test, so use setTimeout
  const done = new Promise<void>((resolve) => {
    setTimeout(() => {
      assert.equal(value, "second");
      debouncer.cancelAll();
      resolve();
    }, 600);
  });
  return done;
});

test("Debouncer: handles different keys independently", () => {
  const debouncer = new Debouncer();
  const values: string[] = [];

  debouncer.schedule("key-a", () => values.push("a"));
  debouncer.schedule("key-b", () => values.push("b"));

  return new Promise<void>((resolve) => {
    setTimeout(() => {
      assert.deepEqual(values, ["a", "b"]);
      debouncer.cancelAll();
      resolve();
    }, 600);
  });
});

test("Debouncer: cancelAll prevents pending callbacks", () => {
  const debouncer = new Debouncer();
  let count = 0;

  debouncer.schedule("key", () => {
    count = 1;
  });
  debouncer.cancelAll();

  return new Promise<void>((resolve) => {
    setTimeout(() => {
      assert.equal(count, 0);
      resolve();
    }, 600);
  });
});

// ---------------------------------------------------------------- Track ID stability

test("trackIdFor: same path produces same ID", () => {
  const id1 = trackIdFor(pathSourceKey("/music/album/track.flac"));
  const id2 = trackIdFor(pathSourceKey("/music/album/track.flac"));
  assert.equal(id1, id2);
  assert.ok(id1.startsWith("t_"));
});

test("trackIdFor: different paths produce different IDs", () => {
  const id1 = trackIdFor(pathSourceKey("/music/album/track1.flac"));
  const id2 = trackIdFor(pathSourceKey("/music/album/track2.flac"));
  assert.notEqual(id1, id2);
});

test("normalizePathKey: lowercases Windows drive paths", () => {
  assert.equal(
    normalizePathKey("C:\\Users\\Music\\track.flac"),
    "c:\\users\\music\\track.flac",
  );
});

test("normalizePathKey: preserves POSIX paths", () => {
  assert.equal(
    normalizePathKey("/home/user/Music/track.flac"),
    "/home/user/Music/track.flac",
  );
});

test("trackIdFor: Windows case-insensitive path produces same ID", () => {
  const id1 = trackIdFor(pathSourceKey("C:\\Music\\Track.flac"));
  const id2 = trackIdFor(pathSourceKey("c:\\music\\track.flac"));
  assert.equal(id1, id2);
});

// ---------------------------------------------------------------- buildOutcome (differential)

test("buildOutcome: new file is classified as added", () => {
  const entry = makeParsedEntry("/music/new.flac");
  const result = buildOutcome([entry], []);

  assert.equal(result.added.length, 1);
  assert.equal(result.updated.length, 0);
  assert.equal(result.unchanged, 0);
  assert.equal(result.added[0].id, trackIdFor(pathSourceKey("/music/new.flac")));
});

test("buildOutcome: adds ISRC to a legacy track after reparsing", () => {
  const filePath = "/music/legacy.flac";
  const existing = makeTrack(filePath, {isrc: undefined});
  const result = buildOutcome(
    [makeParsedEntry(filePath, {parsedOverrides: {isrc: "USRC17607839"}})],
    [existing],
  );

  assert.equal(result.updated.length, 1);
  assert.equal(result.updated[0].isrc, "USRC17607839");
  assert.equal(result.unchanged, 0);
});

test("buildOutcome: unchanged file (same size) is skipped", () => {
  const filePath = "/music/existing.flac";
  const track = makeTrack(filePath, { fileSize: 5000000, duration: 180 });
  const entry = makeParsedEntry(filePath, { fileSize: 5000000 });

  const result = buildOutcome([entry], [track]);

  assert.equal(result.added.length, 0);
  assert.equal(result.updated.length, 0);
  assert.equal(result.unchanged, 1);
});

test("buildOutcome: same-size file with changed modification time is updated", () => {
  const filePath = "/music/existing.flac";
  const track = makeTrack(filePath, {
    fileSize: 5000000,
    fileModifiedAt: 1000,
    duration: 180,
  });
  const entry = makeParsedEntry(filePath, {
    fileSize: 5000000,
    fileModifiedAt: 2000,
  });

  const result = buildOutcome([entry], [track]);

  assert.equal(result.updated.length, 1);
  assert.equal(result.unchanged, 0);
  assert.equal(result.updated[0].fileModifiedAt, 2000);
});

test("buildOutcome: file with changed size is classified as updated", () => {
  const filePath = "/music/existing.flac";
  const track = makeTrack(filePath, { fileSize: 5000000, duration: 180 });
  const entry = makeParsedEntry(filePath, { fileSize: 6000000 });

  const result = buildOutcome([entry], [track]);

  assert.equal(result.added.length, 0);
  assert.equal(result.updated.length, 1);
  assert.equal(result.unchanged, 0);
});

test("buildOutcome: preserves playCount and addedAt on update", () => {
  const filePath = "/music/existing.flac";
  const track = makeTrack(filePath, {
    fileSize: 5000000,
    duration: 180,
    playCount: 42,
    addedAt: 99999,
  });
  const entry = makeParsedEntry(filePath, { fileSize: 6000000 });

  const result = buildOutcome([entry], [track]);

  assert.equal(result.updated[0].playCount, 42);
  assert.equal(result.updated[0].addedAt, 99999);
});

test("buildOutcome: mixed new/updated/unchanged", () => {
  const newEntry = makeParsedEntry("/music/new.flac");
  const existingTrack = makeTrack("/music/existing.flac", {
    fileSize: 5000000,
    duration: 180,
  });
  const unchangedEntry = makeParsedEntry("/music/existing.flac", {
    fileSize: 5000000,
  });
  // changedTrack has old size, changedEntry has new size → should be updated
  const changedTrack = makeTrack("/music/modified.flac", {
    fileSize: 5000000,
    duration: 180,
  });
  const changedEntry = makeParsedEntry("/music/modified.flac", {
    fileSize: 6000000,
  });

  const result = buildOutcome(
    [newEntry, unchangedEntry, changedEntry],
    [existingTrack, changedTrack],
  );

  assert.equal(result.added.length, 1);
  assert.equal(result.updated.length, 1);
  assert.equal(result.unchanged, 1);
  assert.equal(result.added[0].fileName, "new.flac");
  assert.equal(result.updated[0].fileName, "modified.flac");
});

test("buildOutcome: generates covers for new tracks with embedded art", () => {
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
  const entry = makeParsedEntry("/music/new.flac", {
    parsedOverrides: { cover: blob },
  });

  const result = buildOutcome([entry], []);

  assert.equal(result.added.length, 1);
  assert.equal(result.covers.length, 1);
  assert.equal(result.covers[0].id, result.added[0].coverId);
  assert.equal(result.covers[0].blob, blob);
});

test("buildOutcome: reuses existing track ID for same path", () => {
  const filePath = "/music/existing.flac";
  const track = makeTrack(filePath, { fileSize: 5000000, duration: 180 });
  const entry = makeParsedEntry(filePath, { fileSize: 6000000 });

  const result = buildOutcome([entry], [track]);

  assert.equal(result.updated[0].id, track.id);
});
