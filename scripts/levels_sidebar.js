import { world, system } from "@minecraft/server";

/**
 * プレイヤーごとに独立した「レベルサイドバー」をサブタイトル機能で実現する
 * リソースパック側の JSON UI で、サブタイトルの表示位置を画面右側に移動させることで
 * 各プレイヤーが自分の情報だけを右側に表示できるようにする
 */
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        try {
            // 各スキルレベルを取得
            const lvMining = player.getDynamicProperty("skill_lv_mining") ?? 1;
            const lvFarming = player.getDynamicProperty("skill_lv_farming") ?? 1;
            const lvForestry = player.getDynamicProperty("skill_lv_forestry") ?? 1;
            const lvHunter = player.getDynamicProperty("skill_lv_hunter") ?? 1;
            const lvHusbandry = player.getDynamicProperty("skill_lv_husbandry") ?? 1;
            const lvExcavation = player.getDynamicProperty("skill_lv_excavation") ?? 1;
            const lvMastery = player.getDynamicProperty("skill_lv_mastery") ?? 1;

            // サイドバー形式のテキストを構築 (改行区切り)
            let text = "§l§b[ Mastery ]§r\n";
            text += `§fMR: §b${lvMastery}§r\n`;
            text += "§7------------------§r\n";
            text += `§7⛏ 採掘: §f§l${lvMining}§r\n`;
            text += `§a🌾 農業: §f§l${lvFarming}§r\n`;
            text += `§2🌲 林業: §f§l${lvForestry}§r\n`;
            text += `§c⚔ 狩人: §f§l${lvHunter}§r\n`;
            text += `§d🐄 畜産: §f§l${lvHusbandry}§r\n`;
            text += `§e🏗 整地: §f§l${lvExcavation}§r\n`;

            // サブタイトルとして送信 (タイトルは空文字)
            // 表示時間は2秒(40tick)、フェードなしで常時表示されるように調整
            player.onScreenDisplay.setTitle(" ", {
                subtitle: text,
                fadeInDuration: 0,
                stayDuration: 40, 
                fadeOutDuration: 0
            });
        } catch (e) {
            // プレイヤー切断時などのエラー回避
        }
    }
}, 20); // 1秒ごとに更新
