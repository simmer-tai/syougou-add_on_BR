import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { OBJECTIVES, FOOD_ITEMS, FLOWER_ITEMS, DEBUFF_IDS, CORAL_ITEMS, getScore, hasTool, hasFullArmor, getInventoryItemCount, countUniqueMusicDiscs } from "./utils.js";
import { syncSkillLevelsToScoreboard } from "./skills/sync_score.js";
import { addMasteryXp } from "./skills/mastery.js";

const RARITY_COLORS = {
    leather: "§n", // Brown
    iron: "§f",   // White
    gold: "§e",   // Yellow
    diamond: "§b", // Aqua
    legend: "§6", // Orange (Gold)
    crafter: "§c" // Bright Red
};

const RARITY_NAMES = {
    leather: "レザー",
    iron: "アイアン",
    gold: "ゴールド",
    diamond: "ダイヤモンド",
    legend: "レジェンド",
    crafter: "クラフター"
};

const TRACKERS = [
    { id: "none", name: "なし", getValue: (p) => null },
    { id: "total_blocks", name: "総ブロック破壊数", getValue: (p) => `総破壊数: ${getScore(p, OBJECTIVES.TOTAL_BLOCKS)}` },
    { id: "moved_xz", name: "移動ブロック数（X,Z）", getValue: (p) => `移動: X:${getScore(p, OBJECTIVES.MOVED_X)} Z:${getScore(p, OBJECTIVES.MOVED_Z)}` },
    { id: "mobs_total", name: "総モブ殺害数", getValue: (p) => `総撃破数: ${getScore(p, OBJECTIVES.MOBS_TOTAL)}` },
    { id: "crops", name: "作物収穫回数", getValue: (p) => `作物収穫数: ${getScore(p, OBJECTIVES.CROPS)}` },
    { id: "ore_diamond", name: "ダイアモンド鉱石破壊数", getValue: (p) => `ダイヤ採掘数: ${getScore(p, OBJECTIVES.ORE_DIAMOND) + getScore(p, OBJECTIVES.ORE_DIAMOND_NS)}` },
    {
        id: "all_skills",
        name: "各スキルのレベル",
        getValue: (p) => {
            const m = p.getDynamicProperty("skill_lv_mining") ?? 1;
            const f = p.getDynamicProperty("skill_lv_farming") ?? 1;
            const fo = p.getDynamicProperty("skill_lv_forestry") ?? 1;
            const h = p.getDynamicProperty("skill_lv_hunter") ?? 1;
            const hu = p.getDynamicProperty("skill_lv_husbandry") ?? 1;
            const e = p.getDynamicProperty("skill_lv_excavation") ?? 1;
            return `\uE300${m} \uE301${f} \uE302${fo} \uE304${h} \uE305${hu} \uE306${e}`;
        }
    }
];

const TITLES = [
    // Leather
    { id: "lumberjack", name: "木こり", rarity: "leather", condition: "原木を64個破壊", check: (p) => getScore(p, OBJECTIVES.LOGS) >= 64 },
    { id: "novice_crafter", name: "駆け出しクラフター", rarity: "leather", condition: "木または石のツールを入手", check: (p) => hasTool(p) },
    { id: "miner_beginner", name: "初心マイナー", rarity: "leather", condition: "採掘スキルLv5到達", check: (p) => (p.getDynamicProperty("skill_lv_mining") ?? 1) >= 5 },
    { id: "farmer_beginner", name: "初心ファーマー", rarity: "leather", condition: "農業スキルLv5到達", check: (p) => (p.getDynamicProperty("skill_lv_farming") ?? 1) >= 5 },
    { id: "winter_protection", name: "防寒", rarity: "leather", condition: "革装備一式を装備", check: (p) => hasFullArmor(p, "leather") },

    { id: "clumsy", name: "へたくそ", rarity: "leather", condition: "10回死亡", check: (p) => getScore(p, OBJECTIVES.DEATHS) >= 10 },
    { id: "zombie", name: "ゾンビ", rarity: "leather", condition: "25回死亡", check: (p) => getScore(p, OBJECTIVES.DEATHS) > 25 },
    { id: "kanazuchi", name: "カナヅチ", rarity: "leather", condition: "溺死する", check: (p) => getScore(p, OBJECTIVES.DEATH_DROWN) >= 1 },
    { id: "lava_swimmer", name: "溶岩水泳部", rarity: "leather", condition: "溶岩で死亡する", check: (p) => getScore(p, OBJECTIVES.DEATH_LAVA) >= 1 },
    { id: "skydiver", name: "スカイダイバー", rarity: "leather", condition: "落下死を10回する", check: (p) => getScore(p, OBJECTIVES.DEATH_FALL) >= 10 },
    { id: "brawler", name: "喧嘩屋", rarity: "leather", condition: "素手でゾンビを倒す", check: (p) => getScore(p, OBJECTIVES.KILL_ZOMBIE_FIST) >= 1 },

    // Iron
    { id: "iron_defense", name: "鉄壁の防御", rarity: "iron", condition: "鉄装備一式を装備", check: (p) => hasFullArmor(p, "iron") },
    { id: "miner_intermediate", name: "中級マイナー", rarity: "iron", condition: "採掘スキルLv15到達", check: (p) => (p.getDynamicProperty("skill_lv_mining") ?? 1) >= 15 },
    { id: "farmer_intermediate", name: "中級ファーマー", rarity: "iron", condition: "農業スキルLv15到達", check: (p) => (p.getDynamicProperty("skill_lv_farming") ?? 1) >= 15 },
    { id: "iron_heart", name: "鉄の心", rarity: "iron", condition: "鉄鉱石を64個採掘", check: (p) => getScore(p, OBJECTIVES.ORE_IRON) >= 64 },
    { id: "nether_visitor", name: "ネザーの訪問者", rarity: "iron", condition: "ネザーに行く", check: (p) => getScore(p, OBJECTIVES.VISIT_NETHER) >= 1 },
    { id: "riding_club", name: "乗馬クラブ", rarity: "iron", condition: "馬（ロバ・ラバ）を手懐ける（乗る）", check: (p) => getScore(p, OBJECTIVES.TAME_HORSE) >= 1 },
    { id: "gardener", name: "庭師", rarity: "iron", condition: "ハサミで葉/草を300個刈る", check: (p) => getScore(p, OBJECTIVES.SHEAR_GRASS) >= 300 },
    { id: "patissier", name: "パティシエ", rarity: "iron", condition: "ケーキを設置する", check: (p) => getScore(p, OBJECTIVES.PLACED_CAKE) >= 1 },
    { id: "cookie_monster", name: "クッキーモンスター", rarity: "iron", condition: "クッキーを累計1スタック(64個)食べる", check: (p) => getScore(p, OBJECTIVES.COOKIES_EATEN) >= 64 },


    // Gold
    { id: "miner_advanced", name: "上級マイナー", rarity: "gold", condition: "採掘スキルLv30到達", check: (p) => (p.getDynamicProperty("skill_lv_mining") ?? 1) >= 30 },
    { id: "farmer_advanced", name: "上級ファーマー", rarity: "gold", condition: "農業スキルLv30到達", check: (p) => (p.getDynamicProperty("skill_lv_farming") ?? 1) >= 30 },
    { id: "driller", name: "ドリラー", rarity: "gold", condition: "ブロックを2,500個破壊", check: (p) => getScore(p, OBJECTIVES.TOTAL_BLOCKS) >= 2500 },
    { id: "sniper", name: "スナイパー", rarity: "gold", condition: "弓/クロスボウでモブを100体討伐", check: (p) => getScore(p, OBJECTIVES.KILL_BOW) >= 100 },
    { id: "bomb_squad", name: "爆弾処理班", rarity: "gold", condition: "クリーパーを50体討伐（自爆させずに）", check: (p) => getScore(p, OBJECTIVES.KILL_CREEPER) >= 50 },
    { id: "bird_lover", name: "愛鳥家", rarity: "gold", condition: "インコを50回手懐けようとする（種をあげる）", check: (p) => getScore(p, OBJECTIVES.TAME_PARROT_SEEDS) >= 50 },
    { id: "dog_lover", name: "愛犬家", rarity: "gold", condition: "狼を50回手懐けようとする（骨をあげる）", check: (p) => getScore(p, OBJECTIVES.TAME_WOLF_BONE) >= 50 },
    { id: "cat_lover", name: "愛猫家", rarity: "gold", condition: "猫を50回手懐けようとする（魚をあげる）", check: (p) => getScore(p, OBJECTIVES.TAME_CAT_FISH) >= 50 },
    { id: "rich", name: "リッチ", rarity: "gold", condition: "防具全部位にダイヤ装備を装着", check: (p) => hasFullArmor(p, "diamond") },
    { id: "industrial_waste", name: "産業廃棄物", rarity: "gold", condition: "毒入りジャガイモを64個所持", check: (p) => getInventoryItemCount(p, "minecraft:poisonous_potato") >= 64 },
    { id: "nokonoko", name: "ノコノコ", rarity: "gold", condition: "カメの甲羅（ヘルメット）を装備", check: (p) => p.getComponent("equipment_inventory")?.getEquipment(0)?.typeId === "minecraft:turtle_helmet" },
    { id: "shiny_gold", name: "金ピカ", rarity: "gold", condition: "金装備を一式装備する", check: (p) => hasFullArmor(p, "golden") },
    { id: "assassin", name: "アサシン", rarity: "gold", condition: "透明化のポーションを使用した状態で敵を倒す", check: (p) => getScore(p, OBJECTIVES.INVISIBLE_KILL) >= 1 },
    {
        id: "florist", name: "花屋さん", rarity: "gold", condition: "花を全種類インベントリに入れる", check: (p) => {
            const inv = p.getComponent("inventory")?.container;
            if (!inv) return false;
            const found = new Set();
            for (let i = 0; i < inv.size; i++) {
                const item = inv.getItem(i);
                if (item && FLOWER_ITEMS.has(item.typeId)) found.add(item.typeId);
            }
            return found.size >= FLOWER_ITEMS.size;
        }
    },

    // Diamond
    {
        id: "treasure_sensor", name: "お宝センサー", rarity: "diamond", condition: "金・ダイヤ・レッド・ラピスを各64個採掘（シルクタッチ不可）", check: (p) =>
            getScore(p, OBJECTIVES.ORE_GOLD_NS) >= 64 &&
            getScore(p, OBJECTIVES.ORE_DIAMOND_NS) >= 64 &&
            getScore(p, OBJECTIVES.ORE_REDSTONE_NS) >= 64 &&
            getScore(p, OBJECTIVES.ORE_LAPIS_NS) >= 64
    },
    { id: "miner_skilled", name: "熟練マイナー", rarity: "diamond", condition: "採掘スキルLv50到達", check: (p) => (p.getDynamicProperty("skill_lv_mining") ?? 1) >= 50 },
    { id: "farmer_skilled", name: "熟練ファーマー", rarity: "diamond", condition: "農業スキルLv50到達", check: (p) => (p.getDynamicProperty("skill_lv_farming") ?? 1) >= 50 },
    { id: "master_builder", name: "建築の達人", rarity: "diamond", condition: "ブロックを5,000個設置", check: (p) => getScore(p, OBJECTIVES.PLACED_BLOCKS) >= 5000 },
    { id: "traveler", name: "旅人", rarity: "diamond", condition: "50,000ブロック移動", check: (p) => getScore(p, OBJECTIVES.MOVED_BLOCKS) >= 50000 },

    { id: "lots_diamonds", name: "ザクザクダイヤ", rarity: "diamond", condition: "ダイヤモンド鉱石を3スタック採掘（シルクタッチ不可）", check: (p) => getScore(p, OBJECTIVES.ORE_DIAMOND_NS) >= 192 },
    { id: "summer_bug", name: "飛んで火に入る夏の虫", rarity: "diamond", condition: "エリトラを装着したまま溶岩で死亡", check: (p) => p.hasTag("temp_summer_bug") },
    {
        id: "indomitable_warrior", name: "不屈の戦士", rarity: "diamond", condition: "HP半分以下の状態で20分生き残る", check: (p) => {
            const start = p.getDynamicProperty("low_hp_start");
            if (start === undefined) return false;
            // 20 minutes = 24000 ticks
            return (world.getAbsoluteTime() - start) >= 24000;
        }
    },

    { id: "composter", name: "コンポスター", rarity: "diamond", condition: "コンポスターにアイテムを1000回入れる", check: (p) => getScore(p, OBJECTIVES.COMPOSTER_FILL) >= 1000 },
    { id: "wither_buster", name: "ウィザーバスター", rarity: "diamond", condition: "ウィザーを討伐", check: (p) => getScore(p, OBJECTIVES.KILL_WITHER) >= 1 },
    { id: "millionaire", name: "大富豪", rarity: "diamond", condition: "エメラルドブロックを64個所持", check: (p) => getInventoryItemCount(p, "minecraft:emerald_block") >= 64 },

    // Legend
    { id: "hard_beetle", name: "カチカチのカブトムシ", rarity: "legend", condition: "ネザライト装備一式を装備", check: (p) => hasFullArmor(p, "netherite") },
    { id: "destroyer", name: "破壊者", rarity: "legend", condition: "ブロックを50,000個破壊", check: (p) => getScore(p, OBJECTIVES.TOTAL_BLOCKS) >= 50000 },
    { id: "miner_master", name: "達人マイナー", rarity: "legend", condition: "採掘スキルLv70到達", check: (p) => (p.getDynamicProperty("skill_lv_mining") ?? 1) >= 70 },
    { id: "farmer_master", name: "達人ファーマー", rarity: "legend", condition: "農業スキルLv70到達", check: (p) => (p.getDynamicProperty("skill_lv_farming") ?? 1) >= 70 },
    {
        id: "survivor_100", name: "サバイバー100", rarity: "legend", condition: "100日間死なずに生存", check: (p) => {
            const startTick = p.getDynamicProperty("start_tick") ?? world.getAbsoluteTime();
            const days = (world.getAbsoluteTime() - startTick) / 24000;
            return days >= 100;
        }
    },
    { id: "seasoned_veteran", name: "百戦錬磨", rarity: "legend", condition: "防具を一度も着けずに敵を500体討伐", check: (p) => getScore(p, OBJECTIVES.KILL_NO_ARMOR) >= 500 },
    { id: "abyss_watcher", name: "深淵の監視者", rarity: "legend", condition: "ウォーデンを討伐", check: (p) => getScore(p, OBJECTIVES.KILL_WARDEN) >= 1 },
    {
        id: "golden_tongue", name: "黄金の舌", rarity: "legend", condition: "全種類の食べ物を食べる", check: (p) => {
            const eaten = (p.getDynamicProperty("eaten_foods") || "").split(",").filter(s => s);
            return eaten.length >= FOOD_ITEMS.size;
        }
    },
    { id: "musician", name: "音楽家", rarity: "legend", condition: "レコードを10種類以上所持", check: (p) => countUniqueMusicDiscs(p) >= 10 },

    // Crafter
    { id: "adventurer", name: "冒険家", rarity: "crafter", condition: "10,000,000ブロック移動", check: (p) => getScore(p, OBJECTIVES.MOVED_BLOCKS) >= 10000000 },
    { id: "miner_extreme", name: "極地マイナー", rarity: "crafter", condition: "採掘スキルLv100到達", check: (p) => (p.getDynamicProperty("skill_lv_mining") ?? 1) >= 100 },
    { id: "farmer_extreme", name: "極地ファーマー", rarity: "crafter", condition: "農業スキルLv100到達", check: (p) => (p.getDynamicProperty("skill_lv_farming") ?? 1) >= 100 },
    { id: "abyss_ruler", name: "深淵の覇者", rarity: "crafter", condition: "ウォーデンを10体討伐", check: (p) => getScore(p, OBJECTIVES.KILL_WARDEN) >= 10 },
    { id: "wither_storm", name: "ウィザーストーム", rarity: "crafter", condition: "ウィザーを50体討伐", check: (p) => getScore(p, OBJECTIVES.KILL_WITHER) >= 50 },
    { id: "silent_guardian", name: "静寂の守り人", rarity: "crafter", condition: "モブ討伐総数 100,000体", check: (p) => getScore(p, OBJECTIVES.MOBS_TOTAL) >= 100000 }, // Assuming MOBS_TOTAL is generic kills? Original code: 8. Hostile -> MONSTERS, 7. Animals -> ANIMALS. 9. Total -> MOBS_TOTAL. Yes.
    { id: "end_visitor", name: "世界の果ての訪問者", rarity: "crafter", condition: "座標XまたはZが1,000,000 (100万) に到達", check: (p) => getScore(p, OBJECTIVES.COORD_1M) >= 1 },
    { id: "sky_high", name: "スカイハイ", rarity: "crafter", condition: "エリトラでの飛行距離 1,000,000ブロック移動", check: (p) => getScore(p, OBJECTIVES.ELYTRA_FLY) >= 1000000 },
    { id: "axolotl_chosen", name: "ウーパールーパーに選ばれし者", rarity: "crafter", condition: "青色のウーパールーパーをバケツに入れる", check: (p) => p.hasTag("title_axolotl_chosen") },

    // Requested New Titles (Batch 2)
    // Iron
    { id: "the_sun", name: "太陽", rarity: "iron", condition: "松明を９スタック(576個)所有", check: (p) => getInventoryItemCount(p, "minecraft:torch") >= 576 },
    { id: "musician", name: "奏者", rarity: "iron", condition: "ヤギの角を吹く", check: (p) => p.hasTag("title_musician") },
    { id: "happy_halloween", name: "ハッピーハロウィン", rarity: "iron", condition: "ジャック・オ・ランタンを所有する", check: (p) => getInventoryItemCount(p, "minecraft:lit_pumpkin") >= 1 },

    // Gold
    { id: "sho_chiku_bai", name: "松竹梅", rarity: "gold", condition: "トウヒの苗木、竹、桜の苗木を所有する", check: (p) => getInventoryItemCount(p, "minecraft:spruce_sapling") > 0 && getInventoryItemCount(p, "minecraft:bamboo") > 0 && getInventoryItemCount(p, "minecraft:cherry_sapling") > 0 },
    {
        id: "plague", name: "疫病", rarity: "gold", condition: "一度に3種類以上のデバフにかかる", check: (p) => {
            const effects = p.getEffects();
            let debuffCount = 0;
            for (const e of effects) {
                if (DEBUFF_IDS.has(e.typeId)) debuffCount++;
            }
            return debuffCount >= 3;
        }
    },
    { id: "the_fool", name: "愚者", rarity: "gold", condition: "素手でウォーデンを攻撃する", check: (p) => p.hasTag("title_fool") },
    { id: "contradiction", name: "矛盾", rarity: "gold", condition: "火がついた状態で、粉雪の中に入る", check: (p) => p.hasTag("title_contradiction") },
    {
        id: "mermaid", name: "マーメイド", rarity: "gold", condition: "生きているサンゴを全種類所有（ブロックは除く）", check: (p) => {
            const inv = p.getComponent("inventory")?.container;
            if (!inv) return false;
            const found = new Set();
            for (let i = 0; i < inv.size; i++) {
                const item = inv.getItem(i);
                if (item && CORAL_ITEMS.has(item.typeId)) found.add(item.typeId);
            }
            return found.size >= CORAL_ITEMS.size;
        }
    },

    // Diamond
    {
        id: "fashionista", name: "ファッショニスター", rarity: "diamond", condition: "鍛冶型で装飾された防具を4部位すべて装備する", check: (p) => {
            const eq = p.getComponent("equippable");
            if (!eq) return false;
            const slots = ["Head", "Chest", "Legs", "Feet"];
            for (const s of slots) {
                const item = eq.getEquipment(s);
                if (!item) return false;
                // Check for trim component. API might be "minecraft:trim".
                // If API doesn't support direct component check easily, assume fail or check for lore? 
                // For now, try getComponent. If unsupported, this title won't work, but prevents crash if handled safely below.
                // Note: In 1.20.10+ Script API, item.getComponent("minecraft:trim") may not exist yet or be different.
                // Assuming simplified check or placeholder if specific API is missing.
                // Let's rely on standard getComponent returning undefined if missing.
                if (!item.getComponent("minecraft:trim")) return false;
            }
            return true;
        }
    },
    { id: "paladin", name: "聖騎士", rarity: "diamond", condition: "エンチャント「アンデッド特効Ⅴ」が付いた剣で、アンデッドを500体討伐", check: (p) => getScore(p, OBJECTIVES.KILL_UNDEAD_SMITE) >= 500 }
];

system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "syougou:open") {
        const player = event.sourceEntity;
        if (!player) return;

        showMainMenu(player);
    }
    else if (event.id === "syougou:reset") {
        const player = event.sourceEntity;
        if (!player) return;

        // 1. 獲得済み称号のリセット
        player.setDynamicProperty("unlocked_titles", undefined);

        // 2. 進行度データ(DynamicProperty)のリセット
        player.setDynamicProperty("eaten_foods", undefined);
        player.setDynamicProperty("start_tick", world.getAbsoluteTime());

        // 3. スコアボードのリセット
        Object.values(OBJECTIVES).forEach(objectiveId => {
            try {
                const objective = world.scoreboard.getObjective(objectiveId);
                if (objective) {
                    objective.removeParticipant(player);
                }
            } catch (e) { }
        });

        // 4. ネームタグのリセット
        player.nameTag = player.name;
        player.setDynamicProperty("active_title", undefined);
        player.setDynamicProperty("selected_tracker", undefined);

        player.sendMessage("§e[称号システム]§f 称号と進行状況をリセットしました。");
        player.playSound("random.orb");
    }
});

function showMainMenu(player) {
    const unlockedStr = player.getDynamicProperty("unlocked_titles");
    const unlockedIds = new Set(unlockedStr ? unlockedStr.split(",") : []);

    const titlesByRarity = {};
    const rarityOrder = ["leather", "iron", "gold", "diamond", "legend", "crafter"];
    rarityOrder.forEach(r => titlesByRarity[r] = []);

    TITLES.forEach(t => {
        if (unlockedIds.has(t.id)) {
            titlesByRarity[t.rarity].push(t);
        }
    });

    const form = new ActionFormData()
        .title("称号メニュー")
        .body("カテゴリを選択してください")
        .button("称号を変更") // Button 0
        .button("トラッカーを変更") // Button 1
        .button("称号一覧") // Button 2
        .button("統計データ確認") // Button 3
        .button("現在のバフを確認"); // Button 4

    form.show(player).then(response => {
        if (response.canceled) return;

        switch (response.selection) {
            case 0: // 称号を変更
                showTitleSelectionMenu(player);
                break;
            case 1: // トラッカーを変更
                showTrackerMenu(player);
                break;
            case 2: // 称号一覧
                showTitleList(player);
                break;
            case 3: // 統計データ確認
                showStatsMenu(player);
                break;
            case 4: // 現在のバフを確認
                showBuffsMenu(player);
                break;
        }
    });
}

function showBuffsMenu(player) {
    const lvMining = player.getDynamicProperty("skill_lv_mining") ?? 1;
    const lvFarming = player.getDynamicProperty("skill_lv_farming") ?? 1;
    const lvForestry = player.getDynamicProperty("skill_lv_forestry") ?? 1;
    const lvHunter = player.getDynamicProperty("skill_lv_hunter") ?? 1;
    const lvExcavation = player.getDynamicProperty("skill_lv_excavation") ?? 1;
    const lvHusbandry = player.getDynamicProperty("skill_lv_husbandry") ?? 1;

    let text = "§l§e=== 現在のスキルボーナス ===§r\n\n";

    // 1. 採掘 (Mining)
    text += "§b[採掘]§r\n";
    text += `§7- 基底成功率: §f${(lvMining * 0.1).toFixed(1)}% / 回\n`;
    text += `§7- 試行回数: §f${1 + Math.floor(lvMining / 10)}回\n`;
    text += `§7- 合計期待値: §f+${((1 + Math.floor(lvMining / 10)) * (lvMining * 0.1)).toFixed(1)}%\n`;

    // 2. 農業 (Farming)
    text += "\n§a[農業]§r\n";
    text += `§7- 追加ドロップ発生率: §f+${(lvFarming * 0.1).toFixed(1)}%\n`;
    text += `§7- 最大ボーナス個数: §f${1 + Math.floor(lvFarming * 0.1)}個\n`;

    // 3. 林業 (Forestry)
    text += "\n§2[林業]§r\n";
    text += `§7- 追加原木ドロップ率: §f+${(lvForestry * 0.5).toFixed(1)}%\n`;

    // 4. 狩人 (Hunter)
    text += "\n§c[狩人]§r\n";
    text += `§7- ダブル経験値発生率: §f+${(lvHunter * 0.3).toFixed(1)}%\n`;
    text += `§7- 追加戦利品入手率: §f+${(lvHunter * 0.3).toFixed(1)}%\n`;

    // 5. 整地 (Excavation)
    text += "\n§e[整地]§r\n";
    text += `§7- 採掘速度上昇I: ${lvExcavation >= 15 ? "§a常時有効" : "§c無効 (Lv.15が必要)"}\n`;

    // 6. 畜産 (Husbandry)
    text += "\n§d[畜産]§r\n";
    text += `§7- 毛刈り追加ドロップ: §f+${(lvHusbandry * 0.3).toFixed(1)}%\n`;
    let husbandrySave = (lvHusbandry * 0.5);
    if (husbandrySave > 50) husbandrySave = 50;
    text += `§7- 餌の消費抑制(最大50%): §f${husbandrySave.toFixed(1)}%\n`;
    text += `§7- 家畜の再生オーラ: ${lvHusbandry >= 25 ? "§a有効 (半径10m)" : "§c無効 (Lv.25が必要)"}\n`;


    const form = new ActionFormData()
        .title("現在のバフ一覧")
        .body(text)
        .button("戻る");

    form.show(player).then(response => {
        if (response.selection === 0) showMainMenu(player);
    });
}

function showTitleSelectionMenu(player) {
    // Shows rarity categories to drill down to select title
    const activeRarities = ["leather", "iron", "gold", "diamond", "legend", "crafter"];
    const form = new ActionFormData()
        .title("称号を変更")
        .body("称号のレアリティを選択してください。\n称号を外す場合は「称号を外す」を選択してください。")
        .button("称号を外す");

    const iconPaths = {
        leather: "textures/items/leather",
        iron: "textures/items/iron_ingot",
        gold: "textures/items/gold_ingot",
        diamond: "textures/items/diamond",
        legend: "textures/items/nether_star",
        crafter: "textures/blocks/grass_side_carried"
    };

    const unlockedStr = player.getDynamicProperty("unlocked_titles");
    const unlockedIds = new Set(unlockedStr ? unlockedStr.split(",") : []);

    activeRarities.forEach(r => {
        const count = TITLES.filter(t => t.rarity === r && unlockedIds.has(t.id)).length;
        if (count > 0) {
            form.button(`§l${RARITY_NAMES[r]}§r (${count})`, iconPaths[r]);
        } else {
            // Include button but maybe disabled or just don't show? 
            // Better to only show categories with unlocked titles.
            // But if we want consistent UI, maybe show regardless? 
            // "Existing logic only showed active".
            // Let's stick to showing only active categories to keep it clean.
        }
    });

    // Re-calculating active rarities for mapping response index
    const visibleRarities = activeRarities.filter(r => TITLES.filter(t => t.rarity === r && unlockedIds.has(t.id)).length > 0);

    form.show(player).then(res => {
        if (res.canceled) return;
        if (res.selection === 0) {
            player.nameTag = player.name;
            player.sendMessage("§e称号を外しました。");
            return;
        }

        // selection 1 is first visible rarity
        const typeIndex = res.selection - 1;
        if (typeIndex >= 0 && typeIndex < visibleRarities.length) {
            const r = visibleRarities[typeIndex];
            // Filter titles by rarity AND unlocked status
            const titles = TITLES.filter(t => t.rarity === r && unlockedIds.has(t.id));
            showSubMenu(player, r, titles);
        }
    });
}

function showTrackerMenu(player) {
    const form = new ActionFormData()
        .title("トラッカーを変更")
        .body("ネームタグに表示する情報を選択してください。");

    TRACKERS.forEach(t => {
        form.button(t.name);
    });

    form.show(player).then(res => {
        if (res.canceled) return;
        const tracker = TRACKERS[res.selection];
        player.setDynamicProperty("selected_tracker", tracker.id);
        player.sendMessage(`§aトラッカーを「${tracker.name}」に変更しました。`);
        // Immediate update will happen in the next tick loop
    });
}

function showSubMenu(player, rarity, titles) {
    const color = RARITY_COLORS[rarity];
    const name = RARITY_NAMES[rarity];
    const form = new ActionFormData()
        .title(`${color}${name}§r 称号一覧`)
        .body("装着する称号を選択してください")
        .button("戻る");

    titles.forEach(t => {
        form.button(`${color}${t.name}`);
    });

    form.show(player).then(response => {
        if (response.canceled) return;
        if (response.selection === 0) {
            showTitleSelectionMenu(player); // Go back to rarity selection, not main menu
        } else {
            const title = titles[response.selection - 1];
            // Don't set nameTag directly here, save the selected title instead?
            // Actually, existing system saves state in nameTag? No, that's bad practice if logic depends on it.
            // But looking at code, it just sets `player.nameTag = ...`.
            // We should save the selected Title ID to DynamicProperty so the loop can reconstruct it with Tracker.

            player.setDynamicProperty("active_title", title.id);
            player.sendMessage(`§a称号「${RARITY_COLORS[title.rarity]}${title.name}§r§a」を装着しました。`);
        }
    });
}

function showStatsMenu(player) {
    // 食べた種類の計算
    const eatenStr = player.getDynamicProperty("eaten_foods") || "";
    const eatenCount = eatenStr.split(",").filter(s => s).length;

    // 生存日数の計算
    const startTick = player.getDynamicProperty("start_tick") ?? world.getAbsoluteTime();
    const days = Math.floor((world.getAbsoluteTime() - startTick) / 24000);

    const stats = [
        { label: "総ブロック破壊数", value: getScore(player, OBJECTIVES.TOTAL_BLOCKS) },
        { label: "総ブロック設置数", value: getScore(player, OBJECTIVES.PLACED_BLOCKS) },
        { label: "原木破壊数", value: getScore(player, OBJECTIVES.LOGS) },
        { label: "動物討伐数", value: getScore(player, OBJECTIVES.ANIMALS) },
        { label: "死亡回数", value: getScore(player, OBJECTIVES.DEATHS) },
        { label: "水中移動距離", value: getScore(player, OBJECTIVES.MOVED_IN_WATER) },
        { label: "総移動距離", value: getScore(player, OBJECTIVES.MOVED_BLOCKS) },
        { label: "食べた食料の種類", value: `${eatenCount}/${FOOD_ITEMS.size}` },
        { label: "生存日数", value: days },
        { label: "--- 鉱石(シルク無) ---", value: "" },
        { label: "金鉱石", value: getScore(player, OBJECTIVES.ORE_GOLD_NS) },
        { label: "ダイヤモンド", value: getScore(player, OBJECTIVES.ORE_DIAMOND_NS) },
        { label: "レッドストーン", value: getScore(player, OBJECTIVES.ORE_REDSTONE_NS) },
        { label: "ラピスラズリ", value: getScore(player, OBJECTIVES.ORE_LAPIS_NS) },
    ];

    const bodyText = stats.map(s => {
        if (s.value === "") return `\n${s.label}`;
        return `${s.label}: §b${s.value}§r`;
    }).join("\n");

    const form = new ActionFormData()
        .title("統計データ一覧")
        .body(bodyText)
        .button("戻る");

    form.show(player).then(response => {
        if (response.selection === 0) showMainMenu(player);
    });
}

function showTitleList(player) {
    const unlockedStr = player.getDynamicProperty("unlocked_titles");
    const unlockedIds = new Set(unlockedStr ? unlockedStr.split(",") : []);

    let text = "";

    // Ordered strictly by Rarity
    const rarityOrder = ["leather", "iron", "gold", "diamond", "legend", "crafter"];

    for (const rarity of rarityOrder) {
        // Filter titles for this rarity ensuring we use the original order in TITLES or just filter
        // Actually TITLES array is already sorted by rarity groups in code, but filter works too.
        const titles = TITLES.filter(t => t.rarity === rarity);
        if (titles.length === 0) continue;

        const color = RARITY_COLORS[rarity];
        const rarityName = RARITY_NAMES[rarity];

        // Header
        text += `\n${color}--- ${rarityName} ---§r\n`;

        for (const t of titles) {
            const isUnlocked = unlockedIds.has(t.id);
            const mark = isUnlocked ? "§a済" : "§c未";
            text += `${mark} ${t.name}\n §r  条件: ${t.condition}\n`;
        }
    }

    const form = new ActionFormData()
        .title("称号一覧")
        .body(text)
        .button("戻る");

    form.show(player).then(res => {
        if (res.selection === 0) showMainMenu(player);
    });
}

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const unlockedStr = player.getDynamicProperty("unlocked_titles");
        const unlocked = new Set(unlockedStr ? unlockedStr.split(",") : []);
        let changed = false;

        for (const title of TITLES) {
            if (!unlocked.has(title.id) && title.check(player)) {
                unlocked.add(title.id);
                changed = true;
                world.sendMessage(`[${player.name}]が称号:「${RARITY_COLORS[title.rarity]}${title.name}§r」を入手しました！`);
                player.playSound("random.levelup", { pitch: 0.5 });

                // Mastery XP Award
                let xpAmount = 0;
                switch (title.rarity) {
                    case "leather": xpAmount = 25; break;
                    case "iron": xpAmount = 50; break;
                    case "gold": xpAmount = 100; break;
                    case "diamond": xpAmount = 500; break;
                    case "legend": xpAmount = 2500; break;
                    case "crafter": xpAmount = 25000; break;
                }
                if (xpAmount > 0) {
                    addMasteryXp(player, xpAmount);
                    player.sendMessage(`§e称号ボーナス: §b+${xpAmount} XP§e (Mastery)§r`);
                }
            }
        }

        if (changed) {
            player.setDynamicProperty("unlocked_titles", Array.from(unlocked).join(","));
        }

        // --- NameTag Update Logic ---
        // Combine MR + Title + Name + Tracker

        const mrLevel = player.getDynamicProperty("skill_lv_mastery") ?? 1;
        let nameTag = `§bMR:${mrLevel}§r `;

        // 1. Get Active Title
        const activeTitleId = player.getDynamicProperty("active_title");
        if (activeTitleId) {
            const title = TITLES.find(t => t.id === activeTitleId);
            if (title) {
                nameTag += `${RARITY_COLORS[title.rarity]}${title.name}§r `;
            }
        }
        nameTag += player.name;

        // 2. Get Active Tracker
        const trackerId = player.getDynamicProperty("selected_tracker");
        if (trackerId && trackerId !== "none") {
            const tracker = TRACKERS.find(t => t.id === trackerId);
            if (tracker) {
                const value = tracker.getValue(player);
                if (value !== null) {
                    nameTag += `\n§7${value}§r`;
                }
            }
        }

        // Update only if changed to avoid packet spam (though setting same string might be optimized by engine, safe to check)
        if (player.nameTag !== nameTag) {
            player.nameTag = nameTag;
        }
    }
}, 20);

// --- Constants ---
const MENU_ITEM_ID = "syougou:menu_book";
const MENU_ITEM_NAME = "§e称号メニュー§r";

// --- Event Listeners ---
// メニューアイテムの使用検知
world.afterEvents.itemUse.subscribe(event => {
    if (event.itemStack.typeId === MENU_ITEM_ID) {
        showMainMenu(event.source);
    }
});

// プレイヤー参加時またはリスポーン時にメニューアイテム付与 (持っていない場合)
world.afterEvents.playerSpawn.subscribe(event => {
    const player = event.player;
    
    // システムの実行を1tick遅らせることで、スポーン直後のアイテム付与を安定させる
    system.run(() => {
        if (!player || !player.isValid()) return;

        const count = getInventoryItemCount(player, MENU_ITEM_ID);
        if (count === 0) {
            const inventory = player.getComponent("inventory")?.container;
            if (inventory) {
                try {
                    const item = new ItemStack(MENU_ITEM_ID, 1);
                    item.nameTag = MENU_ITEM_NAME;
                    inventory.addItem(item);
                } catch (e) {
                    // アイテム付与に失敗した場合（アイテムIDが不正など）
                    console.warn(`Failed to give menu item to ${player.name}: ${e}`);
                }
            }
        }
    });
});

// スキルツリーを閉じる処理 (スニーク検知)
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (player.hasTag("open_skill_tree") && player.isSneaking) {
            player.removeTag("open_skill_tree");
            player.sendMessage("§e[システム]§f スキルツリーを閉じました。");
        }
    }
}, 5);