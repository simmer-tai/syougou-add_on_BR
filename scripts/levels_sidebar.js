import { world, system } from "@minecraft/server";

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        try {
            const lvMining = player.getDynamicProperty("skill_lv_mining") ?? 1;
            const lvFarming = player.getDynamicProperty("skill_lv_farming") ?? 1;
            const lvForestry = player.getDynamicProperty("skill_lv_forestry") ?? 1;
            const lvHunter = player.getDynamicProperty("skill_lv_hunter") ?? 1;
            const lvHusbandry = player.getDynamicProperty("skill_lv_husbandry") ?? 1;
            const lvExcavation = player.getDynamicProperty("skill_lv_excavation") ?? 1;
            const lvMastery = player.getDynamicProperty("skill_lv_mastery") ?? 1;

            let text = `sidebar:§l§b[ マスタリー: Lv.${lvMastery} ]§r\n`;
            text += `§7採掘: §fLv.${lvMining}§r\n`;
            text += `§a農業: §fLv.${lvFarming}§r\n`;
            text += `§2林業: §fLv.${lvForestry}§r\n`;
            text += `§c狩人: §fLv.${lvHunter}§r\n`;
            text += `§d畜産: §fLv.${lvHusbandry}§r\n`;
            text += `§e整地: §fLv.${lvExcavation}§r`;

            player.onScreenDisplay.setTitle(text, {
                fadeInDuration: 0,
                stayDuration: 40,
                fadeOutDuration: 0
            });
        } catch (e) {}
    }
}, 20);
