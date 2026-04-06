import { world, ItemStack, system } from "@minecraft/server";

// --- 農業スキル設定 ---

// 経験値テーブル (収穫ごとの獲得XP)
const FARMING_XP_TABLE = {
    "minecraft:wheat": 3,
    "minecraft:carrots": 3,
    "minecraft:potatoes": 3,
    "minecraft:beetroot": 3,
    "minecraft:pumpkin": 10,
    "minecraft:melon_block": 10
};

// 追加ドロップアイテムのマッピング
const FARMING_DROP_MAP = {
    "minecraft:wheat": "minecraft:wheat",
    "minecraft:carrots": "minecraft:carrot",
    "minecraft:potatoes": "minecraft:potato",
    "minecraft:beetroot": "minecraft:beetroot",
    "minecraft:pumpkin": "minecraft:pumpkin",
    "minecraft:melon_block": "minecraft:melon_slice"
};

// 成長段階のチェックが必要な作物
const CROPS_WITH_GROWTH = new Set([
    "minecraft:wheat",
    "minecraft:carrots",
    "minecraft:potatoes",
    "minecraft:beetroot"
]);

import { updateSkillXp, getNextLevelXp as utilsGetNextLevelXp } from "./utils.js"; // Alias helper if needed locally, though addFarmingXp simplifies this.

// 次のレベルに必要な経験値を計算
function getNextLevelXp(level) {
    return utilsGetNextLevelXp(level);
}

// 経験値を加算する関数
function addFarmingXp(player, amount) {
    updateSkillXp(player, "farming", "農業", amount);
}

const playerPlacedCropLocations = new Set();

world.afterEvents.playerPlaceBlock.subscribe((event) => {
    const { block } = event;
    if (block.typeId === "minecraft:pumpkin" || block.typeId === "minecraft:melon_block") {
        const loc = block.location;
        playerPlacedCropLocations.add(`${loc.x},${loc.y},${loc.z}`);
    }
});

// 鉱石ごとの追加ドロップ確率補正 (構造を採掘スキルと合わせる)
const FARMING_RARITY_MODIFIER = {
    "minecraft:wheat": 1.0,
    "minecraft:carrots": 1.0,
    "minecraft:potatoes": 1.0,
    "minecraft:beetroot": 1.0,
    "minecraft:pumpkin": 0.8,
    "minecraft:melon_block": 0.8
};

// ブロック破壊イベントの監視 (スキル専用)
world.afterEvents.playerBreakBlock.subscribe((event) => {
    const { player, block, brokenBlockPermutation } = event;
    const typeId = brokenBlockPermutation.type.id;

    // 対象の作物かチェック
    if (typeId in FARMING_XP_TABLE) {
        // 成長段階チェック (完全に育っていないと無効)
        if (CROPS_WITH_GROWTH.has(typeId)) {
            const growth = brokenBlockPermutation.getState("growth");
            if (growth !== 7) return;
        }

        // スイカのシルクタッチチェック (無効)
        if (typeId === "minecraft:melon_block") {
            const item = event.itemStackBeforeBreak;
            const hasSilk = item && item.getComponent("minecraft:enchantments")?.enchantments?.has("silk_touch");
            if (hasSilk) return;
        }

        // プレイヤー設置チェック (カボチャ・スイカ)
        if (typeId === "minecraft:pumpkin" || typeId === "minecraft:melon_block") {
            const key = `${block.location.x},${block.location.y},${block.location.z}`;
            if (playerPlacedCropLocations.has(key)) {
                playerPlacedCropLocations.delete(key);
                return;
            }
        }

        // 1. 経験値加算
        addFarmingXp(player, FARMING_XP_TABLE[typeId]);

        // 2. 追加ドロップ判定 (採掘スキルと同じ仕様)
        const level = player.getDynamicProperty("skill_lv_farming") ?? 1;
        const numTrials = 1 + Math.floor(level / 10); // 10レベルごとに試行回数増加
        const chancePerTrial = level * 0.001 * (FARMING_RARITY_MODIFIER[typeId] ?? 1.0); // 1レベルごとに0.1% * 補正

        let dropAmount = 0;
        for (let i = 0; i < numTrials; i++) {
            if (Math.random() < chancePerTrial) {
                dropAmount++;
            }
        }

        if (dropAmount > 0) {
            const dropItemType = FARMING_DROP_MAP[typeId];
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

        // 3. 経験値オーブドロップ (Lv15以上, 50%の確率で1点)
        if (level >= 15 && Math.random() < 0.5) {
            const spawnLoc = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };
            block.dimension.spawnExperienceOrb(1, spawnLoc);
        }
    }
});

// 骨粉使用イベントの監視
world.afterEvents.itemUseOn.subscribe((event) => {
    const { itemStack, block, source } = event;

    if (source.typeId !== "minecraft:player") return;
    if (itemStack?.typeId !== "minecraft:bone_meal") return;

    // 対象の作物かチェック (CROPS_WITH_GROWTH + カボチャ/スイカの茎)
    const isCrop = CROPS_WITH_GROWTH.has(block.typeId);
    const isStem = block.typeId === "minecraft:pumpkin_stem" || block.typeId === "minecraft:melon_stem";

    if (isCrop || isStem) {
        // 経験値加算 (+1)
        addFarmingXp(source, 1);
    }
});

// コマンドでステータス確認: /scriptevent syougou:farming
system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "syougou:farming") {
        const player = event.sourceEntity;
        if (!player) return;

        const xpKey = "skill_xp_farming";
        const lvKey = "skill_lv_farming";

        const xp = player.getDynamicProperty(xpKey) ?? 0;
        const level = player.getDynamicProperty(lvKey) ?? 1;
        const required = getNextLevelXp(level);
        const remaining = required - xp;

        let message = `§e=== 🌾 農業スキル (Lv.${level}) ===§r\n`;
        message += `§7経験値: §f${xp} / ${required} XP\n`;
        message += `§7次のレベルまで: §aあと ${remaining} XP§r\n`;
        message += `§e[目安] あと必要な収穫数:\n`;
        message += `§7- 小麦/人参等 (3XP): §f${Math.ceil(remaining / 3)}個\n`;
        message += `§7- カボチャ/スイカ (10XP): §f${Math.ceil(remaining / 10)}個`;

        player.sendMessage(message);
    }
});