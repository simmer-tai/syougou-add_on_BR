import { world, system } from "@minecraft/server";
import { OBJECTIVES, FOOD_ITEMS, LOG_BLOCKS, playerPlacedLogLocations, UNDEAD_TYPES } from "./utils.js";
import "./titles.js";
import "./skills/mining.js";
import "./skills/farming.js";
import "./skills/forestry.js";
import "./skills/hunter.js";
import "./skills/husbandry.js";
import "./skills/excavation.js";
import "./skills/mastery.js";
import "./admin.js";
import "./levels_sidebar.js";
import { syncSkillLevelsToScoreboard } from "./skills/sync_score.js";


// Ore ID to specific objective mapping
const ORE_MAPPING = {
    "minecraft:coal_ore": "ore_coal",
    "minecraft:deepslate_coal_ore": "ore_coal",
    "minecraft:iron_ore": "ore_iron",
    "minecraft:deepslate_iron_ore": "ore_iron",
    "minecraft:copper_ore": "ore_copper",
    "minecraft:deepslate_copper_ore": "ore_copper",
    "minecraft:gold_ore": "ore_gold",
    "minecraft:deepslate_gold_ore": "ore_gold",
    "minecraft:redstone_ore": "ore_redstone",
    "minecraft:deepslate_redstone_ore": "ore_redstone",
    "minecraft:lit_redstone_ore": "ore_redstone",
    "minecraft:deepslate_lit_redstone_ore": "ore_redstone",
    "minecraft:lapis_ore": "ore_lapis",
    "minecraft:deepslate_lapis_ore": "ore_lapis",
    "minecraft:diamond_ore": "ore_diamond",
    "minecraft:deepslate_diamond_ore": "ore_diamond",
    "minecraft:emerald_ore": "ore_emerald",
    "minecraft:deepslate_emerald_ore": "ore_emerald",
    "minecraft:quartz_ore": "ore_quartz",
    "minecraft:nether_gold_ore": "ore_nether_gold",
    "minecraft:ancient_debris": "ore_debris"
};

const ORE_MAPPING_NOSILK = {
    "minecraft:gold_ore": OBJECTIVES.ORE_GOLD_NS,
    "minecraft:deepslate_gold_ore": OBJECTIVES.ORE_GOLD_NS,
    "minecraft:redstone_ore": OBJECTIVES.ORE_REDSTONE_NS,
    "minecraft:deepslate_redstone_ore": OBJECTIVES.ORE_REDSTONE_NS,
    "minecraft:lit_redstone_ore": OBJECTIVES.ORE_REDSTONE_NS,
    "minecraft:deepslate_lit_redstone_ore": OBJECTIVES.ORE_REDSTONE_NS,
    "minecraft:lapis_ore": OBJECTIVES.ORE_LAPIS_NS,
    "minecraft:deepslate_lapis_ore": OBJECTIVES.ORE_LAPIS_NS,
    "minecraft:diamond_ore": OBJECTIVES.ORE_DIAMOND_NS,
    "minecraft:deepslate_diamond_ore": OBJECTIVES.ORE_DIAMOND_NS
};

const DIRT_GRASS_BLOCKS = new Set([
    "minecraft:dirt", "minecraft:grass_block", "minecraft:dirt_with_roots",
    "minecraft:grass_path", "minecraft:farmland", "minecraft:podzol",
    "minecraft:mycelium", "minecraft:coarse_dirt", "minecraft:mud"
]);

const CROP_BLOCKS = new Set([
    "minecraft:wheat", "minecraft:carrots", "minecraft:potatoes",
    "minecraft:beetroot", "minecraft:nether_wart", "minecraft:cocoa",
    "minecraft:pumpkin", "minecraft:melon"
]);

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
    "minecraft:bamboo"
]);

const playerLastBlockLocation = new Map();
const playerPlacedCropLocations = new Set();
const playerHandBeforeInteract = new Map(); // 追加

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

function addScore(player, objectiveId, amount = 1) {
    if (!player || amount === 0) return;
    try {
        let objective = world.scoreboard.getObjective(objectiveId);
        if (!objective) {
            objective = world.scoreboard.addObjective(objectiveId, objectiveId);
        }
        objective.addScore(player, amount);
    } catch (e) {
        // Handle potential errors (e.g. scoreboard full)
    }
}

world.afterEvents.playerPlaceBlock.subscribe((event) => {
    addScore(event.player, OBJECTIVES.PLACED_BLOCKS);

    // プレイヤーが設置した原木の座標を記録
    if (LOG_BLOCKS.has(event.block.typeId)) {
        const loc = event.block.location;
        const locationString = `${loc.x},${loc.y},${loc.z}`;
        playerPlacedLogLocations.add(locationString);
    }

    // プレイヤーが設置したカボチャ・スイカの座標を記録
    if (event.block.typeId === "minecraft:pumpkin" || event.block.typeId === "minecraft:melon" || event.block.typeId === "minecraft:melon_block") {
        const loc = event.block.location;
        const locationString = `${loc.x},${loc.y},${loc.z}`;
        playerPlacedCropLocations.add(locationString);
    }

    // Patissier (Cake Place)
    if (event.block.typeId === "minecraft:cake") {
        addScore(event.player, OBJECTIVES.PLACED_CAKE);
    }
});

world.afterEvents.playerBreakBlock.subscribe((event) => {
    const { player, brokenBlockPermutation } = event;
    const typeId = brokenBlockPermutation.type.id;

    // 1. Total Blocks
    addScore(player, OBJECTIVES.TOTAL_BLOCKS);

    // 2. Dirt/Grass
    if (DIRT_GRASS_BLOCKS.has(typeId)) {
        addScore(player, OBJECTIVES.DIRT_GRASS);
    }

    // 3. Logs
    if (LOG_BLOCKS.has(typeId)) {
        addScore(player, OBJECTIVES.LOGS);
    }

    // 4 & 5. Ores
    if (typeId in ORE_MAPPING) {
        addScore(player, OBJECTIVES.ORES_TOTAL);
        addScore(player, ORE_MAPPING[typeId]);

        const item = event.itemStackBeforeBreak;
        const hasSilk = item && item.getComponent("minecraft:enchantments")?.enchantments?.has("silk_touch");
        if (!hasSilk && typeId in ORE_MAPPING_NOSILK) {
            addScore(player, ORE_MAPPING_NOSILK[typeId]);
        }
    }

    // 6. Crops
    if (CROP_BLOCKS.has(typeId)) {
        let isPlaced = false;
        // プレイヤー設置チェック (カボチャ・スイカ)
        if (typeId === "minecraft:pumpkin" || typeId === "minecraft:melon" || typeId === "minecraft:melon_block") {
            const loc = event.block.location;
            const key = `${loc.x},${loc.y},${loc.z}`;
            if (playerPlacedCropLocations.has(key)) {
                playerPlacedCropLocations.delete(key);
                isPlaced = true;
            }
        }

        if (!isPlaced) {
            addScore(player, OBJECTIVES.CROPS);
        }
    }

    // Shear Grass/Leaves
    const itemStack = event.itemStackBeforeBreak;
    if (itemStack && itemStack.typeId === "minecraft:shears") {
        if (typeId.includes("leaves") || typeId.includes("grass") || typeId.includes("fern") || typeId.includes("vine")) {
            addScore(player, OBJECTIVES.SHEAR_GRASS);
        }
    }
});

world.afterEvents.itemCompleteUse.subscribe((event) => {
    const { source, itemStack } = event;
    if (source.typeId === "minecraft:player" && FOOD_ITEMS.has(itemStack.typeId)) {
        const eatenStr = source.getDynamicProperty("eaten_foods") || "";
        const eaten = new Set(eatenStr.split(",").filter(s => s));
        if (!eaten.has(itemStack.typeId)) {
            eaten.add(itemStack.typeId);
            source.setDynamicProperty("eaten_foods", Array.from(eaten).join(","));
        }
    }

    // Cookie Monster
    if (source.typeId === "minecraft:player" && itemStack.typeId === "minecraft:cookie") {
        addScore(source, OBJECTIVES.COOKIES_EATEN);
    }
});

world.afterEvents.entityDie.subscribe((event) => {
    const { deadEntity, damageSource } = event;
    if (damageSource.damagingEntity && damageSource.damagingEntity.typeId === "minecraft:player") {
        const player = damageSource.damagingEntity;

        // 9. Total Mobs
        addScore(player, OBJECTIVES.MOBS_TOTAL);

        const family = deadEntity.getComponent("minecraft:type_family");
        if (family) {
            if (family.hasTypeFamily("monster")) addScore(player, OBJECTIVES.MONSTERS); // 8. Hostile
            else if (family.hasTypeFamily("animal") || family.hasTypeFamily("water_animal")) addScore(player, OBJECTIVES.ANIMALS); // 7. Animals
        }

        // New Kill Objectives
        const mainHand = damageSource.damagingEntity.getComponent("equippable")?.getEquipment("Mainhand");

        // 1. Zombie with Fist
        if (deadEntity.typeId === "minecraft:zombie" && (!mainHand || mainHand.typeId === "minecraft:air")) {
            addScore(player, OBJECTIVES.KILL_ZOMBIE_FIST);
        }

        // 2. Kill with Bow
        // Note: Projectile damage usually has damagingEntity as player, but we should check if cause is projectile
        // Simple check: if mainhand is bow/crossbow (might not be accurate if switched fast, but good enough)
        // Better: check damageSource.cause
        if (damageSource.cause === "projectile") {
            addScore(player, OBJECTIVES.KILL_BOW);
        }

        // 3. Creeper (Bomb Squad) - Check if it exploded? No, "defeat 50 creepers without them exploding".
        // If entityDie triggers, it means it died (was killed), not exploded (which removes entity).
        // So just counting creeper kills is sufficient for "defeat without exploding" logic wise,
        // because if it explodes, it doesn't trigger entityDie with player as killer?
        if (deadEntity.typeId === "minecraft:creeper") {
            addScore(player, OBJECTIVES.KILL_CREEPER);
        }

        // 4. Wither
        if (deadEntity.typeId === "minecraft:wither") {
            addScore(player, OBJECTIVES.KILL_WITHER);
        }

        // 5. Warden
        if (deadEntity.typeId === "minecraft:warden") {
            addScore(player, OBJECTIVES.KILL_WARDEN);
        }

        // 6. No Armor Kill
        const eq = player.getComponent("equippable");
        const head = eq.getEquipment("Head");
        const chest = eq.getEquipment("Chest");
        const legs = eq.getEquipment("Legs");
        const feet = eq.getEquipment("Feet");
        if (!head && !chest && !legs && !feet) {
            addScore(player, OBJECTIVES.KILL_NO_ARMOR);
        }

        // Assassin (Invisible Kill)
        const effects = player.getEffects();
        const invisible = effects.find(e => e.typeId === "minecraft:invisibility");
        if (invisible) {
            addScore(player, OBJECTIVES.INVISIBLE_KILL);
        }
    }

    if (deadEntity.typeId === "minecraft:player") {
        addScore(deadEntity, OBJECTIVES.DEATHS);
        deadEntity.setDynamicProperty("start_tick", world.getAbsoluteTime());

        // New Death Objectives
        if (damageSource.cause === "drowning") {
            addScore(deadEntity, OBJECTIVES.DEATH_DROWN);
        }
        if (damageSource.cause === "lava") {
            addScore(deadEntity, OBJECTIVES.DEATH_LAVA);

            // Summer Bug (Elytra + Lava)
            const eq = deadEntity.getComponent("equippable");
            const chest = eq.getEquipment("Chest");
            if (chest && chest.typeId === "minecraft:elytra") {
                deadEntity.addTag("temp_summer_bug"); // Mark for title check
            }
        }
        if (damageSource.cause === "fall") {
            addScore(deadEntity, OBJECTIVES.DEATH_FALL);
        }

        // Reset Indomitable Warrior
        deadEntity.setDynamicProperty("low_hp_start", undefined);
    }
});

// 10. Breeding
world.afterEvents.entitySpawn.subscribe((event) => {
    if (event.cause === "Breeding") {
        const baby = event.entity;
        // 生まれた子供の近くにいるプレイヤーを親として判定（簡易的判定）
        const players = baby.dimension.getPlayers({ location: baby.location, maxDistance: 10, closest: 1 });
        if (players.length > 0) {
            addScore(players[0], OBJECTIVES.BREEDING);
        }
    }
});

// 11. Trading (Requires Minecraft 1.21.0+)
world.afterEvents.playerTrade?.subscribe((event) => {
    addScore(event.player, OBJECTIVES.TRADING);
});

// 12. Taming (Attempts/Interactions)
world.afterEvents.playerInteractWithEntity.subscribe((event) => {
    const { player, target } = event;

    const beforeItem = playerHandBeforeInteract.get(player.id);
    
    // ラグ対策として 1ティック後に判定を行う
    system.run(() => {
        if (!player.isValid() || !target.isValid()) return;

        // 現在の状態を取得
        const inventory = player.getComponent("minecraft:inventory");
        if (!inventory) return;
        const container = inventory.container;
        const currentItem = beforeItem ? container.getItem(beforeItem.slot) : undefined;

        const itemTypeId = currentItem?.typeId;
        const itemAmount = currentItem?.amount ?? 0;
        
        // 消費判定
        let isConsumed = false;
        if (beforeItem) {
            isConsumed = itemAmount < beforeItem.amount || itemTypeId !== beforeItem.typeId;
        }

        const effectiveItemId = isConsumed ? (beforeItem?.typeId) : itemTypeId;

        // 手懐けアイテムを使用した場合の全般カウント
        if (isConsumed && effectiveItemId && TAMING_ITEMS.has(effectiveItemId)) {
            addScore(player, OBJECTIVES.TAMING);
        }

        // 特定のターゲットとアイテムの組み合わせ
        if (target) {
            const targetTypeId = target.typeId;

            // Horse (Riding Club) - 騎乗はアイテム消費を問わない
            if (targetTypeId === "minecraft:horse" || targetTypeId === "minecraft:donkey" || targetTypeId === "minecraft:mule") {
                addScore(player, OBJECTIVES.TAME_HORSE);
            }

            if (effectiveItemId) {
                // Dog Lover (Bone)
                if (isConsumed && targetTypeId === "minecraft:wolf" && effectiveItemId === "minecraft:bone") {
                    addScore(player, OBJECTIVES.TAME_WOLF_BONE);
                }
                // Cat Lover (Fish)
                if (isConsumed && (targetTypeId === "minecraft:cat" || targetTypeId === "minecraft:ocelot") &&
                    (effectiveItemId === "minecraft:cod" || effectiveItemId === "minecraft:salmon" || effectiveItemId === "minecraft:tropical_fish" || effectiveItemId === "minecraft:pufferfish")) {
                    addScore(player, OBJECTIVES.TAME_CAT_FISH);
                }
                // Bird Lover (Seeds)
                if (isConsumed && targetTypeId === "minecraft:parrot" && effectiveItemId.includes("seeds")) {
                    addScore(player, OBJECTIVES.TAME_PARROT_SEEDS);
                }

                // Blue Axolotl Catching
                if (targetTypeId === "minecraft:axolotl") {
                    const variant = target.getComponent("minecraft:variant")?.value;
                    if (variant === 4) {
                        if (effectiveItemId === "minecraft:water_bucket" || effectiveItemId === "minecraft:bucket") {
                            player.addTag("title_axolotl_chosen");
                            player.sendMessage("§b[称号条件達成]§f 青色のウーパールーパーを捕獲しました！");
                        }
                    }
                }
            }
        }

        // 13. Fishing (Rod Uses) - 釣り竿の使用 (消費チェックなし)
        const currentMainHand = player.getComponent("equippable")?.getEquipment("Mainhand");
        if (currentMainHand?.typeId === "minecraft:fishing_rod") {
            addScore(player, OBJECTIVES.FISHING);
        }
    });
});

// Composter
world.afterEvents.playerInteractWithBlock.subscribe((event) => {
    if (event.block.typeId === "minecraft:composter") {
        // アイテムを持っている場合のみカウント（簡易判定）
        if (event.itemStack && event.itemStack.amount > 0) {
            addScore(event.player, OBJECTIVES.COMPOSTER_FILL);
        }
    }
});

// Paladin (Smite V Undead Kill)
world.afterEvents.entityDie.subscribe((event) => {
    const victim = event.deadEntity;
    const attacker = event.damageSource.damagingEntity;

    if (attacker && attacker.typeId === "minecraft:player" && UNDEAD_TYPES.has(victim.typeId)) {
        const inv = attacker.getComponent("inventory")?.container;
        const item = inv?.getItem(attacker.selectedSlotIndex);
        if (item) {
            const enchantments = item.getComponent("enchantments")?.enchantments;
            if (enchantments && enchantments.has("smite")) {
                const level = enchantments.getEnchantment("smite").level;
                if (level >= 5) {
                    addScore(attacker, OBJECTIVES.KILL_UNDEAD_SMITE);
                }
            }
        }
    }
});

// The Fool (Punch Warden with Fist)
world.afterEvents.entityHitEntity.subscribe((event) => {
    const attacker = event.damagingEntity;
    const victim = event.hitEntity;

    if (attacker.typeId === "minecraft:player" && victim.typeId === "minecraft:warden") {
        const inv = attacker.getComponent("inventory")?.container;
        const item = inv?.getItem(attacker.selectedSlotIndex);
        if (!item) { // Empty hand
            attacker.addTag("title_fool");
        }
    }
});

// Musician (Goat Horn Use)
world.afterEvents.itemUse.subscribe((event) => {
    if (event.itemStack.typeId === "minecraft:goat_horn") {
        event.source.addTag("title_musician");
    }
    // Existing Menu Logic
    if (event.itemStack.typeId === "syougou:menu_book") {
        // already handled in titles.js but main.js has logic too? 
        // titles.js handles menu opening. main.js shouldn't conflict.
    }
});

// Contradiction (Burning in Powder Snow)
world.afterEvents.entityHurt.subscribe((event) => {
    const entity = event.hurtEntity;
    if (entity.typeId === "minecraft:player") {
        const cause = event.damageSource.cause;
        if (cause === "fire" || cause === "fireTick" || cause === "lava") {
            const block = entity.dimension.getBlock(entity.location);
            if (block && block.typeId === "minecraft:powder_snow") {
                entity.addTag("title_contradiction");
            }
        }
    }
});


world.afterEvents.playerLeave.subscribe(event => {
    playerLastBlockLocation.delete(event.playerId);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const currentLoc = player.location;
        const lastLoc = playerLastBlockLocation.get(player.id);

        if (lastLoc) {
            const currentBlock = {
                x: Math.floor(currentLoc.x),
                y: Math.floor(currentLoc.y),
                z: Math.floor(currentLoc.z)
            };
            const lastBlock = {
                x: Math.floor(lastLoc.x),
                y: Math.floor(lastLoc.y),
                z: Math.floor(lastLoc.z)
            };

            if (currentBlock.x !== lastBlock.x || currentBlock.y !== lastBlock.y || currentBlock.z !== lastBlock.z) {
                const distance = Math.abs(currentBlock.x - lastBlock.x) + Math.abs(currentBlock.y - lastBlock.y) + Math.abs(currentBlock.z - lastBlock.z);

                if (distance > 0) {
                    // 総移動距離
                    addScore(player, OBJECTIVES.MOVED_BLOCKS, distance);

                    // X, Z Individual Tracking
                    const distX = Math.abs(currentBlock.x - lastBlock.x);
                    const distZ = Math.abs(currentBlock.z - lastBlock.z);
                    if (distX > 0) addScore(player, OBJECTIVES.MOVED_X, distX);
                    if (distZ > 0) addScore(player, OBJECTIVES.MOVED_Z, distZ);

                    // 水中での移動距離
                    if (player.isInWater) {
                        addScore(player, OBJECTIVES.MOVED_IN_WATER, distance);
                    }
                }
            }
        }
        playerLastBlockLocation.set(player.id, currentLoc);

        if (player.getDynamicProperty("start_tick") === undefined) {
            player.setDynamicProperty("start_tick", world.getAbsoluteTime());
        }

        // 1M Coords
        if (Math.abs(currentLoc.x) >= 1000000 || Math.abs(currentLoc.z) >= 1000000) {
            addScore(player, OBJECTIVES.COORD_1M);
        }

        // Nether Visit
        if (player.dimension.id === "minecraft:nether") {
            addScore(player, OBJECTIVES.VISIT_NETHER);
        }

        // Sky High (Elytra Flight)
        if (player.isGliding) {
            // Distance already calc'd above (moved_blocks)? No, that's total. 
            // Need check if gliding this tick.
            // Re-calculate distance for this specific purpose if moved
            const lastLoc = playerLastBlockLocation.get(player.id);
            if (lastLoc) {
                const dist = Math.abs(currentLoc.x - lastLoc.x) + Math.abs(currentLoc.y - lastLoc.y) + Math.abs(currentLoc.z - lastLoc.z);
                if (dist > 0) addScore(player, OBJECTIVES.ELYTRA_FLY, dist);
            }
        }

        // Indomitable Warrior (Low HP < 50% for 20 mins)
        // 20 mins = 20 * 60 * 20 ticks = 24000 ticks
        const health = player.getComponent("minecraft:health");
        if (health && health.currentValue > 0) {
            const max = health.effectiveMax;
            const current = health.currentValue;
            if (current <= max / 2) {
                // Low HP
                let start = player.getDynamicProperty("low_hp_start");
                if (start === undefined) {
                    player.setDynamicProperty("low_hp_start", world.getAbsoluteTime());
                }
            } else {
                // Healed
                player.setDynamicProperty("low_hp_start", undefined);
            }
        } else {
            // Dead or error
            player.setDynamicProperty("low_hp_start", undefined);
        }
    }
}, 1);

// スコアボード同期 (UI表示用, 20 tick = 1秒毎)
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        syncSkillLevelsToScoreboard(player);
    }
}, 20);

