import { strict as assert } from "node:assert";
import { test } from "node:test";
import { sortArtists } from "./catalog";
import { compareNames, scriptOf, scriptOfChar } from "./collation";

const sorted = (names: string[]): string[] => [...names].sort(compareNames);

test("classifies the first character into its sort group", () => {
  assert.equal(scriptOfChar("!"), "symbol");
  assert.equal(scriptOfChar("中"), "han");
  assert.equal(scriptOfChar("1"), "digit");
  assert.equal(scriptOfChar("１"), "digit"); // 全角数字
  assert.equal(scriptOfChar("a"), "lower");
  assert.equal(scriptOfChar("A"), "upper");
  assert.equal(scriptOfChar("ø"), "lower"); // 带声调的拉丁字母仍算字母
  assert.equal(scriptOfChar("Ø"), "upper");
  assert.equal(scriptOfChar("あ"), "kana");
  assert.equal(scriptOfChar("ア"), "kana");
  assert.equal(scriptOfChar("ｱ"), "kana"); // 半角片假名
  assert.equal(scriptOfChar("한"), "hangul");
  assert.equal(scriptOfChar("漢"), "han");
});

test("treats unlisted characters as symbols", () => {
  assert.equal(scriptOfChar("③"), "symbol"); // 带圈数字不是数字
  assert.equal(scriptOfChar("♪"), "symbol");
  assert.equal(scriptOfChar("\u{1F3B5}"), "symbol"); // emoji
  assert.equal(scriptOf("   "), "symbol"); // 空串/空白
  assert.equal(scriptOf("  John"), "upper"); // 跳过前导空白
  assert.equal(scriptOf("«Quote»"), "symbol"); // 前置标点不跳过
});

test("sorts names by symbol, digit, lower, upper, kana, hangul, han", () => {
  assert.deepEqual(
    sorted(["漢", "한", "ア", "A", "a", "1", "!"]),
    ["!", "1", "a", "A", "ア", "한", "漢"],
  );
});

test("orders numbers numerically inside the digit group", () => {
  assert.deepEqual(sorted(["10", "1", "2"]), ["1", "2", "10"]);
});

test("orders lower case before upper case inside the letter groups", () => {
  assert.deepEqual(sorted(["b", "A", "a", "B"]), ["a", "b", "A", "B"]);
  // 组内仍按英文规则，带声调的字母紧邻其基字母
  assert.deepEqual(sorted(["Zebra", "Zürich"]), ["Zebra", "Zürich"]);
});

test("orders kana in gojuuon order and keeps variants adjacent", () => {
  assert.deepEqual(sorted(["ん", "さ", "あ", "か"]), ["あ", "か", "さ", "ん"]);
  assert.ok(compareNames("あ", "ア") !== 0); // 平假名/片假名相邻但有确定顺序
  assert.ok(
    Math.abs(compareNames("あ", "ア")) === 1 &&
      compareNames("あ", "か") < 0 &&
      compareNames("ア", "か") < 0,
  );
});

test("orders hangul by the Korean rules", () => {
  assert.deepEqual(sorted(["하", "가", "나"]), ["가", "나", "하"]);
});

test("orders han by pinyin (zh-Hans-CN)", () => {
  assert.deepEqual(sorted(["周", "张", "安"]), ["安", "张", "周"]);
});

test("symbols win over everything else, including numbers", () => {
  assert.ok(compareNames("«Quote»", "1") < 0);
  assert.ok(compareNames("③", "9") < 0);
  assert.ok(compareNames("漢", "!") > 0);
});

test("catalog artist sorting follows the collation rule", () => {
  const artists = ["陈奕迅", "한예슬", "アリス", "ABBA", "a-ha", "2Pac"].map(
    (name) => ({ name, tracks: [], duration: 0 }),
  );
  assert.deepEqual(
    sortArtists(artists, "name").map(({ name }) => name),
    ["2Pac", "a-ha", "ABBA", "アリス", "한예슬", "陈奕迅"],
  );
});
