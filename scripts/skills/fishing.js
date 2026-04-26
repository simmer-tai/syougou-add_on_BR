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

// 直近に釣り竿を使ったプレイヤー: playerId -> { player }
const lastCastPlayer = new Map();

// 監視中の浮き: hookId -> { playerId, dimensionId }
const watchedHooks = new Map();

// 消滅後の監視リスト: playerId -> { snapshot, ticksWaited }
const pendingChecks = new Map();

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

// 釣り竿使用時に記録
world.afterEvents.itemUse.subscribe((event) => {
    if (event.itemStack.typeId !== "minecraft:fishing_rod") return;
    
    // 使用したプレイヤーを記録
    lastCastPlayer.set(event.source.id, {
        player: event.source
    });
});

// 浮きスポーン時に直近のキャストと紐付け
world.afterEvents.entitySpawn.subscribe((event) => {
    const { entity } = event;
    if (entity.typeId !== "minecraft:fishing_hook") return;

    let bestPlayerId = null;
    let minDistance = Infinity;

    for (const [playerId, data] of lastCastPlayer) {
        const p = data.player;
        if (!p.isValid() || p.dimension.id !== entity.dimension.id) continue;

        const loc = p.location;
        const eloc = entity.location;
        const dist = Math.sqrt(
            Math.pow(loc.x - eloc.x, 2) + 
            Math.pow(loc.y - eloc.y, 2) + 
            Math.pow(loc.z - eloc.z, 2)
        );

        if (dist < minDistance) {
            minDistance = dist;
            bestPlayerId = playerId;
        }
    }

    if (!bestPlayerId) return;

    lastCastPlayer.delete(bestPlayerId);

    watchedHooks.set(entity.id, {
        playerId: bestPlayerId,
        dimensionId: entity.dimension.id
    });
});

// 2tickごとに監視
system.runInterval(() => {
    // 1. 浮きの生存確認
    for (const [hookId, data] of watchedHooks) {
        const dim = world.getDimension(data.dimensionId);
        const stillExists = dim.getEntities().some(e => e.id === hookId);

        if (!stillExists) {
            watchedHooks.delete(hookId);
            const player = world.getAllPlayers().find(p => p.id === data.playerId);
            if (!player?.isValid()) continue;

            // 浮きが消えた瞬間にスナップショットを取得し、監視リストに移動
            pendingChecks.set(data.playerId, {
                snapshot: getInventorySnapshot(player),
                ticksWaited: 0
            });
        }
    }

    // 2. 消滅後のインベントリ増加待機監視
    for (const [playerId, pending] of pendingChecks) {
        const player = world.getAllPlayers().find(p => p.id === playerId);
        if (!player?.isValid()) {
            pendingChecks.delete(playerId);
            continue;
        }

        const afterSnapshot = getInventorySnapshot(player);
        if (!afterSnapshot) {
            pendingChecks.delete(playerId);
            continue;
        }

        let maxXp = 0;
        for (const [typeId, amount] of afterSnapshot) {
            const prev = pending.snapshot?.get(typeId) ?? 0;
            if (amount <= prev) continue;

            if (FISH_ITEMS.has(typeId)) maxXp = Math.max(maxXp, XP_FISH);
            else if (TREASURE_ITEMS.has(typeId)) maxXp = Math.max(maxXp, XP_TREASURE);
            else if (JUNK_ITEMS.has(typeId)) maxXp = Math.max(maxXp, XP_JUNK);
        }

        if (maxXp > 0) {
            updateSkillXp(player, "fishing", "漁業", maxXp);
            pendingChecks.delete(playerId);
            continue;
        }

        pending.ticksWaited += 2;
        if (pending.ticksWaited >= 20) {
            pendingChecks.delete(playerId);
        }
    }
}, 2);
