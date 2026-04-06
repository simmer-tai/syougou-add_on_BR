import { world, ItemStack } from "@minecraft/server";
import { updateSkillXp } from "./utils.js";

// --- 狩人スキル設定 ---

const HUNTER_LOOT = [
    "minecraft:rotten_flesh",
    "minecraft:bone",
    "minecraft:gunpowder",
    "minecraft:spider_eye",
    "minecraft:string",
    "minecraft:arrow",
    "minecraft:leather",
    "minecraft:iron_nugget",
    "minecraft:gold_nugget",
    "minecraft:emerald" // レア枠
];

function addHunterXp(player, amount) {
    updateSkillXp(player, "hunter", "狩人", amount);
}

world.afterEvents.entityDie.subscribe((event) => {
    const { deadEntity, damageSource } = event;
    const killer = damageSource.damagingEntity;

    // プレイヤーによる攻撃かチェック
    if (!killer || killer.typeId !== "minecraft:player") return;

    // 敵モブ判定
    const family = deadEntity.getComponent("minecraft:type_family");
    if (!family || !family.hasTypeFamily("monster")) return;

    // ディメンションによる基本XP計算
    const dimensionId = deadEntity.dimension.id;
    let xp = 0;

    if (dimensionId === "minecraft:overworld") {
        xp = 10;
    } else if (dimensionId === "minecraft:nether") {
        xp = 20;
    } else if (dimensionId === "minecraft:the_end") {
        xp = 30;
    }

    if (xp === 0) return;

    // レベル取得
    const level = killer.getDynamicProperty("skill_lv_hunter") ?? 1;

    // 1. ダブルXPチャンス (Lv * 0.3%)
    const doubleXpChance = level * 0.003;
    if (Math.random() < doubleXpChance) {
        xp *= 2;
        killer.onScreenDisplay.setActionBar(`§c[狩人]§r §eダブルXP発動！ +${xp} XP§r`);
    }

    // XP付与
    addHunterXp(killer, xp);

    // 2. 追加アイテムドロップ (Lv * 0.3%)
    const dropChance = level * 0.003;
    if (Math.random() < dropChance) {
        const dropType = HUNTER_LOOT[Math.floor(Math.random() * HUNTER_LOOT.length)];
        try {
            const itemStack = new ItemStack(dropType, 1);
            deadEntity.dimension.spawnItem(itemStack, deadEntity.location);

        } catch (e) {
            console.warn(`Failed to spawn bonus hunter item: ${e}`);
        }
    }
});
