import { world, ItemStack } from "@minecraft/server";

// --- 採掘スキル設定 ---

// 経験値テーブル (鉱石破壊ごとの獲得XP)
const MINING_XP_TABLE = {
    "minecraft:coal_ore": 2.5,
    "minecraft:deepslate_coal_ore": 3.75,
    "minecraft:copper_ore": 2.5,
    "minecraft:deepslate_copper_ore": 3.75,
    "minecraft:iron_ore": 5,
    "minecraft:deepslate_iron_ore": 7.5,
    "minecraft:gold_ore": 7.5,
    "minecraft:deepslate_gold_ore": 11.25,
    "minecraft:redstone_ore": 5,
    "minecraft:deepslate_redstone_ore": 7.5,
    "minecraft:lit_redstone_ore": 5, // 光っているレッドストーン鉱石
    "minecraft:lit_deepslate_redstone_ore": 7.5,
    "minecraft:lapis_ore": 7.5,
    "minecraft:deepslate_lapis_ore": 11.25,
    "minecraft:diamond_ore": 15,
    "minecraft:deepslate_diamond_ore": 22.5,
    "minecraft:quartz_ore": 5
};

// 追加ドロップアイテムのマッピング (通常ドロップ品)
const MINING_DROP_MAP = {
    "minecraft:coal_ore": "minecraft:coal",
    "minecraft:deepslate_coal_ore": "minecraft:coal",
    "minecraft:copper_ore": "minecraft:raw_copper",
    "minecraft:deepslate_copper_ore": "minecraft:raw_copper",
    "minecraft:iron_ore": "minecraft:raw_iron",
    "minecraft:deepslate_iron_ore": "minecraft:raw_iron",
    "minecraft:gold_ore": "minecraft:raw_gold",
    "minecraft:deepslate_gold_ore": "minecraft:raw_gold",
    "minecraft:redstone_ore": "minecraft:redstone",
    "minecraft:deepslate_redstone_ore": "minecraft:redstone",
    "minecraft:lit_redstone_ore": "minecraft:redstone",
    "minecraft:lit_deepslate_redstone_ore": "minecraft:redstone",
    "minecraft:lapis_ore": "minecraft:lapis_lazuli",
    "minecraft:deepslate_lapis_ore": "minecraft:lapis_lazuli",
    "minecraft:diamond_ore": "minecraft:diamond",
    "minecraft:deepslate_diamond_ore": "minecraft:diamond",
    "minecraft:quartz_ore": "minecraft:quartz"
};

// 鉱石ごとの追加ドロップ確率補正 (1.0 = 基準, 値が小さいほど確率は下がる)
const MINING_RARITY_MODIFIER = {
    "minecraft:coal_ore": 1.0,
    "minecraft:deepslate_coal_ore": 1.0,
    "minecraft:copper_ore": 1.0,
    "minecraft:deepslate_copper_ore": 1.0,
    "minecraft:iron_ore": 0.8,
    "minecraft:deepslate_iron_ore": 0.8,
    "minecraft:gold_ore": 0.7,
    "minecraft:deepslate_gold_ore": 0.7,
    "minecraft:redstone_ore": 0.7,
    "minecraft:deepslate_redstone_ore": 0.7,
    "minecraft:lit_redstone_ore": 0.7,
    "minecraft:lit_deepslate_redstone_ore": 0.7,
    "minecraft:lapis_ore": 0.7,
    "minecraft:deepslate_lapis_ore": 0.7,
    "minecraft:diamond_ore": 0.5,
    "minecraft:deepslate_diamond_ore": 0.5,
    "minecraft:quartz_ore": 0.7
};

import { updateSkillXp } from "./utils.js";

// 経験値を加算する関数
function addMiningXp(player, amount) {
    updateSkillXp(player, "mining", "採掘", amount);
}

// ブロック破壊イベントの監視 (スキル専用)
world.afterEvents.playerBreakBlock.subscribe((event) => {
    const { player, block, brokenBlockPermutation } = event;
    const typeId = brokenBlockPermutation.type.id;

    // シルクタッチの場合は経験値・追加ドロップなし
    const item = event.itemStackBeforeBreak;
    const hasSilk = item && item.getComponent("minecraft:enchantments")?.enchantments?.has("silk_touch");
    if (hasSilk) return;

    // 対象の鉱石かチェック
    if (typeId in MINING_XP_TABLE) {
        // 1. 経験値加算
        addMiningXp(player, MINING_XP_TABLE[typeId]);

        // 2. 追加ドロップ判定
        const level = player.getDynamicProperty("skill_lv_mining") ?? 1;
        const numTrials = 1 + Math.floor(level / 10); // 10レベルごとに試行回数増加
        const chancePerTrial = level * 0.001 * (MINING_RARITY_MODIFIER[typeId] ?? 1.0); // 1レベルごとに0.1%

        let dropAmount = 0;
        for (let i = 0; i < numTrials; i++) {
            if (Math.random() < chancePerTrial) {
                dropAmount++;
            }
        }

        if (dropAmount > 0) {
            const dropItemType = MINING_DROP_MAP[typeId];
            
            if (dropItemType) {
                try {
                    // アイテムをスポーンさせる
                    const itemStack = new ItemStack(dropItemType, dropAmount);
                    const spawnLoc = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };
                    block.dimension.spawnItem(itemStack, spawnLoc);
                } catch (e) {
                    console.warn(`[Skills] Failed to spawn bonus item: ${e}`);
                }
            }
        }
    }
});