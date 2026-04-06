import { world } from "@minecraft/server";

const SKILLS = [
    { id: "mining", name: "採掘", icon: "\uE300", color: "§7" },
    { id: "farming", name: "農業", icon: "\uE301", color: "§a" },
    { id: "forestry", name: "林業", icon: "\uE302", color: "§2" },
    { id: "hunter", name: "狩人", icon: "\uE304", color: "§c" },
    { id: "husbandry", name: "畜産", icon: "\uE305", color: "§d" },
    { id: "excavation", name: "整地", icon: "\uE306", color: "§e" }
];

/**
 * プレイヤー個別のスキル情報をアクションバー経由でサイドバーに表示する
 * @param {import("@minecraft/server").Player} player 
 */
export function updateSidebarHUD(player) {
    if (!player || !player.isValid()) return;

    const mrLevel = player.getDynamicProperty("skill_lv_mastery") ?? 1;
    
    let lines = [];
    lines.push(`§l§b[ Mastery LV: ${mrLevel} ]§r`);
    lines.push(`§7------------------§r`);

    for (const skill of SKILLS) {
        const level = player.getDynamicProperty(`skill_lv_${skill.id}`) ?? 1;
        lines.push(`${skill.icon} ${skill.color}${skill.name}§r: §fLv.${level}§r`);
    }

    // アクションバー表示を停止 (スコアボード同期の新しいUIシステムへ移行するため)
    // const text = lines.join("\n");
    // player.onScreenDisplay.setActionBar(text);
}
