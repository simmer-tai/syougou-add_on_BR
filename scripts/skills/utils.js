
import { world } from "@minecraft/server";

// カスタムフォント（バーの画像）の定義
const SKILL_BAR_CHARS = [
    "\uE200", // 0%
    "\uE201", // 10%
    "\uE202", // 20%
    "\uE203", // 30%
    "\uE204", // 40%
    "\uE205", // 50%
    "\uE206", // 60%
    "\uE207", // 70%
    "\uE208", // 80%
    "\uE209", // 90%
    "\uE20A"  // 100%
];

// 次のレベルに必要な経験値を計算: 100 * 1.05^(レベル-1)
export function getNextLevelXp(level) {
    return Math.floor(100 * Math.pow(1.05, level - 1));
}

// スキルアイコンの定義
const SKILL_ICONS = {
    "mining": "\uE300",
    "farming": "\uE301",
    "forestry": "\uE302",
    "mastery": "\uE303",
    "hunter": "\uE304",
    "husbandry": "\uE305",
    "excavation": "\uE306"
};

/**
 * スキル経験値を更新し、アクションバーにカスタムバーを表示する共通関数
 * @param {Player} player 
 * @param {string} skillId スキルID (例: "mining", "farming")
 * @param {string} skillName 表示名 (例: "採掘", "農業")
 * @param {number} amount 獲得経験値
 */
export function updateSkillXp(player, skillId, skillName, amount) {
    const xpKey = `skill_xp_${skillId}`;
    const lvKey = `skill_lv_${skillId}`;

    let xp = player.getDynamicProperty(xpKey) ?? 0;
    let level = player.getDynamicProperty(lvKey) ?? 1;

    xp += amount;

    let required = getNextLevelXp(level);

    // レベルアップ判定
    if (xp >= required) {
        xp -= required;
        level++;
        player.setDynamicProperty(lvKey, level);

        // レベルアップ通知
        const icon = SKILL_ICONS[skillId] ?? "";
        player.sendMessage(`§a[${icon}${skillName}スキル] レベルが §e${level}§a に上がりました！§r`);
        player.playSound("random.levelup");
        player.onScreenDisplay.setTitle(`§eLv.${level}`, {
            subtitle: `§a${icon}${skillName}スキル アップ！`,
            fadeInDuration: 10,
            stayDuration: 70,
            fadeOutDuration: 20
        });

        // 他のプレイヤーに通知
        for (const p of world.getAllPlayers()) {
            if (p.id !== player.id) {
                p.sendMessage(`§e[スキル] §f${player.name}が§a${icon}${skillName}スキルLv.${level}§fになりました！`);
            }
        }

        // レベルアップ後は次のレベルの必要経験値で再計算
        required = getNextLevelXp(level);
    }

    player.setDynamicProperty(xpKey, xp);

    // アイコン付き・進捗表示アクションバー
    const icon = SKILL_ICONS[skillId] ?? "";
    player.onScreenDisplay.setActionBar(`${icon} §a+${amount} ${skillName}XP §7(${Math.floor(xp)}/${required})§r`);

    // UI用にスコアボード同期
    syncSkillLevelsToScoreboard(player);
}

import { syncSkillLevelsToScoreboard } from "./sync_score.js";
