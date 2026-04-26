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
    // "minecraft:fishing_rod", // ユーザー指定によりジャンク扱いに統一するため削除
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

// 監視中の浮き: hookId -> { playerId, dimensionId, snapshot }
const watchedHooks = new Map();

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
    if (entity.typeId !== "minecraft:fishing_hook") return;

    // 所有者特定: 最も近くで釣り竿を持っているプレイヤー
    const players = entity.dimension.getPlayers({
        location: entity.location,
        maxDistance: 4,
        closest: 1
    });
    if (players.length === 0) return;
    const p = players[0];
    const mainHand = p.getComponent("equippable")?.getEquipment("Mainhand");
    if (mainHand?.typeId !== "minecraft:fishing_rod") return;

    // スポーン時点のインベントリスナップショットを保存
    watchedHooks.set(entity.id, {
        playerId: p.id,
        dimensionId: entity.dimension.id,
        snapshot: getInventorySnapshot(p)
    });
});

// 2tickごとに浮きの生存確認
system.runInterval(() => {
    for (const [hookId, data] of watchedHooks) {
        const dim = world.getDimension(data.dimensionId);
        // 生存確認
        const stillExists = dim.getEntities().some(e => e.id === hookId);

        if (stillExists) continue;

        // 消滅検知
        watchedHooks.delete(hookId);

        const player = world.getAllPlayers().find(p => p.id === data.playerId);
        if (!player?.isValid()) continue;

        const afterSnapshot = getInventorySnapshot(player);
        if (!afterSnapshot) continue;

        let maxXp = 0;
        for (const [typeId, amount] of afterSnapshot) {
            const prev = data.snapshot.get(typeId) ?? 0;
            if (amount <= prev) continue;

            if (FISH_ITEMS.has(typeId)) maxXp = Math.max(maxXp, XP_FISH);
            else if (TREASURE_ITEMS.has(typeId)) maxXp = Math.max(maxXp, XP_TREASURE);
            else if (JUNK_ITEMS.has(typeId)) maxXp = Math.max(maxXp, XP_JUNK);
        }

        if (maxXp > 0) {
            updateSkillXp(player, "fishing", "漁業", maxXp);
        }
    }
}, 2);
