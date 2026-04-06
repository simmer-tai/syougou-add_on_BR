import { world } from "@minecraft/server";

const SKILL_IDS = [
    "mining",
    "farming",
    "forestry",
    "mastery",
    "hunter",
    "husbandry",
    "excavation"
];

/**
 * プレイヤーのスキルレベルをスコアボードに同期する
 * Custom UI (JSON) はスクリプトのDynamicPropertyを直接読めないため、
 * スコアボードを経由して値を渡す。
 * @param {Player} player 
 */
export function syncSkillLevelsToScoreboard(player) {
    SKILL_IDS.forEach(skillId => {
        // DynamicPropertyからレベル取得
        const lvKey = `skill_lv_${skillId}`;
        const level = player.getDynamicProperty(lvKey) ?? 1;

        // スコアボード名は "sk_<skillId>" とする (文字数制限回避のため短縮)
        const objectiveName = `sk_${skillId}`;

        try {
            let objective = world.scoreboard.getObjective(objectiveName);
            if (!objective) {
                // オブジェクティブが存在しない場合は作成
                objective = world.scoreboard.addObjective(objectiveName, objectiveName);
            }
            // スコアを更新
            objective.setScore(player, level);
        } catch (e) {
            // エラーハンドリング (意図しないエラー時)
            // console.warn(`Failed to sync score for ${skillId}: ${e}`);
        }
    });
}
