
import { world } from "@minecraft/server";
import { syncSkillLevelsToScoreboard } from "./sync_score.js";

// 次のレベルに必要な経験値を計算: 100 * 1.05^(レベル-1)
export function getNextLevelXp(level) {
    return Math.floor(100 * Math.pow(1.05, level - 1));
}

/**
 * スキル経験値を更新し、アクションバーに経験値情報を表示する共通関数
 * @param {Player} player 
 * @param {string} skillId スキルID
 * @param {string} skillName 表示名
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
        player.sendMessage(`§e§l[レベルアップ！] §r§a${skillName}スキルLv§e${level}§a になりました！§r`);
        player.playSound("random.levelup");

        // 他のプレイヤーに通知
        for (const p of world.getAllPlayers()) {
            if (p.id !== player.id) {
                p.sendMessage(`§f[${player.name}] §a${skillName}スキルLv.${level}§fになりました！`);
            }
        }

        required = getNextLevelXp(level);
    }

    player.setDynamicProperty(xpKey, xp);

    // 数値のみのアクションバー表示
    player.onScreenDisplay.setActionBar(`§6${skillName} §a+${amount}XP §7( ${Math.floor(xp)}/${required})§r`);

    // UI用にスコアボード同期
    syncSkillLevelsToScoreboard(player);
}
