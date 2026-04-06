import { world, ItemStack, system } from "@minecraft/server";
import { LOG_BLOCKS, playerPlacedLogLocations } from "../utils.js";

// --- 林業スキル設定 ---

import { updateSkillXp, getNextLevelXp as utilsGetNextLevelXp } from "./utils.js";

function getNextLevelXp(level) {
    return utilsGetNextLevelXp(level);
}

// 経験値を加算する関数
function addForestryXp(player, amount) {
    updateSkillXp(player, "forestry", "林業", amount);
}

// ブロック破壊イベントの監視 (スキル専用)
world.afterEvents.playerBreakBlock.subscribe((event) => {
    const { player, block, brokenBlockPermutation } = event;
    const typeId = brokenBlockPermutation.type.id;

    // プレイヤーが設置した原木かどうかをチェック
    const loc = block.location;
    const locationString = `${loc.x},${loc.y},${loc.z}`;
    if (playerPlacedLogLocations.has(locationString)) {
        // 記録から削除し、経験値は与えずに処理を終了
        playerPlacedLogLocations.delete(locationString);
        return;
    }

    // 対象の原木かチェック
    if (LOG_BLOCKS.has(typeId)) {
        // 1. 経験値加算 (+5)
        addForestryXp(player, 5);

        // 2. 追加ドロップ判定
        const level = player.getDynamicProperty("skill_lv_forestry") ?? 1;
        const chance = level * 0.005; // 確率: レベル * 0.5%

        // 確率計算 (100%超え対応: 1.5 -> 1個確定 + 50%で+1個)
        let dropAmount = Math.floor(chance);
        if (Math.random() < (chance - dropAmount)) {
            dropAmount++;
        }

        if (dropAmount > 0) {
            try {
                const itemStack = new ItemStack(typeId, dropAmount);
                const spawnLoc = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };
                block.dimension.spawnItem(itemStack, spawnLoc);
            } catch (e) {
                console.warn(`[Skills] Failed to spawn bonus log: ${e}`);
            }
        }
    }
});

// コマンドでステータス確認: /scriptevent syougou:forestry
system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "syougou:forestry") {
        const player = event.sourceEntity;
        if (!player) return;

        const xpKey = "skill_xp_forestry";
        const lvKey = "skill_lv_forestry";

        const xp = player.getDynamicProperty(xpKey) ?? 0;
        const level = player.getDynamicProperty(lvKey) ?? 1;
        const required = getNextLevelXp(level);
        const remaining = required - xp;

        let message = `§e=== 🌲 林業スキル (Lv.${level}) ===§r\n`;
        message += `§7経験値: §f${xp} / ${required} XP\n`;
        message += `§7次のレベルまで: §aあと ${remaining} XP§r\n`;
        message += `§e[目安] あと必要な原木数:\n`;
        message += `§7- 原木 (5XP): §f${Math.ceil(remaining / 5)}個`;

        player.sendMessage(message);
    }
});