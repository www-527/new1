import { MatchMode } from '../core/SnookerTypes';

export type AchievementModeLimit = MatchMode | 'all';

export type AchievementRarity = '普通' | '稀有' | '史诗' | '传说';

export interface AchievementDefinition {
    id: string;
    name: string;
    description: string;
    rarity: AchievementRarity;
    points: number;
    hidden: boolean;
    modeLimit: AchievementModeLimit;
    targetValue?: number;
    targetByMode?: Record<MatchMode, number>;
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
    {
        id: 'first_shot',
        name: '初来乍到',
        description: '完成第一次有效击球。',
        rarity: '普通',
        points: 10,
        hidden: false,
        modeLimit: 'all',
        targetValue: 1,
    },
    {
        id: 'first_pot',
        name: '开张大吉',
        description: '首次成功打进目标球。',
        rarity: '普通',
        points: 10,
        hidden: false,
        modeLimit: 'all',
        targetValue: 1,
    },
    {
        id: 'opening_pot',
        name: '开球入魂',
        description: '本局第一杆成功进球。',
        rarity: '普通',
        points: 10,
        hidden: false,
        modeLimit: 'all',
        targetValue: 1,
    },
    {
        id: 'hot_hand',
        name: '手感热起来',
        description: '连续 2 杆都有得分。',
        rarity: '普通',
        points: 10,
        hidden: false,
        modeLimit: 'all',
        targetValue: 2,
    },
    {
        id: 'double_pot',
        name: '一箭双雕',
        description: '单杆打进 2 颗及以上目标球。',
        rarity: '稀有',
        points: 20,
        hidden: false,
        modeLimit: 'all',
        targetValue: 2,
    },
    {
        id: 'small_break',
        name: '小爆发',
        description: '单局 BREAK 达到指定分数。',
        rarity: '稀有',
        points: 20,
        hidden: false,
        modeLimit: 'all',
        targetByMode: {
            [MatchMode.Casual]: 12,
            [MatchMode.Expert]: 18,
        },
    },
    {
        id: 'big_break',
        name: '一杆定音',
        description: '单局 BREAK 达到高档目标值。',
        rarity: '史诗',
        points: 35,
        hidden: false,
        modeLimit: 'all',
        targetByMode: {
            [MatchMode.Casual]: 20,
            [MatchMode.Expert]: 30,
        },
    },
    {
        id: 'steady_veteran',
        name: '稳如老将',
        description: '单局连续 5 杆没有白球犯规。',
        rarity: '稀有',
        points: 20,
        hidden: false,
        modeLimit: 'all',
        targetValue: 5,
    },
    {
        id: 'perfect_frame',
        name: '零失误之手',
        description: '整局没有任何白球犯规。',
        rarity: '史诗',
        points: 35,
        hidden: false,
        modeLimit: 'all',
        targetValue: 1,
    },
    {
        id: 'casual_finisher',
        name: '轻装上阵',
        description: '完成 1 局休闲模式。',
        rarity: '普通',
        points: 10,
        hidden: false,
        modeLimit: MatchMode.Casual,
        targetValue: 1,
    },
    {
        id: 'casual_master',
        name: '短局王者',
        description: '在休闲模式中拿到 20 分及以上并完成本局。',
        rarity: '稀有',
        points: 20,
        hidden: false,
        modeLimit: MatchMode.Casual,
        targetValue: 20,
    },
    {
        id: 'expert_finisher',
        name: '标准挑战者',
        description: '完成 1 局专家模式。',
        rarity: '稀有',
        points: 20,
        hidden: false,
        modeLimit: MatchMode.Expert,
        targetValue: 1,
    },
    {
        id: 'recovery_master',
        name: '止损专家',
        description: '单局中至少出现 1 次白球犯规，最终仍完成本局。',
        rarity: '稀有',
        points: 20,
        hidden: false,
        modeLimit: 'all',
        targetValue: 1,
    },
    {
        id: 'fast_clear',
        name: '速战速决',
        description: '在限定出杆数内完成一局。',
        rarity: '史诗',
        points: 35,
        hidden: false,
        modeLimit: 'all',
        targetByMode: {
            [MatchMode.Casual]: 12,
            [MatchMode.Expert]: 20,
        },
    },
    {
        id: 'secret_master',
        name: '秘密高手',
        description: '关闭辅助线完成 1 局专家模式。',
        rarity: '传说',
        points: 50,
        hidden: true,
        modeLimit: MatchMode.Expert,
        targetValue: 1,
    },
    {
        id: 'blind_trial',
        name: '盲打试炼',
        description: '关闭辅助线后连续 3 杆都有得分。',
        rarity: '传说',
        points: 50,
        hidden: true,
        modeLimit: 'all',
        targetValue: 3,
    },
];

export function getAchievementTarget(definition: AchievementDefinition, mode: MatchMode): number | null {
    if (definition.targetByMode) {
        return definition.targetByMode[mode] ?? null;
    }
    return definition.targetValue ?? null;
}
