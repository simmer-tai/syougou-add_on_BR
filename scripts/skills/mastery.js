import { world, system } from "@minecraft/server";

// マスタリーランクの計算対象となるスキルID一覧
const SKILL_KEYS = [
    "skill_lv_mining",
    "skill_lv_farming",
    "skill_lv_forestry",
    "skill_lv_hunter",
    "skill_lv_husbandry",
    "skill_lv_excavation",
    "skill_lv_fishing",
    "skill_lv_swimming"
];

// 次のレベルに必要な経験値を計算: 100 * 1.05^(レベル-1)
function getNextMrLevelXp(level) {
    return Math.floor(100 * Math.pow(1.05, level - 1));
}

/**
 * マスタリーランクの更新処理
 * 他のスキルのレベル合計を監視し、上昇分に応じて経験値を付与する
 */
function updateMastery(player) {
    // 1. 現在の全スキルレベル合計を計算
    let currentTotalLevels = 0;
    for (const key of SKILL_KEYS) {
        // スキルレベルを取得 (未設定の場合はLv1とみなす)
        currentTotalLevels += player.getDynamicProperty(key) ?? 1;
    }

    // 2. 前回確認時の合計レベルを取得
    const accountedKey = "mastery_accounted_levels";
    let accountedLevels = player.getDynamicProperty(accountedKey);

    // 初回実行時 (データがない場合)
    if (accountedLevels === undefined) {
        // 全スキルが初期レベル(Lv1)だったと仮定して、現在のレベルとの差分を計算対象にする
        // これにより、既にレベルが上がっているプレイヤーも遡ってMR経験値を獲得できる
        accountedLevels = SKILL_KEYS.length;
    }

    const diff = currentTotalLevels - accountedLevels;

    if (diff > 0) {
        // レベルが上がった分だけ経験値を付与 (+10 per level)
        const xpGain = diff * 10;
        addMasteryXp(player, xpGain);

        // 確認済みレベルを更新
        player.setDynamicProperty(accountedKey, currentTotalLevels);
    // 確認済みレベルを現在値に合わせる
        player.setDynamicProperty(accountedKey, currentTotalLevels);
    }
}

/**
 * マスタリーランク経験値加算 & レベルアップ処理
 */
/**
 * マスタリーランク経験値加算 & レベルアップ処理
 */
export function addMasteryXp(player, amount) {
    const xpKey = "skill_xp_mastery";
    const lvKey = "skill_lv_mastery";

    let xp = player.getDynamicProperty(xpKey) ?? 0;
    let level = player.getDynamicProperty(lvKey) ?? 1;

    xp += amount;

    // レベルアップ判定ループ
    let required = getNextMrLevelXp(level);
    let leveledUp = false;

    while (xp >= required) {
        xp -= required;
        level++;
        leveledUp = true;
        required = getNextMrLevelXp(level);
    }

    if (leveledUp) {
        player.setDynamicProperty(lvKey, level);
        player.sendMessage(`§e[Mastery] マスタリーランクが §b${level}§e に上がりました！§r`);
        player.playSound("random.levelup");
    }

    player.setDynamicProperty(xpKey, xp);
}



// 常時監視ループ (1秒ごとに更新)
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        updateMastery(player);
    }
}, 20);