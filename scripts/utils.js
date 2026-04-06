import { world } from "@minecraft/server";

export const OBJECTIVES = {
    TOTAL_BLOCKS: "total_blocks",
    DIRT_GRASS: "dirt_grass",
    LOGS: "logs",
    ORES_TOTAL: "ores_total",
    CROPS: "crops",
    ANIMALS: "animals",
    MONSTERS: "monsters",
    MOBS_TOTAL: "mobs_total",
    MOVED_BLOCKS: "moved_blocks",
    MOVED_X: "moved_x",
    MOVED_Z: "moved_z",
    MOVED_IN_WATER: "moved_in_water",
    PLACED_BLOCKS: "placed_blocks",
    DEATHS: "deaths",
    ORE_GOLD_NS: "ore_gold_ns",
    ORE_DIAMOND_NS: "ore_diamond_ns",
    ORE_REDSTONE_NS: "ore_redstone_ns",
    ORE_LAPIS_NS: "ore_lapis_ns",
    BREEDING: "breeding",
    TRADING: "trading",
    TAMING: "taming",
    FISHING: "fishing",
    // New Objectives
    DEATH_DROWN: "death_drown",
    DEATH_LAVA: "death_lava",
    DEATH_FALL: "death_fall",
    KILL_ZOMBIE_FIST: "kill_zombie_fist",
    KILL_BOW: "kill_bow",
    KILL_CREEPER: "kill_creeper",
    KILL_WITHER: "kill_wither",
    KILL_WARDEN: "kill_warden",
    KILL_NO_ARMOR: "kill_no_armor",
    SHEAR_GRASS: "shear_grass",
    TAME_HORSE: "tame_horse",
    TAME_WOLF_BONE: "tame_wolf_bone",
    TAME_CAT_FISH: "tame_cat_fish",
    TAME_PARROT_SEEDS: "tame_parrot_seeds",
    ELYTRA_FLY: "elytra_fly",
    VISIT_NETHER: "visit_nether",
    // New Titles (Request 2)
    KILL_UNDEAD_SMITE: "kill_undead_smite",
    PUNCH_WARDEN: "punch_warden"
};

export const UNDEAD_TYPES = new Set([
    "minecraft:zombie", "minecraft:zombie_villager", "minecraft:husk", "minecraft:drowned",
    "minecraft:skeleton", "minecraft:stray", "minecraft:wither_skeleton",
    "minecraft:phantom", "minecraft:wither", "minecraft:zoglin"
]);

export const DEBUFF_IDS = new Set([
    "slowness", "mining_fatigue", "instant_damage", "nausea",
    "blindness", "hunger", "weakness", "poison", "wither", "fatal_poison"
]);

export const CORAL_ITEMS = new Set([
    "minecraft:tube_coral", "minecraft:brain_coral", "minecraft:bubble_coral",
    "minecraft:fire_coral", "minecraft:horn_coral"
]);

export const FLOWER_ITEMS = new Set([
    "minecraft:dandelion", "minecraft:poppy", "minecraft:blue_orchid", "minecraft:allium",
    "minecraft:azure_bluet", "minecraft:red_tulip", "minecraft:orange_tulip", "minecraft:white_tulip",
    "minecraft:pink_tulip", "minecraft:oxeye_daisy", "minecraft:cornflower", "minecraft:lily_of_the_valley",
    "minecraft:wither_rose", "minecraft:sunflower", "minecraft:lilac", "minecraft:rose_bush",
    "minecraft:peony", "minecraft:torchflower", "minecraft:pitcher_plant"
]);

export const LOG_BLOCKS = new Set([
    "minecraft:oak_log", "minecraft:spruce_log", "minecraft:birch_log",
    "minecraft:jungle_log", "minecraft:acacia_log", "minecraft:dark_oak_log",
    "minecraft:mangrove_log", "minecraft:cherry_log",
    "minecraft:crimson_stem", "minecraft:warped_stem"
]);

/**
 * @type {Set<string>} プレイヤーが設置した原木の座標を記録するセット (例: "10,64,-20")
 */
export const playerPlacedLogLocations = new Set();

export const FOOD_ITEMS = new Set([
    "minecraft:apple", "minecraft:baked_potato", "minecraft:beetroot", "minecraft:beetroot_soup",
    "minecraft:bread", "minecraft:carrot", "minecraft:chorus_fruit", "minecraft:cooked_chicken",
    "minecraft:cooked_cod", "minecraft:cooked_mutton", "minecraft:cooked_porkchop", "minecraft:cooked_rabbit",
    "minecraft:cooked_salmon", "minecraft:cookie", "minecraft:dried_kelp", "minecraft:enchanted_golden_apple",
    "minecraft:golden_apple", "minecraft:golden_carrot", "minecraft:honey_bottle", "minecraft:melon_slice",
    "minecraft:mushroom_stew", "minecraft:poisonous_potato", "minecraft:potato", "minecraft:pufferfish",
    "minecraft:pumpkin_pie", "minecraft:rabbit_stew", "minecraft:beef", "minecraft:chicken",
    "minecraft:cod", "minecraft:mutton", "minecraft:porkchop", "minecraft:rabbit",
    "minecraft:salmon", "minecraft:rotten_flesh", "minecraft:spider_eye", "minecraft:cooked_beef",
    "minecraft:sweet_berries", "minecraft:suspicious_stew", "minecraft:tropical_fish", "minecraft:glow_berries"
]);

export function getScore(player, objectiveId) {
    try {
        return world.scoreboard.getObjective(objectiveId)?.getScore(player) ?? 0;
    } catch { return 0; }
}

export function hasFullArmor(player, material) {
    const eq = player.getComponent("minecraft:equippable");
    const slots = ["Head", "Chest", "Legs", "Feet"];
    const suffixes = ["_helmet", "_chestplate", "_leggings", "_boots"];

    for (let i = 0; i < 4; i++) {
        const item = eq.getEquipment(slots[i]);
        if (!item || !item.typeId.endsWith(suffixes[i]) || !item.typeId.includes(material)) return false;
    }
    return true;
}

/**
 * インベントリ内の特定アイテムの総数を数える
 * @param {Player} player 
 * @param {string} typeId 
 * @returns {number}
 */
export function getInventoryItemCount(player, typeId) {
    const inventory = player.getComponent("inventory");
    if (!inventory || !inventory.container) return 0;

    let count = 0;
    const container = inventory.container;
    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item && item.typeId === typeId) {
            count += item.amount;
        }
    }
    return count;
}

/**
 * インベントリ内の音楽ディスクの種類数を数える
 * @param {Player} player 
 * @returns {number}
 */
export function countUniqueMusicDiscs(player) {
    const inventory = player.getComponent("inventory");
    if (!inventory || !inventory.container) return 0;

    const discs = new Set();
    const container = inventory.container;
    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item && item.typeId.startsWith("minecraft:music_disc_")) {
            discs.add(item.typeId);
        }
    }
    return discs.size;
}

export function hasTool(player) {
    const inv = player.getComponent("minecraft:inventory").container;
    for (let i = 0; i < inv.size; i++) {
        const item = inv.getItem(i);
        if (item) {
            const id = item.typeId;
            if ((id.includes("wooden_") || id.includes("stone_")) &&
                (id.includes("_sword") || id.includes("_pickaxe") || id.includes("_axe") || id.includes("_shovel") || id.includes("_hoe"))) {
                return true;
            }
        }
    }
    return false;
}