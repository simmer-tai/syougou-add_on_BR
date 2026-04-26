import { world, system, ItemStack } from "@minecraft/server";
import { updateSkillXp } from "./utils.js";
import { FOOD_ITEMS } from "../utils.js";

// --- 畜産スキル設定 ---

// XP設定
const XP_SHEARING = 5;
const XP_FEEDING = 5;
const XP_TAMING = 5; // 20から5に変更
const XP_KILLING = 5;

// 手懐け用アイテム (実際にペットにするアイテム)
const TAMING_ITEMS = new Set([
    "minecraft:bone",
    "minecraft:cod",
    "minecraft:salmon",
    "minecraft:tropical_fish",
    "minecraft:pufferfish",
    "minecraft:bamboo"
]);

function addHusbandryXp(player, amount) {
    updateSkillXp(player, "husbandry", "畜産", amount);
}

// インタラクト直前の手持ちアイテムを記録 (消費判定用)
const playerHandBeforeInteract = new Map();

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    const { player, itemStack } = event;
    if (itemStack) {
        playerHandBeforeInteract.set(player.id, {
            typeId: itemStack.typeId,
            amount: itemStack.amount,
            slot: player.selectedSlotIndex
        });
    } else {
        playerHandBeforeInteract.delete(player.id);
    }
});

// インタラクトイベント (毛刈り、餌やり、手懐け)
world.afterEvents.playerInteractWithEntity.subscribe((event) => {
    const { player, target } = event;
    
    // 直前の記録を取得
    const beforeItem = playerHandBeforeInteract.get(player.id);
    if (!beforeItem) return;

    // ラグ対策として 1ティック後に判定を行う
    system.run(() => {
        if (!player.isValid() || !target.isValid()) return;

        // 現在の手持ち状態を直接確認
        const inventory = player.getComponent("minecraft:inventory");
        if (!inventory) return;
        const container = inventory.container;
        const currentItem = container.getItem(beforeItem.slot);

        const itemTypeId = currentItem?.typeId ?? "";
        const itemAmount = currentItem?.amount ?? 0;

        // アイテムが実際に消費されたかチェック
        const isConsumed = itemTypeId !== beforeItem.typeId || itemAmount < beforeItem.amount;
        
        // 毛刈りは shears を持っていれば消費判定なしで通す
        if (!isConsumed && itemTypeId !== "minecraft:shears") return;
        
        // 使用するアイテムID（経験値計算用）
        const effectiveItemId = isConsumed ? beforeItem.typeId : itemTypeId;
        if (!effectiveItemId) return;

        // ターゲットが除外対象（アレイ、村人など）かチェック
        const targetTypeId = target.typeId;
        const isExcluded = targetTypeId === "minecraft:allay" || 
                           targetTypeId === "minecraft:villager" || 
                           targetTypeId === "minecraft:wandering_trader" ||
                           targetTypeId === "minecraft:player";

        // 毛刈り以外のインタラクト（餌やり・手懐け）は除外対象なら終了
        if (itemTypeId !== "minecraft:shears" && isExcluded) return;

        const level = player.getDynamicProperty("skill_lv_husbandry") ?? 1;

        // 1. 毛刈り (Shearing)
        if (itemTypeId === "minecraft:shears" && target.typeId === "minecraft:sheep") {
            addHusbandryXp(player, XP_SHEARING);

            // 追加ドロップ判定
            const dropChance = level * 0.003;
            if (Math.random() < dropChance) {
                const colorComp = target.getComponent("minecraft:color");
                let colorValue = 0;
                if (colorComp) colorValue = colorComp.value;

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

        // 2. 手懐け & 3. 餌やり (統合して重複加算を防止)
        const isTaming = TAMING_ITEMS.has(effectiveItemId);
        const isFeeding = FOOD_ITEMS.has(effectiveItemId) || 
                          effectiveItemId.includes("seeds") || 
                          effectiveItemId === "minecraft:wheat" || 
                          effectiveItemId === "minecraft:hay_block" ||
                          effectiveItemId === "minecraft:dandelion" ||
                          effectiveItemId === "minecraft:slime_ball" ||
                          effectiveItemId === "minecraft:sweet_berries" ||
                          effectiveItemId === "minecraft:glow_berries" ||
                          effectiveItemId === "minecraft:seagrass" ||
                          effectiveItemId === "minecraft:warped_fungus" ||
                          effectiveItemId === "minecraft:crimson_fungus";

        if (isTaming || isFeeding) {
            const xp = isTaming ? XP_TAMING : XP_FEEDING;
            addHusbandryXp(player, xp);

            // 消費無効 (Feed Efficiency)
            let saveChance = level * 0.005;
            if (saveChance > 0.5) saveChance = 0.5;

            if (Math.random() < saveChance) {
                if (container) {
                    container.addItem(new ItemStack(effectiveItemId, 1));
                }
            }
        }
    });
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

        // 子供（is_baby）は除外
        if (deadEntity.getComponent("minecraft:is_baby")) return;

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
