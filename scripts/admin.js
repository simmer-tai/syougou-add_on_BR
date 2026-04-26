import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

const SKILL_DEFINITIONS = {
    mining: { name: "採掘", icon: "⛏️" },
    farming: { name: "農業", icon: "🌾" },
    forestry: { name: "林業", icon: "🌲" },
    hunter: { name: "狩猟", icon: "⚔️" },
    husbandry: { name: "畜産", icon: "🐄" },
    mastery: { name: "マスタリー", icon: "👑" },
    excavation: { name: "整地", icon: "🏗️" },
    fishing: { name: "漁業", icon: "🎣" }
};

async function showCheatSkillSelect(player) {
    const form = new ActionFormData()
        .title("§c§lチートUI: スキル選択")
        .body("設定を変更したいスキルを選択してください。");

    const skillIds = Object.keys(SKILL_DEFINITIONS);
    skillIds.forEach(id => {
        const skill = SKILL_DEFINITIONS[id];
        form.button(`${skill.icon} ${skill.name}`);
    });

    const response = await form.show(player);
    if (response.canceled) return;

    const selectedSkillId = skillIds[response.selection];
    showCheatSkillEditor(player, selectedSkillId);
}

async function showCheatSkillEditor(player, skillId) {
    const skill = SKILL_DEFINITIONS[skillId];
    const currentLevel = player.getDynamicProperty(`skill_lv_${skillId}`) ?? 1;
    const currentXp = player.getDynamicProperty(`skill_xp_${skillId}`) ?? 0;

    try {
        const form = new ModalFormData()
            .title(`§c§l${skill.icon} ${skill.name}スキル設定`)
            .textField("設定するレベル", `現在のレベル: ${currentLevel}`, String(currentLevel))
            .textField("設定する経験値", `現在の経験値: ${currentXp}`, String(currentXp));

        const response = await form.show(player);
        if (response.canceled) {
            showCheatSkillSelect(player); // Go back to skill selection
            return;
        }

        const [levelStr, xpStr] = response.formValues;
        const level = parseInt(levelStr, 10);
        const xp = parseInt(xpStr, 10);

        if (isNaN(level) || isNaN(xp) || level < 1 || xp < 0) {
            player.sendMessage("§c無効な数値が入力されました。レベルは1以上、経験値は0以上である必要があります。§r");
            return;
        }

        player.setDynamicProperty(`skill_lv_${skillId}`, level);
        player.setDynamicProperty(`skill_xp_${skillId}`, xp);

        player.sendMessage(`§a[チート] ${skill.name}スキルを Lv.${level} (XP: ${xp}) に設定しました。§r`);

    } catch (e) {
        console.error(`[CheatUI] Error: ${e}`);
        player.sendMessage("§cUIの表示中にエラーが発生しました。");
    }
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id !== "syougou:cheat") return;

    const player = event.sourceEntity;
    if (!player || !player.hasTag("admin")) {
        player?.sendMessage("§cこのコマンドは管理者(tag:admin)のみ使用できます。§r\n§7※ /tag @s add admin を実行してください。");
        return;
    }

    showCheatSkillSelect(player);
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id !== "syougou:reset_skills") return;

    const player = event.sourceEntity;
    if (!player || !player.hasTag("admin")) {
        player?.sendMessage("§cこのコマンドは管理者(tag:admin)のみ使用できます。§r\n§7※ /tag @s add admin を実行してください。");
        return;
    }

    const skillIds = Object.keys(SKILL_DEFINITIONS);

    // 全スキルをリセット
    skillIds.forEach(id => {
        // レベルを1にリセット
        player.setDynamicProperty(`skill_lv_${id}`, 1);
        // 経験値を0にリセット
        player.setDynamicProperty(`skill_xp_${id}`, 0);
    });

    player.sendMessage("§a[System] 全てのスキルレベルと経験値をリセットしました。§r");
    player.playSound("random.orb");
});