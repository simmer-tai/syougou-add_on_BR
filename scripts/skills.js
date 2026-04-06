import { world, system } from "@minecraft/server";

// スキル定義：各スキルのアイコン、名前、色を設定
// 注意: リソースパックの textures/items にある画像を直接指定することはできません。
// 画像を表示するには、リソースパック側でフォント(glyph)として登録し、その文字コード(例: "\uE101")を icon に設定してください。
const SKILLS = {
    mining: { id: "mining", name: "採掘", icon: "⛏️", color: "§7" },
    farming: { id: "farming", name: "農業", icon: "🌾", color: "§a" },
    forestry: { id: "forestry", name: "林業", icon: "🪓", color: "§6" },
    hunter: { id: "hunter", name: "狩人", icon: "⚔️", color: "§c" },
    fishing: { id: "fishing", name: "漁業", icon: "🎣", color: "§b" },
    swimming: { id: "swimming", name: "水泳", icon: "🫧", color: "§9" }
};

// 採掘対象ブロックと経験値
const ORE_XP = {
    "minecraft:coal_ore": 5, "minecraft:deepslate_coal_ore": 5,
    "minecraft:copper_ore": 5, "minecraft:deepslate_copper_ore": 5,
    "minecraft:iron_ore": 10, "minecraft:deepslate_iron_ore": 10,
    "minecraft:gold_ore": 15, "minecraft:deepslate_gold_ore": 15,
    "minecraft:redstone_ore": 10, "minecraft:deepslate_redstone_ore": 10,
    "minecraft:lapis_ore": 15, "minecraft:deepslate_lapis_ore": 15,
    "minecraft:diamond_ore": 30, "minecraft:deepslate_diamond_ore": 30,
    "minecraft:quartz_ore": 10, "minecraft:nether_gold_ore": 5
};

// 農業対象ブロックと経験値
const CROP_XP = {
    "minecraft:wheat": 3,
    "minecraft:carrots": 3,
    "minecraft:potatoes": 3,
    "minecraft:beetroot": 3,
    "minecraft:pumpkin": 10,
    "minecraft:melon_block": 10
};

/**
 * スキル経験値を加算し、アイコン付きで表示する関数
 * @param {import("@minecraft/server").Player} player
 * @param {string} skillId
 * @param {number} amount
 */
function addSkillExp(player, skillId, amount) {
    if (!player || !player.isValid()) return;

    const skill = SKILLS[skillId];
    if (!skill) return;

    // TODO: ここに現在の経験値を保存する処理やレベルアップ計算を追加してください
    // 例: const currentExp = getExp(player, skillId);
    //     saveExp(player, skillId, currentExp + amount);

    // 要望の実装: 経験値獲得時にアイコンを表示
    // フォーマット: [アイコン] [スキル名] +[量]
    player.onScreenDisplay.setActionBar(`${skill.color}${skill.icon} ${skill.name} +${amount}`);
}

// ブロック破壊イベント (採掘・農業・林業)
world.afterEvents.playerBreakBlock.subscribe((event) => {
    const { player, block, brokenBlockPermutation } = event;
    const typeId = brokenBlockPermutation.type.id;

    // 採掘 (Mining)
    if (ORE_XP[typeId]) {
        addSkillExp(player, "mining", ORE_XP[typeId]);
        return;
    }

    // 農業 (Farming)
    if (CROP_XP[typeId]) {
        // 作物の成長段階チェックが必要な場合はここに追加 (例: growth stateが最大か)
        addSkillExp(player, "farming", CROP_XP[typeId]);
        return;
    }

    // 林業 (Forestry)
    // 原木タグを持つかチェック
    if (brokenBlockPermutation.hasTag("minecraft:logs")) {
        addSkillExp(player, "forestry", 5);
        return;
    }
});

// モブ討伐イベント (狩人)
world.afterEvents.entityDie.subscribe((event) => {
    const { damageSource, deadEntity } = event;
    const attacker = damageSource.damagingEntity;

    if (attacker && attacker.typeId === "minecraft:player") {
        // 敵対モブかどうかの判定は簡易的にファミリータイプ等で行うか、全モブ対象とする
        // ここではディメンションによる判定を実装
        const dimension = attacker.dimension.id;
        let xp = 0;

        if (dimension === "minecraft:overworld") xp = 10;
        else if (dimension === "minecraft:nether") xp = 20;
        else if (dimension === "minecraft:the_end") xp = 30;

        if (xp > 0) {
            addSkillExp(attacker, "hunter", xp);
        }
    }
});

// 水泳判定用 (簡易実装)
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        try {
            // 水中にいるかチェック
            const headLocation = player.getHeadLocation();
            const block = player.dimension.getBlock(headLocation);
            
            if (block && (block.typeId === "minecraft:water" || block.typeId === "minecraft:flowing_water")) {
                // 移動しているかチェック (速度がある程度あるか)
                const velocity = player.getVelocity();
                const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
                
                if (speed > 0.05) { // 泳いでいるとみなす閾値
                    // 頻繁に出すぎないように調整が必要かもしれません
                    // ここでは1秒に1回程度呼ばれる想定で+1などを加算するロジックを組むのが一般的
                    // 今回はシンプルに呼び出しごとに確率またはカウンターで処理する想定
                    
                    // ※注意: runIntervalのtick数に合わせて調整してください
                    // 例: 20tickごとの実行なら +1
                    addSkillExp(player, "swimming", 1);
                }
            }
        } catch (e) {
            // プレイヤー切断時などのエラー回避
        }
    }
}, 20); // 1秒ごとにチェック

// 釣りイベント (漁業)
// ※現在のAPIでは「釣った瞬間」を正確に検知するイベントが限定的です。
// アイテムを拾ったイベント等で代用するか、将来的なAPI更新を待つ必要があります。
// 以下はプレースホルダーです。
/*
world.afterEvents.playerFish.subscribe((event) => {
    // ※架空のイベントです。実際には itemUse や entitySpawn (浮き) などを組み合わせる必要があります
    addSkillExp(event.player, "fishing", 10);
});
*/

// 補足:
// アイコンをカスタムテクスチャにする場合は、SKILLSオブジェクトの icon プロパティを
// リソースパックで定義したUnicode文字に変更してください。
// 例: icon: "\uE101"