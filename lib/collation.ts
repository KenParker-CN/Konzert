/**
 * 名称排序规则（曲库中所有「按名称排序」都走这里，便于统一调整）。
 *
 * 规则：先按**首字符的类别**分组，组间顺序为
 * 特殊符号 → 数字 → 小写字母 → 大写字母 → 假名 → 谚文 → 汉字；
 * 同组内再按该文字的语言规则比较：
 * - 数字：按数值（「2」在「10」之前）；
 * - 拉丁字母：按英文规则，大小写与声调符号敏感（组内已按大小写分开，故以小写组为主）；
 * - 假名：按日文规则（五十音顺序，平假名/片假名同音相邻）；
 * - 谚文：按韩文规则（가나다 顺序）；
 * - 汉字：按中文规则（zh-Hans-CN，即拼音顺序）。
 *
 * 说明：
 * - 带声调符号的拉丁字母（é、ü、å）与希腊文、西里尔文等带大小写的文字，
 *   按 Unicode 大小写属性进入「小写字母 / 大写字母」组，不会被当作特殊符号；
 * - 未列入上述类别的字符（标点、符号、emoji 等）归入「特殊符号」组；
 * - 判定依据是首个非空白字符（不做「跳过前置标点」处理），
 *   因此以引号或书名号开头的名称会进入特殊符号组。
 */

/** 首字符类别，同时也是排序分组。 */
export type NameScript =
    | "symbol"
    | "digit"
    | "lower"
    | "upper"
    | "kana"
    | "hangul"
    | "han";

/** 组间顺序：特殊符号 → 数字 → 小写字母 → 大写字母 → 假名 → 谚文 → 汉字。 */
export const NAME_SCRIPT_ORDER: readonly NameScript[] = [
    "symbol",
    "digit",
    "lower",
    "upper",
    "kana",
    "hangul",
    "han",
];

const SCRIPT_RANK: Record<NameScript, number> = {
    symbol: 0,
    digit: 1,
    lower: 2,
    upper: 3,
    kana: 4,
    hangul: 5,
    han: 6,
};

/** 组内比较使用的 locale；汉字用 zh-Hans-CN 即按拼音排序。 */
const SCRIPT_LOCALE: Record<NameScript, string> = {
    symbol: "en",
    digit: "en",
    lower: "en",
    upper: "en",
    kana: "ja",
    hangul: "ko",
    han: "zh-Hans-CN",
};

/** 数字（含全角「０-９」，\p{Nd} 覆盖各文种十进制数字）。 */
const DIGIT_PATTERN = /^\p{Nd}$/u;
/** 小写字母（\p{Ll}，含拉丁以外的带大小写文字，如希腊文、西里尔文）。 */
const LOWER_PATTERN = /^\p{Ll}$/u;
/** 大写字母与词首大写字母（\p{Lu}\p{Lt}）。 */
const UPPER_PATTERN = /^[\p{Lu}\p{Lt}]$/u;
/** 平假名、片假名、片假名扩展与半角片假名。 */
const KANA_PATTERN = /^[\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF\uFF66-\uFF9D]$/;
/** 谚文音节与字母（含兼容字母与半角字母）。 */
const HANGUL_PATTERN =
    /^[\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uAC00-\uD7A3\uFFA0-\uFFDC]$/;
/** 汉字（基本区、扩展 A、兼容区与扩展 B 起）。 */
const HAN_PATTERN = /^[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u{20000}-\u{2FA1F}]$/u;

/** 判断单个字符属于哪个排序分组；未匹配任何类别时归为特殊符号。 */
export function scriptOfChar(char: string): NameScript {
    if (!char) return "symbol";
    if (DIGIT_PATTERN.test(char)) return "digit";
    if (LOWER_PATTERN.test(char)) return "lower";
    if (UPPER_PATTERN.test(char)) return "upper";
    if (KANA_PATTERN.test(char)) return "kana";
    if (HANGUL_PATTERN.test(char)) return "hangul";
    if (HAN_PATTERN.test(char)) return "han";
    return "symbol";
}

/** 取首个非空白字符所属的分组；空串归入特殊符号组。 */
export function scriptOf(value: string): NameScript {
    for (const char of value.trim()) {
        return scriptOfChar(char);
    }
    return "symbol";
}

/**
 * 名称比较函数，可直接传给 `Array.prototype.sort`。
 *
 * 组间按 {@link NAME_SCRIPT_ORDER} 排序；同组内按该文字的语言规则比较，
 * 数字按数值比较；完全相等时按码点兜底，保证顺序稳定。
 */
export function compareNames(a: string, b: string): number {
    const scriptA = scriptOf(a);
    const scriptB = scriptOf(b);
    if (scriptA !== scriptB) {
        return SCRIPT_RANK[scriptA] - SCRIPT_RANK[scriptB];
    }

    const result = a.localeCompare(b, SCRIPT_LOCALE[scriptA], {
        numeric: true,
        sensitivity: "variant",
    });
    if (result !== 0) return result;

    // 同组同权重（如仅码点不同）时按码点排序，保证比较结果自洽。
    return a < b ? -1 : a > b ? 1 : 0;
}
