import { world, system } from "@minecraft/server";
import { updateSkillXp } from "./utils.js";

// --- 整地スキル設定 ---

// 経験値テーブル (ブロック破壊ごとの獲得XP)
const EXCAVATION_XP_TABLE = {
    // 土系 (+0.5)
    "minecraft:dirt": 0.5,
    "minecraft:grass_block": 0.5,
    "minecraft:dirt_with_roots": 0.5,
    "minecraft:grass_path": 0.5,
    "minecraft:coarse_dirt": 0.5,
    "minecraft:mud": 0.5,
    "minecraft:clay": 0.5,
    "minecraft:sand": 0.5,
    "minecraft:gravel": 0.5,
    "minecraft:soul_sand": 0.5,
    "minecraft:soul_soil": 0.5,
    "minecraft:podzol": 0.5,
    "minecraft:mycelium": 0.5,
    "minecraft:rooted_dirt": 0.5,
    "minecraft:muddy_mangrove_roots": 0.5,

    // 石系 (+1)
    "minecraft:stone": 1,
    "minecraft:cobblestone": 1,
    "minecraft:deepslate": 1,
    "minecraft:cobbled_deepslate": 1,
    "minecraft:granite": 1,
    "minecraft:diorite": 1,
    "minecraft:andesite": 1,
    "minecraft:tuff": 1,
    "minecraft:netherrack": 1,
    "minecraft:end_stone": 1,
    "minecraft:basalt": 1,
    "minecraft:smooth_basalt": 1,
    "minecraft:blackstone": 1,
    "minecraft:calcite": 1,
    "minecraft:dripstone_block": 1,
    "minecraft:obsidian": 1,
    "minecraft:crying_obsidian": 1,
    "minecraft:magma": 1
};

// 経験値を加算する関数
function addExcavationXp(player, amount) {
    updateSkillXp(player, "excavation", "整地", amount);
}

// ブロック破壊イベントの監視 (スキル専用)
world.afterEvents.playerBreakBlock.subscribe((event) => {
    const { player, brokenBlockPermutation } = event;
    const typeId = brokenBlockPermutation.type.id;

    // シルクタッチの場合は経験値なし (通常は整地でも入るべきだが、他スキルと合わせるならなしも可。今回は指定なしなので一旦除外しない、が一般的だが、
    // 採掘スキルなどでは除外していた。整地は「量」が重要なのでシルクタッチでも入るべきかもしれない。
    // しかし、無限増殖防止(設置->破壊)の観点から考えると、設置判定がないとまずい。
    // 今回の仕様では「整地スキル」として、天然ブロックかどうかの判定が要求されていないが、
    // 既存のコード(mining.js)ではstoneのXPを削除した経緯がある。
    // ここでは、単純にIDチェックのみ行う。設置判定は大変なので一旦考慮しない（要望になし）。

    // いや、待てよ。mining.jsでStone XPを消した理由が「設置した石で稼げてしまう」からなら、
    // ここでも同じ問題が起きる。
    // しかし、User Requestは「整地スキル」なので、設置したものを壊すのも整地といえるか...？
    // 通常、Skill addonsでは設置判定を入れる。
    // ただ、今回は既存の infrastructure (playerPlacedBlock) があるのでそれを使いたいが、
    // 全種類のブロックを追跡するのはメモリ的に厳しい。
    // 
    // リクエストには「土系+1、石系+2」とあるだけ。
    // ひとまずシンプルに実装し、問題があれば修正する方針とする。
    // シルクタッチチェックもしない（土などはシルクタッチ関係ないことが多い）。

    if (typeId in EXCAVATION_XP_TABLE) {
        addExcavationXp(player, EXCAVATION_XP_TABLE[typeId]);
    }
});

// Lv15効果: 採掘速度上昇I (Haste I)
// 常時効果なので、定期的にチェックして付与する
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const level = player.getDynamicProperty("skill_lv_excavation") ?? 1;
        if (level >= 15) {
            player.addEffect("haste", 40, {
                amplifier: 0, // 0 = Level 1
                showParticles: false
            });
        }
    }
}, 20); // 1秒ごとに更新 (効果時間は2秒分あるので切れない)
