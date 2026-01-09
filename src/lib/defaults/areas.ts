import type { Area } from "@/lib/firebase/schema";

export type DefaultAreaSeed = { areaId: string; area: Area };

/**
 * 画面ワイヤーの指定順に合わせた初期エリア定義。
 * - 1段目: さる, へび, ランチ, うさぎ, とら, ねずみ
 * - 2段目: 以上児園庭, 事務室, 未満児園庭
 * - 3段目: 裏庭, ビオトープ, 園庭
 * - 右サイド: フリー, 休憩, 園外
 */
export const DEFAULT_AREAS: DefaultAreaSeed[] = [
  { areaId: "saru", area: { name: "さる", order: 10, type: "room" } },
  { areaId: "hebi", area: { name: "へび", order: 20, type: "room" } },
  { areaId: "lunch", area: { name: "ランチ", order: 30, type: "other" } },
  { areaId: "usagi", area: { name: "うさぎ", order: 40, type: "room" } },
  { areaId: "tora", area: { name: "とら", order: 50, type: "room" } },
  { areaId: "nezumi", area: { name: "ねずみ", order: 60, type: "room" } },

  {
    areaId: "yard_older",
    area: { name: "以上児園庭", order: 70, type: "outdoor" },
  },
  { areaId: "office", area: { name: "事務室", order: 80, type: "admin" } },
  {
    areaId: "yard_younger",
    area: { name: "未満児園庭", order: 90, type: "outdoor" },
  },

  // Outdoor split: keep "yard" id for backward compatibility with existing assignments.
  { areaId: "backyard", area: { name: "裏庭", order: 100, type: "outdoor" } },
  { areaId: "biotope", area: { name: "ビオトープ", order: 110, type: "outdoor" } },
  { areaId: "yard", area: { name: "園庭", order: 120, type: "outdoor" } },

  { areaId: "free", area: { name: "フリー", order: 900, type: "free" } },
  { areaId: "break", area: { name: "休憩", order: 910, type: "break" } },
  { areaId: "offsite", area: { name: "園外", order: 920, type: "other" } },
];

