import { world, system, ItemStack } from "@minecraft/server";
import { updateSkillXp } from "./utils.js";
import { FOOD_ITEMS } from "../utils.js";

// --- 畜産スキル設定 ---

// XP設定
const XP_SHEARING = 5;
const XP_FEEDING = 5;
const XP_TAMING = 20;
const XP_KILLING = 10;

// 手懐け用アイテム (簡易リスト: main.jsと同期推奨だがここでは主要なものを定義)
const TAMING_ITEMS = new Set([
    "minecraft:bone",
    "minecraft:cod",
    "minecraft:salmon",
    "minecraft:tropical_fish",
    "minecraft:pufferfish",
    "minecraft:wheat_seeds",
    "minecraft:pumpkin_seeds",
    "minecraft:melon_seeds",
    "minecraft:beetroot_seeds",
    "minecraft:apple",
    "minecraft:golden_carrot",
    "minecraft:wheat",        // 牛・羊・馬など
    "minecraft:hay_block",    // ラマ・馬
    "minecraft:dandelion",    // ウサギ
    "minecraft:slime_ball",   // カエル
    "minecraft:sweet_berries",// キツネ
    "minecraft:glow_berries", // キツネ
    "minecraft:bamboo",       // パンダ
    "minecraft:seagrass",     // カメ
    "minecraft:warped_fungus",// ストライダー
    "minecraft:crimson_fungus"// ホグリン
]);

function addHusbandryXp(player, amount) {
    updateSkillXp(player, "husbandry", "畜産", amount);
}

// インタラクトイベント (毛刈り、餌やり、手懐け)
world.afterEvents.playerInteractWithEntity.subscribe((event) => {
    const { player, target, itemStack } = event;
    if (!itemStack) return;

    const level = player.getDynamicProperty("skill_lv_husbandry") ?? 1;

    // 1. 毛刈り (Shearing)
    if (itemStack.typeId === "minecraft:shears" && target.typeId === "minecraft:sheep") {
        addHusbandryXp(player, XP_SHEARING);

        // 追加ドロップ判定: Lv * 0.3%
        const dropChance = level * 0.003;
        if (Math.random() < dropChance) {
            const colorComp = target.getComponent("minecraft:color");
            let colorValue = 0;
            if (colorComp) {
                colorValue = colorComp.value;
            }

            const colorNames = [
                "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
                "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black"
            ];

            if (colorValue >= 0 && colorValue < colorNames.length) {
                const woolId = `minecraft:${colorNames[colorValue]}_wool`;
                try {
                    target.dimension.spawnItem(new ItemStack(woolId, 1), target.location);
                } catch (e) {
                    target.dimension.spawnItem(new ItemStack("minecraft:white_wool", 1), target.location);
                }
            } else {
                target.dimension.spawnItem(new ItemStack("minecraft:white_wool", 1), target.location);
            }
        }
        return;
    }

    // 2. 手懐け (Taming)
    if (TAMING_ITEMS.has(itemStack.typeId)) {
        addHusbandryXp(player, XP_TAMING);
    }

    // 3. 餌やり (Feeding)
    const isFood = FOOD_ITEMS.has(itemStack.typeId) || TAMING_ITEMS.has(itemStack.typeId) || itemStack.typeId.includes("seeds");

    if (isFood) {
        addHusbandryXp(player, XP_FEEDING);

        // 消費無効 (Feed Efficiency): Lv * 0.5% (Max 50%)
        let saveChance = level * 0.005;
        if (saveChance > 0.5) saveChance = 0.5;

        if (Math.random() < saveChance) {
            // アイテムを返却
            const inv = player.getComponent("inventory");
            if (inv) {
                inv.container.addItem(new ItemStack(itemStack.typeId, 1));
            }
        }
    }
});

// 動物討伐イベント
world.afterEvents.entityDie.subscribe((event) => {
    const { deadEntity, damageSource } = event;
    const killer = damageSource.damagingEntity;
    if (!killer) return;

    let player;
    if (killer.typeId === "minecraft:player") {
        player = killer;
    } else {
        // 遠距離攻撃（弓など）の場合、射撃主を確認
        const projectile = killer.getComponent("minecraft:projectile");
        if (projectile && projectile.owner && projectile.owner.typeId === "minecraft:player") {
            player = projectile.owner;
        }
    }

    if (!player) return;

    const family = deadEntity.getComponent("minecraft:type_family");
    if (family && (family.hasTypeFamily("animal") || family.hasTypeFamily("water_animal"))) { // Monsterは除外
        if (family.hasTypeFamily("monster")) return;

        addHusbandryXp(player, XP_KILLING);
    }
});

// 再生オーラ (Lv25以上)
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const level = player.getDynamicProperty("skill_lv_husbandry") ?? 1;
        if (level < 25) continue;

        const dimension = player.dimension;
        // 半径10マス以内の動物/ペットを検索
        const entities = dimension.getEntities({
            location: player.location,
            maxDistance: 10,
            families: ["animal", "water_animal", "tame"] // 対象ファミリ
        });

        for (const entity of entities) {
            // 敵対モブは除外 (animalかつmonsterなケースは稀だが念のため)
            // const family = entity.getComponent("minecraft:type_family");
            // if (family.hasTypeFamily("monster")) continue;

            try {
                // 再生能力 I (id: regeneration, duration: 100 ticks (5s), amplifier: 0)
                entity.addEffect("regeneration", 100, { amplifier: 0, showParticles: false });
            } catch (e) { }
        }
    }
}, 80); // 4秒ごとに適用 (効果時間5秒なので維持される)
