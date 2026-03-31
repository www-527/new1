import { sys } from 'cc';
import { ACHIEVEMENT_DEFINITIONS, AchievementDefinition, getAchievementTarget } from '../config/AchievementConfig';
import { MatchMode } from './SnookerTypes';

const STORAGE_KEY = 'simple-snooker-achievements-v1';

export interface AchievementUnlockState {
    unlocked: boolean;
    unlockedAt: number;
}

interface MatchAchievementStats {
    mode: MatchMode;
    scoringShotStreak: number;
    safeShotStreak: number;
    maxBreak: number;
    foulCount: number;
    helperDisabledDuringMatch: boolean;
    helperChallengeActive: boolean;
    helperChallengeBroken: boolean;
    helperOffScoringShotStreak: number;
}

interface StoredAchievementData {
    unlocked: Record<string, number>;
}

interface ShotTakenParams {
    shotsUsed: number;
}

interface ShotResolvedParams {
    mode: MatchMode;
    objectBallCount: number;
    scoreDelta: number;
    cueBallPotted: boolean;
    nextBreak: number;
    shotsUsed: number;
    helperEnabled: boolean;
}

interface MatchCompletedParams {
    mode: MatchMode;
    score: number;
    shotsUsed: number;
    helperEnabled: boolean;
}

export class AchievementSystem {
    private readonly definitions = ACHIEVEMENT_DEFINITIONS;
    private readonly state = new Map<string, AchievementUnlockState>();
    private matchStats: MatchAchievementStats | null = null;

    public load(): void {
        this.state.clear();
        try {
            const raw = sys.localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return;
            }
            const data = JSON.parse(raw) as StoredAchievementData;
            const unlocked = data?.unlocked ?? {};
            Object.keys(unlocked).forEach((id) => {
                const unlockedAt = Number(unlocked[id]);
                if (!Number.isFinite(unlockedAt)) {
                    return;
                }
                this.state.set(id, {
                    unlocked: true,
                    unlockedAt,
                });
            });
        } catch (error) {
            console.warn('[AchievementSystem] 读取成就存档失败，已忽略损坏数据。', error);
        }
    }

    public resetMatch(mode: MatchMode): void {
        this.matchStats = {
            mode,
            scoringShotStreak: 0,
            safeShotStreak: 0,
            maxBreak: 0,
            foulCount: 0,
            helperDisabledDuringMatch: false,
            helperChallengeActive: false,
            helperChallengeBroken: false,
            helperOffScoringShotStreak: 0,
        };
    }

    public onHelperToggle(helperEnabled: boolean): void {
        if (!this.matchStats) {
            return;
        }
        if (!helperEnabled) {
            this.matchStats.helperDisabledDuringMatch = true;
            this.matchStats.helperChallengeActive = true;
            this.matchStats.helperOffScoringShotStreak = 0;
            return;
        }
        if (this.matchStats.helperChallengeActive) {
            this.matchStats.helperChallengeBroken = true;
        }
        this.matchStats.helperChallengeActive = false;
        this.matchStats.helperOffScoringShotStreak = 0;
    }

    public onShotTaken(params: ShotTakenParams): AchievementDefinition[] {
        const unlocked: AchievementDefinition[] = [];
        if (params.shotsUsed >= 1) {
            this.tryUnlock('first_shot', unlocked);
        }
        return unlocked;
    }

    public onShotResolved(params: ShotResolvedParams): AchievementDefinition[] {
        const unlocked: AchievementDefinition[] = [];
        if (!this.matchStats) {
            this.resetMatch(params.mode);
        }
        if (!this.matchStats) {
            return unlocked;
        }

        this.matchStats.mode = params.mode;
        this.matchStats.maxBreak = Math.max(this.matchStats.maxBreak, params.nextBreak);

        if (params.cueBallPotted) {
            this.matchStats.foulCount += 1;
            this.matchStats.safeShotStreak = 0;
            this.matchStats.scoringShotStreak = 0;
            this.matchStats.helperOffScoringShotStreak = 0;
        } else {
            this.matchStats.safeShotStreak += 1;
            if (params.scoreDelta > 0) {
                this.matchStats.scoringShotStreak += 1;
                if (!params.helperEnabled && this.matchStats.helperChallengeActive && !this.matchStats.helperChallengeBroken) {
                    this.matchStats.helperOffScoringShotStreak += 1;
                } else {
                    this.matchStats.helperOffScoringShotStreak = 0;
                }
            } else {
                this.matchStats.scoringShotStreak = 0;
                this.matchStats.helperOffScoringShotStreak = 0;
            }
        }

        if (params.objectBallCount > 0) {
            this.tryUnlock('first_pot', unlocked);
            if (params.shotsUsed === 1) {
                this.tryUnlock('opening_pot', unlocked);
            }
        }
        if (params.objectBallCount >= 2) {
            this.tryUnlock('double_pot', unlocked);
        }
        if (this.matchStats.scoringShotStreak >= 2) {
            this.tryUnlock('hot_hand', unlocked);
        }
        if (this.matchStats.safeShotStreak >= 5) {
            this.tryUnlock('steady_veteran', unlocked);
        }
        if (this.matchStats.helperOffScoringShotStreak >= 3) {
            this.tryUnlock('blind_trial', unlocked);
        }
        this.tryUnlockWhenTargetReached('small_break', this.matchStats.maxBreak, params.mode, unlocked);
        this.tryUnlockWhenTargetReached('big_break', this.matchStats.maxBreak, params.mode, unlocked);
        return unlocked;
    }

    public onMatchCompleted(params: MatchCompletedParams): AchievementDefinition[] {
        const unlocked: AchievementDefinition[] = [];
        if (!this.matchStats) {
            this.resetMatch(params.mode);
        }
        if (!this.matchStats) {
            return unlocked;
        }

        if (params.mode === MatchMode.Casual) {
            this.tryUnlock('casual_finisher', unlocked);
            if (params.score >= 20) {
                this.tryUnlock('casual_master', unlocked);
            }
        }

        if (params.mode === MatchMode.Expert) {
            this.tryUnlock('expert_finisher', unlocked);
            if (
                this.matchStats.helperDisabledDuringMatch
                && this.matchStats.helperChallengeActive
                && !this.matchStats.helperChallengeBroken
                && !params.helperEnabled
            ) {
                this.tryUnlock('secret_master', unlocked);
            }
        }

        if (this.matchStats.foulCount === 0) {
            this.tryUnlock('perfect_frame', unlocked);
        }
        if (this.matchStats.foulCount > 0) {
            this.tryUnlock('recovery_master', unlocked);
        }
        this.tryUnlockWhenTargetReached('fast_clear', params.shotsUsed, params.mode, unlocked);
        return unlocked;
    }

    public getDefinitions(): readonly AchievementDefinition[] {
        return this.definitions;
    }

    public getUnlockState(id: string): AchievementUnlockState | null {
        return this.state.get(id) ?? null;
    }

    public getUnlockedCount(): number {
        return this.state.size;
    }

    public getTotalCount(): number {
        return this.definitions.length;
    }

    public getUnlockedPoints(): number {
        return this.definitions.reduce((sum, definition) => {
            return sum + (this.state.has(definition.id) ? definition.points : 0);
        }, 0);
    }

    public getTotalPoints(): number {
        return this.definitions.reduce((sum, definition) => sum + definition.points, 0);
    }

    public getHiddenCount(): number {
        return this.definitions.filter((definition) => definition.hidden).length;
    }

    public getUnlockedHiddenCount(): number {
        return this.definitions.filter((definition) => definition.hidden && this.state.has(definition.id)).length;
    }

    private tryUnlockWhenTargetReached(
        id: string,
        currentValue: number,
        mode: MatchMode,
        unlocked: AchievementDefinition[],
    ): void {
        const definition = this.findDefinition(id);
        const target = getAchievementTarget(definition, mode);
        if (target === null) {
            return;
        }
        const isFastClear = id === 'fast_clear';
        if ((isFastClear && currentValue <= target) || (!isFastClear && currentValue >= target)) {
            this.tryUnlock(id, unlocked);
        }
    }

    private tryUnlock(id: string, unlocked: AchievementDefinition[]): void {
        if (this.state.has(id)) {
            return;
        }
        const definition = this.findDefinition(id);
        const unlockedAt = Date.now();
        this.state.set(id, {
            unlocked: true,
            unlockedAt,
        });
        this.save();
        unlocked.push(definition);
    }

    private findDefinition(id: string): AchievementDefinition {
        const definition = this.definitions.find((item) => item.id === id);
        if (!definition) {
            throw new Error(`未找到成就定义：${id}`);
        }
        return definition;
    }

    private save(): void {
        const unlocked: Record<string, number> = {};
        this.state.forEach((value, key) => {
            unlocked[key] = value.unlockedAt;
        });
        try {
            sys.localStorage.setItem(STORAGE_KEY, JSON.stringify({ unlocked }));
        } catch (error) {
            console.warn('[AchievementSystem] 保存成就存档失败。', error);
        }
    }
}
