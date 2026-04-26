import { world, system } from "@minecraft/server";
import { updateSkillXp } from "./utils.js";

// XP設定
const XP_FISH = 5;
const XP_TREASURE = 20;
const XP_JUNK = 2;

// アイテムカテゴリ定義
const FISH_ITEMS = new Set([
    "minecraft:cod",
    "minecraft:salmon",
    "minecraft:tropical_fish",
    "minecraft:pufferfish"
]);

const TREASURE_ITEMS = new Set([
    "minecraft:enchanted_book",
    "minecraft:bow",
    "minecraft:fishing_rod",
    "minecraft:name_tag",
    "minecraft:saddle",
    "minecraft:leather_boots",
    "minecraft:leather"
]);

const JUNK_ITEMS = new Set([
    "minecraft:bone",
    "minecraft:stick",
    "minecraft:ink_sac",
    "minecraft:string",
    "minecraft:fishing_rod",
    "minecraft:glass_bottle",
    "minecraft:lily_pad",
    "minecraft:tripwire_hook"
]);

// 釣り針ID -> プレイヤーID
const activeHooks = new Map();

/**
 * インベントリのスナップショット取得
 */
function getInventorySnapshot(player) {
    const inventory = player.getComponent("inventory")?.container;
    if (!inventory) return null;

    const snapshot = new Map();
    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (item) {
            snapshot.set(item.typeId, (snapshot.get(item.typeId) ?? 0) + item.amount);
        }
    }
    return snapshot;
}

// 釣り針のスポーンを監視
world.afterEvents.entitySpawn.subscribe((event) => {
    const { entity } = event;
    if (entity.typeId === "minecraft:fishing_hook") {
        // 所有者を特定
        let owner = entity.getComponent("projectile")?.owner;
        if (!owner) {
            // フォールバック: 最も近くで釣り竿を持っているプレイヤー
            const players = entity.dimension.getPlayers({
                location: entity.location,
                maxDistance: 4,
                closest: 1
            });
            if (players.length > 0) {
                const p = players[0];
                const mainHand = p.getComponent("equippable")?.getEquipment("Mainhand");
                if (mainHand?.typeId === "minecraft:fishing_rod") {
                    owner = p;
                }
            }
        }
        if (owner) {
            activeHooks.set(entity.id, owner.id);
        }
    }
});

// 釣り針の消滅を監視
// 消滅時にプレイヤーのインベントリを一時的に監視する
world.afterEvents.entityRemove.subscribe((event) => {
    // Note: event.removedEntityId (API 1.13.0+) or event.entity.id
    const hookId = event.removedEntityId ?? event.entity?.id;
    if (!hookId) return;

    const playerId = activeHooks.get(hookId);
    if (!playerId) return;

    activeHooks.delete(hookId);

    // プレイヤーを取得
    const player = world.getAllPlayers().find(p => p.id === playerId);
    if (!player || !player.isValid()) return;

    // 消滅時点のスナップショット
    const beforeSnapshot = getInventorySnapshot(player);
    if (!beforeSnapshot) return;

    // 2ティックの猶予でインベントリの変化をチェック
    system.runTimeout(() => {
        if (!player.isValid()) return;
        const afterSnapshot = getInventorySnapshot(player);
        if (!afterSnapshot) return;

        let maxXp = 0;
        let gained = false;

        for (const [typeId, amount] of afterSnapshot) {
            const prevAmount = beforeSnapshot.get(typeId) ?? 0;
            if (amount > prevAmount) {
                gained = true;
                let itemXp = 0;

                if (FISH_ITEMS.has(typeId)) {
                    itemXp = XP_FISH;
                } else if (TREASURE_ITEMS.has(typeId) || JUNK_ITEMS.has(typeId)) {
                    // お宝/ジャンクの区別が必要なアイテムの判定
                    if (typeId === "minecraft:fishing_rod" || typeId === "minecraft:bow") {
                        const inv = player.getComponent("inventory").container;
                        let isEnchanted = false;
                        for (let i = 0; i < inv.size; i++) {
                            const item = inv.getItem(i);
                            if (item && item.typeId === typeId) {
                                const enchantable = item.getComponent("enchantable");
                                if (enchantable && enchantable.getEnchantments().length > 0) {
                                    isEnchanted = true;
                                    break;
                                }
                            }
                        }
                        itemXp = isEnchanted ? XP_TREASURE : XP_JUNK;
                    } else if (TREASURE_ITEMS.has(typeId)) {
                        itemXp = XP_TREASURE;
                    } else if (JUNK_ITEMS.has(typeId)) {
                        itemXp = XP_JUNK;
                    }
                }

                if (itemXp > maxXp) maxXp = itemXp;
            }
        }

        // 釣り上げた場合にXP付与
        if (gained && maxXp > 0) {
            updateSkillXp(player, "fishing", "漁業", maxXp);
        }
    }, 2);
});
