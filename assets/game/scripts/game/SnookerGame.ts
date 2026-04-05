import {
    _decorator,
    Color,
    Component,
    Graphics,
    Label,
    Layers,
    Mask,
    Node,
    Size,
    Sprite,
    Tween,
    UITransform,
    UIOpacity,
    Vec2,
    Vec3,
    math,
    sys,
    tween,
    v2,
    v3,
} from 'cc';
import {
    AchievementDefinition,
    getAchievementTarget,
} from '../config/AchievementConfig';
import {
    BAULK_LINE_X,
    BALL_COLORS,
    BALL_RADIUS,
    BALL_SCORES,
    CUE_START_POSITION,
    DESIGN_SIZE,
    D_RADIUS,
    FIXED_TIME_STEP,
    MATCH_MODE_CONFIGS,
    MAX_DRAG_DISTANCE,
    MAX_SHOT_SPEED,
    MIN_SHOT_SPEED,
    POCKET_POSITIONS,
    TABLE_CENTER,
    TABLE_INNER_HEIGHT,
    TABLE_INNER_WIDTH,
    TABLE_OUTER_HEIGHT,
    TABLE_OUTER_WIDTH,
} from '../config/SnookerConfig';
import { AchievementSystem } from '../core/AchievementSystem';
import { PointerInput } from '../core/PointerInput';
import { SnookerAudio } from '../core/SnookerAudio';
import { SnookerPhysics } from '../core/SnookerPhysics';
import { SnookerRules } from '../core/SnookerRules';
import { BallLayout, BallState, BallType, MatchMode, MatchModeConfig, PhysicsStepResult, PlayPhase, ShotResolution } from '../core/SnookerTypes';
import { TextureSkinner } from '../ui/TextureSkinner';
import { UiFactory } from '../ui/UiFactory';
import { shiftColor, SnookerTheme, withAlpha } from '../ui/SnookerTheme';

const { ccclass } = _decorator;
const HIGH_SCORE_KEY = 'simple-snooker-high-score';
const SOUND_KEY = 'simple-snooker-sound-enabled';

type ButtonStyle = 'neutral' | 'blue' | 'green' | 'red' | 'bronze';

interface OverlayButtonConfig {
    label: string;
    style: ButtonStyle;
    action: () => void;
}

interface ButtonOptions {
    holdDurationMs?: number;
    muteClickSound?: boolean;
}

interface CollisionPrediction {
    ball: BallState;
    impactPoint: Vec2;
    travelDistance: number;
    targetDirection: Vec2;
}

interface AchievementCardView {
    root: Node;
    background: Sprite | null;
    pointsBadge: Sprite | null;
    nameLabel: Label;
    pointsLabel: Label;
    descLabel: Label;
    footerLabel: Label;
}

type RuntimeButtonNode = Node & {
    __snookerClickAction?: (() => void) | null;
    __snookerButtonBound?: boolean;
};

@ccclass('SnookerGame')
export class SnookerGame extends Component {
    private phase = PlayPhase.Menu;
    private resumePhase = PlayPhase.Idle;
    private mode = MatchMode.Casual;
    private physics = new SnookerPhysics();
    private rules = new SnookerRules();
    private achievementSystem = new AchievementSystem();
    private audio = new SnookerAudio();
    private pointerInput: PointerInput | null = null;

    private menuLayer!: Node;
    private gameLayer!: Node;
    private overlayLayer!: Node;
    private messagePanel!: Node;
    private settingsPanel!: Node;
    private settlementPanel!: Node;
    private achievementPanel!: Node;
    private achievementGrid!: Node;
    private tableRoot!: Node;
    private tableBallLayer!: Node;
    private fxLayer!: Node;
    private touchLayer!: Node;
    private topHud!: Node;
    private bottomHud!: Node;
    private battleReportNode!: Node;
    private battleReportOpacity!: UIOpacity;

    private aimGraphics!: Graphics;
    private cueGraphics!: Graphics;
    private powerFillGraphics!: Graphics;

    private scoreLabel!: Label;
    private breakLabel!: Label;
    private stageLabel!: Label;
    private shotsLabel!: Label;
    private targetHintLabel!: Label;
    private statusLabel!: Label;
    private powerValueLabel!: Label;
    private powerBandLabel!: Label;

    private menuDetailLabel!: Label;
    private menuModeLabel!: Label;
    private menuGoalLabel!: Label;
    private menuTargetLabel!: Label;
    private menuShotLimitLabel!: Label;
    private menuHighScoreLabel!: Label;
    private soundButton: Node | null = null;
    private soundButtonLabel: Label | null = null;
    private menuPreviewBallLayer!: Node;
    private menuThumbnailBallLayer!: Node;
    private menuStartButton!: Node;
    private menuModeButtons: Node[] = [];
    private achievementMenuProgressLabel!: Label;
    private achievementUnlockedCountLabel!: Label;
    private achievementPointsLabel!: Label;
    private achievementHiddenLabel!: Label;
    private achievementScrollShell!: Node;
    private achievementScrollOffset = 0;
    private achievementScrollMaxOffset = 0;
    private achievementScrollDragActive = false;
    private achievementScrollDragStartY = 0;
    private achievementScrollDragStartOffset = 0;

    private helperButton!: Node;
    private helperButtonLabel!: Label;
    private overlayTitleLabel!: Label;
    private overlayDetailLabel!: Label;
    private overlayStatsContainer!: Node;
    private overlayStatsNoteLabel!: Label;
    private overlayStatTitleLabels: Label[] = [];
    private overlayStatValueLabels: Label[] = [];
    private overlayPrimaryButton!: Node;
    private overlaySecondaryButton!: Node;
    private overlayTertiaryButton!: Node;
    private overlayPrimaryLabel!: Label;
    private overlaySecondaryLabel!: Label;
    private overlayTertiaryLabel!: Label;

    private overlayPrimaryAction: (() => void) | null = null;
    private overlaySecondaryAction: (() => void) | null = null;
    private overlayTertiaryAction: (() => void) | null = null;
    private settingsContinueButton!: Node;
    private settingsRestartButton!: Node;
    private settingsHomeButton!: Node;
    private settlementTitleLabel!: Label;
    private settlementNoteLabel!: Label;
    private settlementRestartButton!: Node;
    private settlementHomeButton!: Node;
    private settlementStatTitleLabels: Label[] = [];
    private settlementStatValueLabels: Label[] = [];
    private achievementCardViews: AchievementCardView[] = [];
    private achievementToastNode!: Node;
    private achievementToastTitleLabel!: Label;
    private achievementToastDetailLabel!: Label;
    private achievementToastPointsLabel!: Label;
    private achievementToastQueue: AchievementDefinition[] = [];
    private isAchievementToastPlaying = false;
    private lastBallCollisionAudioAt = 0;
    private lastRailCollisionAudioAt = 0;

    private balls: BallState[] = [];
    private pottedThisShot: BallState[] = [];
    private physicsAccumulator = 0;
    private score = 0;
    private currentBreak = 0;
    private shotsUsed = 0;
    private pottedCount = 0;
    private highScore = 0;
    private isNewHighScoreThisMatch = false;
    private soundEnabled = true;
    private helperAimEnabled = true;
    private openingCuePlacementPending = false;
    private currentAimPointerOnTable: Vec2 | null = null;
    private pocketGlowNodes: Node[] = [];
    private tableBasePosition = v3(TABLE_CENTER.x, TABLE_CENTER.y, 0);
    private topHudBasePosition = v3(0, 308, 0);
    private topHudFocusPosition = v3(0, 328, 0);
    private bottomHudBasePosition = v3(0, -308, 0);
    private bottomHudFocusPosition = v3(0, -320, 0);
    private battleReportBasePosition = v3(0, 214, 0);
    private powerFillWidth = 292;

    protected onLoad(): void {
        try {
            this.initializeRoot();
            this.loadPersistentData();
            this.audio.setEnabled(this.soundEnabled);
            this.preloadTextures();
            this.buildSceneGraph();
            this.mustFindNode(this.node, 'MenuLayer').active = true;
            this.mustFindNode(this.node, 'GameLayer').active = false;
            this.mustFindNode(this.node, 'OverlayLayer').active = false;
            this.bindPointerInput();
            this.phase = PlayPhase.Menu;
            this.refreshMenuPreview();
            this.updateGameplayPresentation();
            console.info('[SnookerGame] 首屏模式选择已完成初始化。');
        } catch (error) {
            this.showFatalError(error);
        }
    }

    protected onDestroy(): void {
        this.pointerInput?.destroy();
        this.pointerInput = null;
        this.audio.dispose();
    }

    protected update(deltaTime: number): void {
        if (this.phase !== PlayPhase.Moving) {
            return;
        }

        let strongestBallCollisionSpeed = 0;
        let strongestRailCollisionSpeed = 0;
        let ballCollisionCount = 0;
        let railCollisionCount = 0;
        this.physicsAccumulator += Math.min(deltaTime, 0.033);
        while (this.physicsAccumulator >= FIXED_TIME_STEP) {
            this.physicsAccumulator -= FIXED_TIME_STEP;
            const stepResult = this.physics.step(this.balls, POCKET_POSITIONS, FIXED_TIME_STEP);
            if (stepResult.pottedBalls.length > 0) {
                this.onBallsPotted(stepResult.pottedBalls);
            }
            strongestBallCollisionSpeed = Math.max(strongestBallCollisionSpeed, stepResult.strongestBallCollisionSpeed);
            strongestRailCollisionSpeed = Math.max(strongestRailCollisionSpeed, stepResult.strongestRailCollisionSpeed);
            ballCollisionCount += stepResult.ballCollisionCount;
            railCollisionCount += stepResult.railCollisionCount;
            this.syncBallVisuals();
        }

        this.playFramePhysicsSounds({
            pottedBalls: [],
            strongestBallCollisionSpeed,
            strongestRailCollisionSpeed,
            ballCollisionCount,
            railCollisionCount,
        });

        if (this.physics.areAllBallsStopped(this.balls)) {
            this.finishCurrentShot();
        }
    }

    private initializeRoot(): void {
        let transform = this.node.getComponent(UITransform);
        if (!transform) {
            transform = this.node.addComponent(UITransform);
        }
        transform.setContentSize(DESIGN_SIZE.width, DESIGN_SIZE.height);
        this.node.layer = Layers.Enum.UI_2D;
    }

    private loadPersistentData(): void {
        try {
            const storedHighScore = Number(sys.localStorage.getItem(HIGH_SCORE_KEY) ?? 0);
            this.highScore = Number.isFinite(storedHighScore) ? Math.max(0, storedHighScore) : 0;
            const soundRaw = sys.localStorage.getItem(SOUND_KEY);
            this.soundEnabled = soundRaw === null ? true : soundRaw === '1';
            this.achievementSystem.load();
        } catch (error) {
            this.highScore = 0;
            this.soundEnabled = true;
            this.achievementSystem.load();
            console.warn('[SnookerGame] 读取本地存档失败，已使用默认值。', error);
        }
        this.audio.setEnabled(this.soundEnabled);
    }

    private savePersistentData(): void {
        try {
            sys.localStorage.setItem(HIGH_SCORE_KEY, `${this.highScore}`);
            sys.localStorage.setItem(SOUND_KEY, this.soundEnabled ? '1' : '0');
        } catch (error) {
            console.warn('[SnookerGame] 保存本地存档失败。', error);
        }
    }

    private buildSceneGraph(): void {
        const overlayLayer = this.node.getChildByName('OverlayLayer');
        const achievementPanel = this.node.getChildByName('AchievementPanel');
        overlayLayer?.removeFromParent();
        achievementPanel?.removeFromParent();
        this.node.removeAllChildren();
        this.buildBackground();
        this.buildMenuLayerLite();
        this.buildGameLayer();
        if (achievementPanel) {
            this.node.addChild(achievementPanel);
        }
        if (overlayLayer) {
            this.node.addChild(overlayLayer);
        }
        this.buildOverlayLayer();
        this.buildAchievementPanel();
        this.buildAchievementToast();
    }

    private preloadTextures(): void {
        TextureSkinner.preload([
            'textures/ui/backdrop',
            'textures/ui/top_strip',
            'textures/ui/panel_dark',
            'textures/ui/panel_inset',
            'textures/ui/button_blue',
            'textures/ui/button_bronze',
            'textures/ui/button_green',
            'textures/ui/button_neutral',
            'textures/ui/button_red',
            'textures/table/wood_frame',
            'textures/table/felt',
            'textures/table/pocket',
        ]);
    }

    private showFatalError(error: unknown): void {
        console.error('[SnookerGame] 启动失败。', error);
        this.node.removeAllChildren();
        UiFactory.createRoundRect(this.node, 'FatalBackground', new Size(DESIGN_SIZE.width, DESIGN_SIZE.height), v3(0, 0, 0), new Color(11, 14, 12, 255));
        UiFactory.createLabel(this.node, 'FatalTitle', '启动失败', 38, v3(0, 72, 0), new Color(255, 240, 240, 255), 460, 60);
        UiFactory.createLabel(
            this.node,
            'FatalMessage',
            `初始化阶段发生异常，请查看 Creator 控制台。\n${error instanceof Error ? error.message : String(error)}`,
            22,
            v3(0, -8, 0),
            new Color(220, 222, 227, 255),
            920,
            140,
        );
    }

    private buildBackground(): void {
        const backdrop = UiFactory.ensureNode(this.node, 'BackdropLayer', v3(0, 0, 0), DESIGN_SIZE.width, DESIGN_SIZE.height);
        backdrop.removeAllChildren();
        const backdropBase = UiFactory.createRoundRect(backdrop, 'BackdropBase', new Size(DESIGN_SIZE.width, DESIGN_SIZE.height), v3(0, 0, 0), SnookerTheme.background.base);
        TextureSkinner.apply(backdropBase, 'textures/ui/backdrop', { disableGraphics: true });

        const vignetteNode = UiFactory.ensureNode(backdrop, 'BackdropVignette', v3(0, 0, 0), DESIGN_SIZE.width, DESIGN_SIZE.height);
        const vignetteGraphics = vignetteNode.getComponent(Graphics) ?? vignetteNode.addComponent(Graphics);
        vignetteGraphics.clear();
        vignetteGraphics.fillColor = SnookerTheme.background.vignette;
        vignetteGraphics.roundRect(-DESIGN_SIZE.width / 2, -DESIGN_SIZE.height / 2, DESIGN_SIZE.width, DESIGN_SIZE.height, 56);
        vignetteGraphics.fill();

        const topGlow = UiFactory.ensureNode(backdrop, 'BackdropTopGlow', v3(0, 232, 0), 980, 220);
        const topGlowGraphics = topGlow.getComponent(Graphics) ?? topGlow.addComponent(Graphics);
        topGlowGraphics.clear();
        topGlowGraphics.fillColor = withAlpha(SnookerTheme.text.accent, 18);
        topGlowGraphics.roundRect(-490, -110, 980, 220, 110);
        topGlowGraphics.fill();

        const stageGlow = UiFactory.ensureNode(backdrop, 'BackdropStageGlow', v3(0, -20, 0), 1140, 560);
        const stageGlowGraphics = stageGlow.getComponent(Graphics) ?? stageGlow.addComponent(Graphics);
        stageGlowGraphics.clear();
        stageGlowGraphics.fillColor = SnookerTheme.background.stageGlow;
        stageGlowGraphics.roundRect(-570, -280, 1140, 560, 96);
        stageGlowGraphics.fill();

        const bottomGlow = UiFactory.ensureNode(backdrop, 'BackdropBottomGlow', v3(0, -286, 0), 1040, 160);
        const bottomGlowGraphics = bottomGlow.getComponent(Graphics) ?? bottomGlow.addComponent(Graphics);
        bottomGlowGraphics.clear();
        bottomGlowGraphics.fillColor = withAlpha(SnookerTheme.table.woodHighlight, 22);
        bottomGlowGraphics.roundRect(-520, -80, 1040, 160, 68);
        bottomGlowGraphics.fill();

        backdrop.setSiblingIndex(0);
    }




    private buildMenuLayer(): void {
        this.menuLayer = UiFactory.ensureNode(this.node, 'MenuLayer', v3(0, 0, 0), DESIGN_SIZE.width, DESIGN_SIZE.height);
        this.menuLayer.removeAllChildren();
        this.menuModeButtons = [];

        const titleZone = UiFactory.createRoundRect(this.menuLayer, 'TitleZone', new Size(930, 112), v3(0, 258, 0), withAlpha(SnookerTheme.metal.darkSoft, 168), withAlpha(SnookerTheme.metal.frameBright, 92), 34);
        this.decorateLitePanel(titleZone, new Size(930, 112), 34, withAlpha(SnookerTheme.metal.darkSoft, 168), withAlpha(SnookerTheme.metal.frameBright, 92));
        this.applyTopStripSkin(titleZone);
        const title = UiFactory.createLabel(titleZone, 'Title', '斯诺克', 64, v3(0, 18, 0), SnookerTheme.text.primary, 760, 64);
        title.lineHeight = 66;
        UiFactory.createLabel(titleZone, 'Subtitle', 'SNOOKER · 选择你的开局节奏', 20, v3(0, -26, 0), SnookerTheme.text.secondary, 760, 32);

        const soundChip = this.createButton(this.menuLayer, '', v3(504, 258, 0), new Size(152, 46), 'blue', () => this.toggleSound(), { muteClickSound: true });
        this.soundButton = soundChip;
        this.soundButtonLabel = this.mustFindNode(soundChip, 'ButtonLabel').getComponent(Label)!;
        this.soundButtonLabel.fontSize = 18;
        this.syncSoundButtonState();

        const recordCard = UiFactory.createRoundRect(this.menuLayer, 'RecordCard', new Size(388, 402), v3(-330, -8, 0), withAlpha(SnookerTheme.metal.dark, 210), withAlpha(SnookerTheme.metal.frame, 120), 30);
        this.decoratePanel(recordCard, new Size(388, 402), 30, withAlpha(SnookerTheme.metal.dark, 210), withAlpha(SnookerTheme.metal.frameBright, 108));
        this.applyDarkPanelSkin(recordCard);
        UiFactory.createLabel(recordCard, 'LevelTag', '模式情报', 18, v3(-104, 156, 0), SnookerTheme.text.accent, 120, 28);
        this.menuModeLabel = UiFactory.createLabel(recordCard, 'ModeLabel', '', 18, v3(102, 156, 0), SnookerTheme.text.primary, 128, 30);
        UiFactory.createLabel(recordCard, 'RecordTitle', '当前模式', 36, v3(0, 96, 0), SnookerTheme.text.primary, 280, 46);
        this.menuGoalLabel = UiFactory.createLabel(recordCard, 'GoalLabel', '', 20, v3(0, 66, 0), SnookerTheme.text.accent, 240, 30);
        this.menuDetailLabel = UiFactory.createLabel(recordCard, 'RecordDetail', '', 18, v3(0, 20, 0), SnookerTheme.text.secondary, 308, 96);

        this.menuTargetLabel = this.createStatChip(recordCard, 'TargetChip', v3(-96, -54, 0), '红球');
        this.menuShotLimitLabel = this.createStatChip(recordCard, 'ShotChip', v3(98, -54, 0), '彩球');
        this.menuHighScoreLabel = this.createStatChip(recordCard, 'BestChip', v3(0, -120, 0), '最高分');

        const thumbShell = UiFactory.createRoundRect(recordCard, 'LayoutThumbShell', new Size(312, 106), v3(0, -176, 0), withAlpha(SnookerTheme.metal.darkSoft, 200), withAlpha(SnookerTheme.metal.frame, 90), 22);
        this.decorateInsetPlate(thumbShell, new Size(312, 106), 22, withAlpha(SnookerTheme.metal.darkSoft, 200), withAlpha(SnookerTheme.metal.frameBright, 80));
        this.applyInsetPanelSkin(thumbShell);
        UiFactory.createLabel(thumbShell, 'ThumbTitle', '开局缩略图', 16, v3(-74, 34, 0), SnookerTheme.text.secondary, 140, 24);
        const thumbTable = UiFactory.createRoundRect(thumbShell, 'LayoutThumbTable', new Size(256, 58), v3(0, -8, 0), SnookerTheme.table.woodMid, SnookerTheme.table.brass, 18);
        this.decorateWoodShell(thumbTable, new Size(256, 58), 18);
        this.applyWoodSkin(thumbTable);
        const thumbFelt = UiFactory.createRoundRect(thumbTable, 'LayoutThumbFelt', new Size(228, 34), v3(0, 0, 0), SnookerTheme.table.felt, SnookerTheme.table.feltLight, 12);
        this.decorateFeltSurface(thumbFelt, new Size(228, 34), 12);
        this.applyFeltSkin(thumbFelt);
        this.menuThumbnailBallLayer = UiFactory.ensureNode(thumbFelt, 'ThumbnailBallLayer', v3(0, 0, 0), 228, 34);

        const previewCard = UiFactory.createRoundRect(this.menuLayer, 'PreviewCard', new Size(680, 388), v3(198, -2, 0), withAlpha(SnookerTheme.metal.dark, 160), withAlpha(SnookerTheme.metal.frame, 92), 34);
        this.decorateLitePanel(previewCard, new Size(680, 388), 34, withAlpha(SnookerTheme.metal.dark, 160), withAlpha(SnookerTheme.metal.frameBright, 92));
        this.applyDarkPanelSkin(previewCard);
        UiFactory.createLabel(previewCard, 'PreviewTag', '模式选择', 18, v3(-250, 156, 0), SnookerTheme.text.accent, 120, 24);
        UiFactory.createLabel(previewCard, 'PreviewGuide', '点击任一模式按钮即可直接开局', 18, v3(32, 156, 0), SnookerTheme.text.secondary, 430, 24);

        const previewTable = UiFactory.createRoundRect(previewCard, 'PreviewTable', new Size(620, 288), v3(0, -12, 0), SnookerTheme.table.woodMid, SnookerTheme.table.brass, 34);
        this.decorateWoodShell(previewTable, new Size(620, 288), 34);
        this.applyWoodSkin(previewTable);
        const previewFelt = UiFactory.createRoundRect(previewTable, 'PreviewFelt', new Size(560, 226), v3(0, 0, 0), SnookerTheme.table.felt, SnookerTheme.table.feltLight, 22);
        this.decorateFeltSurface(previewFelt, new Size(560, 226), 22);
        this.applyFeltSkin(previewFelt);

        const previewHalo = UiFactory.ensureNode(previewFelt, 'PreviewHalo', v3(0, -10, 0), 520, 190);
        const previewHaloGraphics = previewHalo.getComponent(Graphics) ?? previewHalo.addComponent(Graphics);
        previewHaloGraphics.clear();
        previewHaloGraphics.fillColor = withAlpha(SnookerTheme.text.accent, 18);
        previewHaloGraphics.roundRect(-260, -95, 520, 190, 90);
        previewHaloGraphics.fill();
        const haloOpacity = previewHalo.getComponent(UIOpacity) ?? previewHalo.addComponent(UIOpacity);
        haloOpacity.opacity = 110;
        tween(haloOpacity)
            .repeatForever(
                tween(haloOpacity)
                    .to(1.5, { opacity: 156 })
                    .to(1.3, { opacity: 96 }),
            )
            .start();

        for (const pocket of [v2(-280, 113), v2(0, 113), v2(280, 113), v2(-280, -113), v2(0, -113), v2(280, -113)]) {
            const pocketNode = UiFactory.createCircle(previewFelt, 'PreviewPocket-' + pocket.x + '-' + pocket.y, 17, pocket, SnookerTheme.table.pocket);
            this.applyPocketSkin(pocketNode);
            this.drawCircleStroke(pocketNode, 16.5, SnookerTheme.table.pocketLip, 3);
        }

        this.createDecorativeBall(previewFelt, 'MenuRedBall', 18, v2(-234, 50), BALL_COLORS[BallType.Red], true);
        this.createDecorativeBall(previewFelt, 'MenuYellowBall', 15, v2(228, 74), BALL_COLORS[BallType.Yellow], true);
        this.createDecorativeBall(previewFelt, 'MenuCueBall', 16, v2(-146, -82), BALL_COLORS[BallType.Cue], true);
        this.createDecorativeBall(previewFelt, 'MenuBlackBall', 16, v2(174, -98), BALL_COLORS[BallType.Black], true);
        this.createDecorativeBall(previewFelt, 'MenuBlueBall', 18, v2(242, -126), BALL_COLORS[BallType.Blue], true);

        const cueNode = UiFactory.ensureNode(previewFelt, 'MenuCueStick', v3(168, -80, 0), 260, 120);
        const cueGraphics = cueNode.getComponent(Graphics) ?? cueNode.addComponent(Graphics);
        cueGraphics.clear();
        cueGraphics.lineWidth = 14;
        cueGraphics.strokeColor = new Color(163, 110, 60, 232);
        cueGraphics.moveTo(-106, -24);
        cueGraphics.lineTo(94, 40);
        cueGraphics.stroke();
        cueGraphics.lineWidth = 4;
        cueGraphics.strokeColor = withAlpha(Color.WHITE, 116);
        cueGraphics.moveTo(-106, -24);
        cueGraphics.lineTo(94, 40);
        cueGraphics.stroke();
        cueGraphics.lineWidth = 8;
        cueGraphics.strokeColor = new Color(56, 106, 188, 220);
        cueGraphics.moveTo(-110, -26);
        cueGraphics.lineTo(-90, -20);
        cueGraphics.stroke();

        this.menuPreviewBallLayer = UiFactory.ensureNode(previewFelt, 'PreviewBallLayer', v3(0, -66, 0), 540, 118);

        const casualButton = this.createModeSelectionButton(
            previewFelt,
            MATCH_MODE_CONFIGS[MatchMode.Casual],
            v3(-150, 22, 0),
            'bronze',
            () => this.startMatch(MatchMode.Casual),
        );
        const expertButton = this.createModeSelectionButton(
            previewFelt,
            MATCH_MODE_CONFIGS[MatchMode.Expert],
            v3(150, 22, 0),
            'blue',
            () => this.startMatch(MatchMode.Expert),
        );
        this.menuModeButtons = [casualButton, expertButton];
        this.menuStartButton = casualButton;

        UiFactory.createLabel(previewFelt, 'ModeTapHint', '选择模式后会直接进入对局', 17, v3(0, 96, 0), withAlpha(Color.WHITE, 180), 320, 22);

        const ruleButton = this.createButton(this.menuLayer, '规则说明', v3(468, -250, 0), new Size(178, 60), 'neutral', () => this.showRuleOverlay());
        this.emphasizeSecondaryButton(ruleButton);
        this.refreshMenuPreview();
        this.startMenuPulse();
    }

    private buildMenuLayerLite(): void {
        this.menuLayer = UiFactory.ensureNode(this.node, 'MenuLayer', v3(0, 0, 0), DESIGN_SIZE.width, DESIGN_SIZE.height);
        this.menuLayer.removeAllChildren();
        this.menuModeButtons = [];

        const menuTable = UiFactory.createRoundRect(this.menuLayer, 'MenuTable', new Size(1120, 628), v3(0, 0, 0), SnookerTheme.table.woodMid, SnookerTheme.table.brass, 44);
        this.decorateWoodShell(menuTable, new Size(1120, 628), 44);
        this.applyWoodSkin(menuTable);

        const menuFelt = UiFactory.createRoundRect(menuTable, 'MenuFelt', new Size(1034, 538), v3(0, 0, 0), SnookerTheme.table.felt, SnookerTheme.table.feltLight, 30);
        this.decorateFeltSurface(menuFelt, new Size(1034, 538), 30);
        this.applyFeltSkin(menuFelt);

        const centerGlow = UiFactory.ensureNode(menuFelt, 'MenuCenterGlow', v3(0, 8, 0), 760, 360);
        const centerGlowGraphics = centerGlow.getComponent(Graphics) ?? centerGlow.addComponent(Graphics);
        centerGlowGraphics.clear();
        centerGlowGraphics.fillColor = withAlpha(SnookerTheme.text.accent, 18);
        centerGlowGraphics.roundRect(-380, -180, 760, 360, 176);
        centerGlowGraphics.fill();

        for (const pocket of [v2(-505, 255), v2(0, 255), v2(505, 255), v2(-505, -255), v2(0, -255), v2(505, -255)]) {
            const pocketNode = UiFactory.createCircle(menuTable, `MenuPocket-${pocket.x}-${pocket.y}`, 24, pocket, SnookerTheme.table.pocket);
            this.applyPocketSkin(pocketNode);
            this.drawCircleStroke(pocketNode, 23, SnookerTheme.table.pocketLip, 4);
        }

        this.createMenuTitleEmblem(menuFelt);

        const casualButton = this.createModeSelectionButton(
            menuFelt,
            MATCH_MODE_CONFIGS[MatchMode.Casual],
            v3(-214, -8, 0),
            'bronze',
            () => this.startMatch(MatchMode.Casual),
        );
        const expertButton = this.createModeSelectionButton(
            menuFelt,
            MATCH_MODE_CONFIGS[MatchMode.Expert],
            v3(214, -8, 0),
            'blue',
            () => this.startMatch(MatchMode.Expert),
        );
        this.menuModeButtons = [casualButton, expertButton];
        this.menuStartButton = casualButton;

        this.createMenuDecorations(menuFelt);
        this.buildMenuUtilityButtons(menuTable);
        this.refreshMenuPreview();
        this.refreshAchievementPanel();
        this.startMenuPulse();
    }

    private buildMenuUtilityButtons(menuTable: Node): void {
        const progressPlate = UiFactory.createRoundRect(
            menuTable,
            'AchievementProgressPlate',
            new Size(246, 58),
            v3(-296, -272, 0),
            withAlpha(SnookerTheme.metal.darkSoft, 198),
            withAlpha(SnookerTheme.metal.frameBright, 94),
            22,
        );
        this.decorateInsetPlate(
            progressPlate,
            new Size(246, 58),
            22,
            withAlpha(SnookerTheme.metal.darkSoft, 198),
            withAlpha(SnookerTheme.metal.frameBright, 94),
        );
        this.applyInsetPanelSkin(progressPlate);
        UiFactory.createLabel(progressPlate, 'ProgressTitle', '成就进度', 16, v3(-66, 0, 0), SnookerTheme.text.secondary, 104, 24);
        this.achievementMenuProgressLabel = UiFactory.createLabel(progressPlate, 'ProgressValue', '', 20, v3(50, 0, 0), SnookerTheme.text.accent, 116, 24);
        this.achievementMenuProgressLabel.horizontalAlign = Label.HorizontalAlign.RIGHT;
        this.achievementMenuProgressLabel.string = `${this.achievementSystem.getUnlockedCount()} / ${this.achievementSystem.getTotalCount()}`;

        const achievementButton = this.createButton(menuTable, '成就馆', v3(8, -272, 0), new Size(206, 58), 'green', () => this.openAchievementPanel());
        const achievementLabel = this.mustFindNode(achievementButton, 'ButtonLabel').getComponent(Label)!;
        achievementLabel.fontSize = 24;

        const ruleButton = this.createButton(menuTable, '规则说明', v3(254, -272, 0), new Size(176, 58), 'neutral', () => this.showRuleOverlay());
        this.emphasizeSecondaryButton(ruleButton);
        this.soundButton = this.createButton(menuTable, '', v3(470, -272, 0), new Size(158, 58), 'blue', () => this.toggleSound(), { muteClickSound: true });
        this.soundButtonLabel = this.mustFindNode(this.soundButton, 'ButtonLabel').getComponent(Label)!;
        this.soundButtonLabel.fontSize = 19;
        this.syncSoundButtonState();
    }

    private buildAchievementPanel(): void {
        this.achievementPanel = this.mustFindNode(this.node, 'AchievementPanel');
        this.achievementScrollShell = this.mustFindNode(this.achievementPanel, 'AchievementGridViewport');
        this.achievementGrid = this.mustFindNode(this.achievementPanel, 'AchievementGrid');
        this.achievementUnlockedCountLabel = this.mustFindNode(this.achievementPanel, 'SummaryUnlocked-Value').getComponent(Label)!;
        this.achievementPointsLabel = this.mustFindNode(this.achievementPanel, 'SummaryPoints-Value').getComponent(Label)!;
        this.achievementHiddenLabel = this.mustFindNode(this.achievementPanel, 'SummaryHidden-Value').getComponent(Label)!;
        const mask = this.mustFindNode(this.achievementPanel, 'AchievementMask');
        const swallowPointer = (event: any) => {
            event.propagationStopped = true;
        };
        mask.on(Node.EventType.TOUCH_START, swallowPointer, this);
        mask.on(Node.EventType.TOUCH_END, swallowPointer, this);
        mask.on(Node.EventType.MOUSE_DOWN, swallowPointer, this);
        mask.on(Node.EventType.MOUSE_UP, swallowPointer, this);
        const closeButton = this.mustFindNode(this.achievementPanel, 'AchievementCloseButton');
        const closeLabel = this.mustFindNode(closeButton, 'ButtonLabel').getComponent(Label)!;
        this.attachButtonRuntime(closeButton, () => this.closeAchievementPanel());
        this.restyleButton(closeButton, closeLabel, '关闭', 'neutral');
        this.emphasizeSecondaryButton(closeButton);
        this.setupAchievementScrollShell();
        this.cacheAchievementCardViews();
        this.refreshAchievementPanel();
        this.achievementPanel.active = false;
    }

    private cacheAchievementCardViews(): void {
        this.achievementCardViews = this.achievementGrid.children
            .filter((node) => node.name.startsWith('AchievementCard-'))
            .sort((left, right) => {
                const leftIndex = Number(left.name.split('-').pop() ?? 0);
                const rightIndex = Number(right.name.split('-').pop() ?? 0);
                return leftIndex - rightIndex;
            })
            .map((root) => ({
                root,
                background: root.getComponent(Sprite),
                pointsBadge: this.mustFindNode(root, 'AchievementPointsBadge').getComponent(Sprite),
                nameLabel: this.mustFindNode(root, 'AchievementName').getComponent(Label)!,
                pointsLabel: this.mustFindNode(root, 'AchievementPointsBadge').getChildByName('AchievementPointsLabel')!.getComponent(Label)!,
                descLabel: this.mustFindNode(root, 'AchievementDesc').getComponent(Label)!,
                footerLabel: this.mustFindNode(root, 'AchievementFooter').getComponent(Label)!,
            }));
    }

    private setupAchievementScrollShell(): void {
        const mask = this.achievementScrollShell.getComponent(Mask) ?? this.achievementScrollShell.addComponent(Mask);
        mask.type = Mask.Type.RECT;

        const scrollShell = this.achievementScrollShell as Node & { __snookerAchievementScrollBound?: boolean };
        if (scrollShell.__snookerAchievementScrollBound) {
            return;
        }
        scrollShell.__snookerAchievementScrollBound = true;

        const stopEvent = (event: any) => {
            event.propagationStopped = true;
        };
        const beginDrag = (event: any) => {
            this.achievementScrollDragActive = true;
            this.achievementScrollDragStartY = event.getUILocation().y;
            this.achievementScrollDragStartOffset = this.achievementScrollOffset;
            stopEvent(event);
        };
        const updateDrag = (event: any) => {
            if (!this.achievementScrollDragActive) {
                return;
            }
            const deltaY = event.getUILocation().y - this.achievementScrollDragStartY;
            this.setAchievementScrollOffset(this.achievementScrollDragStartOffset - deltaY);
            stopEvent(event);
        };
        const endDrag = (event?: any) => {
            this.achievementScrollDragActive = false;
            if (event) {
                stopEvent(event);
            }
        };

        this.achievementScrollShell.on(Node.EventType.TOUCH_START, beginDrag, this);
        this.achievementScrollShell.on(Node.EventType.TOUCH_MOVE, updateDrag, this);
        this.achievementScrollShell.on(Node.EventType.TOUCH_END, endDrag, this);
        this.achievementScrollShell.on(Node.EventType.TOUCH_CANCEL, endDrag, this);
        this.achievementScrollShell.on(Node.EventType.MOUSE_DOWN, beginDrag, this);
        this.achievementScrollShell.on(Node.EventType.MOUSE_MOVE, updateDrag, this);
        this.achievementScrollShell.on(Node.EventType.MOUSE_UP, endDrag, this);
        this.achievementScrollShell.on(Node.EventType.MOUSE_LEAVE, endDrag, this);
        this.achievementScrollShell.on(Node.EventType.MOUSE_WHEEL, (event: any) => {
            this.scrollAchievementBy(-event.getScrollY() * 0.32);
            stopEvent(event);
        }, this);
    }

    private syncAchievementScrollBounds(): void {
        if (!this.achievementScrollShell || !this.achievementGrid) {
            return;
        }
        const viewHeight = this.achievementScrollShell.getComponent(UITransform)?.contentSize.height ?? 0;
        const contentHeight = this.achievementGrid.getComponent(UITransform)?.contentSize.height ?? 0;
        this.achievementScrollMaxOffset = Math.max(0, contentHeight - viewHeight);
        this.setAchievementScrollOffset(this.achievementScrollOffset);
    }

    private scrollAchievementToTop(): void {
        this.setAchievementScrollOffset(0);
    }

    private scrollAchievementBy(delta: number): void {
        this.setAchievementScrollOffset(this.achievementScrollOffset + delta);
    }

    private setAchievementScrollOffset(offset: number): void {
        if (!this.achievementScrollShell || !this.achievementGrid) {
            return;
        }
        const viewHeight = this.achievementScrollShell.getComponent(UITransform)?.contentSize.height ?? 0;
        const contentHeight = this.achievementGrid.getComponent(UITransform)?.contentSize.height ?? 0;
        const maxOffset = Math.max(0, contentHeight - viewHeight);
        this.achievementScrollOffset = math.clamp(offset, 0, maxOffset);
        this.achievementScrollMaxOffset = maxOffset;
        const centeredY = (viewHeight - contentHeight) * 0.5 + this.achievementScrollOffset;
        this.achievementGrid.setPosition(0, centeredY, 0);
    }

    private openAchievementPanel(): void {
        this.refreshAchievementPanel();
        this.achievementPanel.active = true;
        this.scrollAchievementToTop();
    }

    private closeAchievementPanel(): void {
        this.achievementPanel.active = false;
    }

    private refreshAchievementPanel(): void {
        if (this.achievementMenuProgressLabel) {
            this.achievementMenuProgressLabel.string = `${this.achievementSystem.getUnlockedCount()} / ${this.achievementSystem.getTotalCount()}`;
        }
        if (!this.achievementPanel || !this.achievementGrid) {
            return;
        }
        this.achievementUnlockedCountLabel.string = `${this.achievementSystem.getUnlockedCount()} / ${this.achievementSystem.getTotalCount()}`;
        this.achievementPointsLabel.string = `${this.achievementSystem.getUnlockedPoints()} / ${this.achievementSystem.getTotalPoints()}`;
        this.achievementHiddenLabel.string = `${this.achievementSystem.getUnlockedHiddenCount()} / ${this.achievementSystem.getHiddenCount()}`;
        const definitions = this.achievementSystem.getDefinitions();
        this.achievementCardViews.forEach((view, index) => {
            const definition = definitions[index];
            view.root.active = !!definition;
            if (!definition) {
                return;
            }
            const unlockState = this.achievementSystem.getUnlockState(definition.id);
            const unlocked = !!unlockState;
            const displayName = unlocked || !definition.hidden ? definition.name : '???';
            const description = unlocked || !definition.hidden ? definition.description : '继续突破更多挑战后解锁。';

            if (view.background) {
                view.background.color = unlocked
                    ? withAlpha(new Color(36, 92, 64, 240), 240)
                    : withAlpha(SnookerTheme.metal.dark, 214);
            }
            if (view.pointsBadge) {
                view.pointsBadge.color = unlocked
                    ? withAlpha(SnookerTheme.table.brass, 208)
                    : withAlpha(SnookerTheme.metal.darkSoft, 210);
            }
            view.nameLabel.string = displayName;
            view.nameLabel.color = SnookerTheme.text.primary;
            view.pointsLabel.string = `${definition.points}`;
            view.pointsLabel.color = unlocked ? SnookerTheme.metal.dark : SnookerTheme.text.secondary;
            view.descLabel.string = description;
            view.descLabel.color = unlocked ? withAlpha(SnookerTheme.text.primary, 214) : SnookerTheme.text.secondary;
            view.footerLabel.string = unlocked ? `已解锁 · ${definition.rarity}` : this.getAchievementCardFooter(definition);
            view.footerLabel.color = unlocked ? SnookerTheme.text.success : SnookerTheme.text.accent;
        });
        this.syncAchievementScrollBounds();
    }

    private getAchievementCardFooter(definition: AchievementDefinition): string {
        const modeText = definition.modeLimit === 'all'
            ? '双模式'
            : definition.modeLimit === MatchMode.Casual
                ? '休闲限定'
                : '专家限定';
        const target = definition.modeLimit === 'all'
            ? definition.targetByMode
                ? `休闲 ${getAchievementTarget(definition, MatchMode.Casual)} / 专家 ${getAchievementTarget(definition, MatchMode.Expert)}`
                : `${definition.targetValue ?? 1}`
            : `${getAchievementTarget(definition, definition.modeLimit) ?? 1}`;
        return `${modeText} · ${target}`;
    }

    private buildAchievementToast(): void {
        this.achievementToastNode = UiFactory.createRoundRect(
            this.node,
            'AchievementToast',
            new Size(360, 84),
            v3(0, 296, 0),
            withAlpha(SnookerTheme.metal.dark, 232),
            withAlpha(SnookerTheme.table.brass, 126),
            22,
        );
        this.decorateLitePanel(
            this.achievementToastNode,
            new Size(360, 84),
            22,
            withAlpha(SnookerTheme.metal.dark, 232),
            withAlpha(SnookerTheme.table.brass, 126),
        );
        this.applyTopStripSkin(this.achievementToastNode);
        const opacity = this.achievementToastNode.getComponent(UIOpacity) ?? this.achievementToastNode.addComponent(UIOpacity);
        opacity.opacity = 0;
        this.achievementToastTitleLabel = UiFactory.createLabel(this.achievementToastNode, 'AchievementToastTitle', '成就解锁', 16, v3(-82, 16, 0), SnookerTheme.text.accent, 136, 20);
        this.achievementToastTitleLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.achievementToastDetailLabel = UiFactory.createLabel(this.achievementToastNode, 'AchievementToastDetail', '', 24, v3(-24, -10, 0), SnookerTheme.text.primary, 198, 30);
        this.achievementToastDetailLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.achievementToastPointsLabel = UiFactory.createLabel(this.achievementToastNode, 'AchievementToastPoints', '', 20, v3(120, 0, 0), SnookerTheme.text.success, 92, 28);
        this.achievementToastPointsLabel.horizontalAlign = Label.HorizontalAlign.RIGHT;
        this.achievementToastNode.active = false;
    }

    private queueAchievementToasts(definitions: AchievementDefinition[]): void {
        if (definitions.length === 0) {
            return;
        }
        this.achievementToastQueue.push(...definitions);
        this.refreshAchievementPanel();
        this.playNextAchievementToast();
    }

    private playNextAchievementToast(): void {
        if (this.isAchievementToastPlaying || this.achievementToastQueue.length === 0 || !this.achievementToastNode) {
            return;
        }
        const definition = this.achievementToastQueue.shift();
        if (!definition) {
            return;
        }
        this.isAchievementToastPlaying = true;
        this.achievementToastTitleLabel.string = '成就解锁';
        this.achievementToastDetailLabel.string = definition.name;
        this.achievementToastPointsLabel.string = `+${definition.points}`;
        this.achievementToastNode.active = true;
        this.audio.play('achievement', { intensity: 0.94 });
        this.achievementToastNode.setPosition(0, 296, 0);
        const opacity = this.achievementToastNode.getComponent(UIOpacity) ?? this.achievementToastNode.addComponent(UIOpacity);
        opacity.opacity = 0;
        Tween.stopAllByTarget(this.achievementToastNode);
        Tween.stopAllByTarget(opacity);
        tween(opacity)
            .to(0.18, { opacity: 255 })
            .delay(1.45)
            .to(0.22, { opacity: 0 })
            .call(() => {
                this.achievementToastNode.active = false;
                this.isAchievementToastPlaying = false;
                this.playNextAchievementToast();
            })
            .start();
        tween(this.achievementToastNode)
            .to(0.18, { position: v3(0, 260, 0) })
            .delay(1.45)
            .to(0.22, { position: v3(0, 244, 0) })
            .start();
    }

    private createMenuTitleEmblem(parent: Node): void {
        const titleShadow = UiFactory.createLabel(parent, 'MenuTitleShadow', '斯诺克', 78, v3(0, 170, 0), withAlpha(new Color(54, 26, 10, 220), 220), 520, 86);
        titleShadow.node.setPosition(0, 162, 0);
        titleShadow.lineHeight = 84;

        const title = UiFactory.createLabel(parent, 'MenuTitle', '斯诺克', 78, v3(0, 170, 0), SnookerTheme.text.accent, 520, 86);
        title.lineHeight = 84;

        const crownArc = UiFactory.ensureNode(parent, 'MenuTitleArc', v3(0, 146, 0), 520, 96);
        const crownArcGraphics = crownArc.getComponent(Graphics) ?? crownArc.addComponent(Graphics);
        crownArcGraphics.clear();
        crownArcGraphics.lineWidth = 6;
        crownArcGraphics.strokeColor = withAlpha(SnookerTheme.table.brass, 224);
        crownArcGraphics.moveTo(-206, -4);
        crownArcGraphics.bezierCurveTo(-150, 42, -76, 54, 0, 46);
        crownArcGraphics.bezierCurveTo(76, 54, 150, 42, 206, -4);
        crownArcGraphics.stroke();

        const ribbon = UiFactory.createRoundRect(parent, 'MenuTitleRibbon', new Size(336, 72), v3(0, 86, 0), withAlpha(new Color(20, 96, 68, 232), 232), withAlpha(SnookerTheme.table.brass, 164), 30);
        this.decorateLitePanel(ribbon, new Size(336, 72), 30, withAlpha(new Color(20, 96, 68, 232), 232), withAlpha(SnookerTheme.table.brass, 164));
        this.applyTopStripSkin(ribbon);
        const ribbonLabel = UiFactory.createLabel(ribbon, 'RibbonLabel', 'SNOOKER', 26, v3(0, 0, 0), SnookerTheme.text.accent, 280, 34);
        ribbonLabel.lineHeight = 28;

        for (const x of [-244, 244]) {
            const wing = UiFactory.ensureNode(parent, `MenuWing-${x}`, v3(x, 95, 0), 112, 86);
            const wingGraphics = wing.getComponent(Graphics) ?? wing.addComponent(Graphics);
            wingGraphics.clear();
            wingGraphics.lineWidth = 4;
            wingGraphics.strokeColor = withAlpha(SnookerTheme.table.brass, 210);
            for (let index = 0; index < 4; index += 1) {
                const direction = x < 0 ? 1 : -1;
                const leafX = direction * (index * 11);
                const leafY = 20 - index * 12;
                wingGraphics.moveTo(0, leafY);
                wingGraphics.bezierCurveTo(leafX + direction * 10, leafY + 12, leafX + direction * 22, leafY + 4, leafX + direction * 28, leafY - 8);
            }
            wingGraphics.stroke();
        }

        this.createMenuSparkle(parent, 'MenuSparkleTopLeft', v3(-106, 196, 0), 11);
        this.createMenuSparkle(parent, 'MenuSparkleTopRight', v3(112, 204, 0), 9);
        this.createMenuSparkle(parent, 'MenuSparkleRibbonLeft', v3(-188, 116, 0), 7);
        this.createMenuSparkle(parent, 'MenuSparkleRibbonRight', v3(186, 102, 0), 6);
    }

    private createMenuDecorations(parent: Node): void {
        this.createDecorativeBall(parent, 'MenuRedBallTop', 20, v2(-414, 126), BALL_COLORS[BallType.Red], true);
        this.createDecorativeBall(parent, 'MenuYellowBallTop', 18, v2(424, 146), BALL_COLORS[BallType.Yellow], true);
        this.createDecorativeBall(parent, 'MenuCueBallLeft', 20, v2(-324, -176), BALL_COLORS[BallType.Cue], true);
        this.createDecorativeBall(parent, 'MenuBlackBall', 19, v2(372, -196), BALL_COLORS[BallType.Black], true);
        this.createDecorativeBall(parent, 'MenuBlueBall', 22, v2(466, -216), BALL_COLORS[BallType.Blue], true);

        const redCluster = [
            v2(444, -142),
            v2(476, -128),
            v2(506, -116),
            v2(430, -176),
            v2(462, -164),
            v2(492, -152),
            v2(524, -138),
            v2(448, -208),
            v2(480, -196),
        ];
        redCluster.forEach((position, index) => {
            this.createDecorativeBall(parent, `MenuClusterRed-${index}`, 19, position, BALL_COLORS[BallType.Red], true);
        });

        const cueNode = UiFactory.ensureNode(parent, 'MenuCueStick', v3(334, -166, 0), 410, 144);
        const cueGraphics = cueNode.getComponent(Graphics) ?? cueNode.addComponent(Graphics);
        cueGraphics.clear();
        cueGraphics.lineWidth = 18;
        cueGraphics.strokeColor = new Color(160, 108, 58, 236);
        cueGraphics.moveTo(-172, -18);
        cueGraphics.lineTo(158, 70);
        cueGraphics.stroke();
        cueGraphics.lineWidth = 5;
        cueGraphics.strokeColor = withAlpha(Color.WHITE, 128);
        cueGraphics.moveTo(-172, -18);
        cueGraphics.lineTo(158, 70);
        cueGraphics.stroke();
        cueGraphics.lineWidth = 10;
        cueGraphics.strokeColor = new Color(58, 102, 180, 236);
        cueGraphics.moveTo(-182, -20);
        cueGraphics.lineTo(-146, -10);
        cueGraphics.stroke();
    }

    private createMenuSparkle(parent: Node, name: string, position: Vec3, radius: number): void {
        const sparkle = UiFactory.ensureNode(parent, name, position, radius * 4, radius * 4);
        const sparkleGraphics = sparkle.getComponent(Graphics) ?? sparkle.addComponent(Graphics);
        sparkleGraphics.clear();
        sparkleGraphics.lineWidth = 2;
        sparkleGraphics.strokeColor = withAlpha(SnookerTheme.text.accent, 208);
        sparkleGraphics.moveTo(0, radius);
        sparkleGraphics.lineTo(0, -radius);
        sparkleGraphics.moveTo(-radius, 0);
        sparkleGraphics.lineTo(radius, 0);
        sparkleGraphics.stroke();
        sparkleGraphics.lineWidth = 1.2;
        sparkleGraphics.moveTo(-radius * 0.7, radius * 0.7);
        sparkleGraphics.lineTo(radius * 0.7, -radius * 0.7);
        sparkleGraphics.moveTo(radius * 0.7, radius * 0.7);
        sparkleGraphics.lineTo(-radius * 0.7, -radius * 0.7);
        sparkleGraphics.stroke();
    }

    private buildGameLayer(): void {
        this.gameLayer = UiFactory.ensureNode(this.node, 'GameLayer', v3(0, 0, 0), DESIGN_SIZE.width, DESIGN_SIZE.height);
        this.gameLayer.removeAllChildren();

        this.tableRoot = UiFactory.ensureNode(this.gameLayer, 'TableRoot', this.tableBasePosition, TABLE_OUTER_WIDTH, TABLE_OUTER_HEIGHT);
        this.tableRoot.removeAllChildren();
        this.buildTableVisuals();

        this.topHud = UiFactory.ensureNode(this.gameLayer, 'TopHud', this.topHudBasePosition, 1160, 74);
        this.topHud.removeAllChildren();
        this.buildTopHud();

        this.bottomHud = UiFactory.ensureNode(this.gameLayer, 'BottomHud', this.bottomHudBasePosition, 1160, 92);
        this.bottomHud.removeAllChildren();
        this.buildBottomHud();

        this.battleReportNode = UiFactory.createRoundRect(this.gameLayer, 'BattleReport', new Size(428, 54), this.battleReportBasePosition, withAlpha(SnookerTheme.metal.darkSoft, 220), withAlpha(SnookerTheme.metal.frameBright, 110), 22);
        this.decorateLitePanel(this.battleReportNode, new Size(428, 54), 22, withAlpha(SnookerTheme.metal.darkSoft, 220), withAlpha(SnookerTheme.metal.frameBright, 110));
        this.applyTopStripSkin(this.battleReportNode);
        this.battleReportNode.active = false;
        this.battleReportOpacity = this.battleReportNode.getComponent(UIOpacity) ?? this.battleReportNode.addComponent(UIOpacity);
        this.battleReportOpacity.opacity = 0;
        const battleLabel = UiFactory.createLabel(this.battleReportNode, 'BattleReportLabel', '', 18, v3(0, 0, 0), SnookerTheme.text.primary, 392, 34);
        battleLabel.lineHeight = 22;

        this.touchLayer = UiFactory.ensureNode(this.gameLayer, 'TouchLayer', v3(0, 0, 0), DESIGN_SIZE.width, DESIGN_SIZE.height);
        (this.touchLayer.getComponent(UIOpacity) ?? this.touchLayer.addComponent(UIOpacity)).opacity = 1;
        // 触控层只负责接球桌区域手势，必须放在 HUD 下方，避免吃掉按钮点击。
        this.tableRoot.setSiblingIndex(0);
        this.battleReportNode.setSiblingIndex(1);
        this.touchLayer.setSiblingIndex(2);
        this.topHud.setSiblingIndex(3);
        this.bottomHud.setSiblingIndex(4);

        this.gameLayer.active = false;
        this.renderPowerBar(0);
        this.updatePowerDescriptor(0);
        this.updateGameplayPresentation();
    }

    private buildTopHud(): void {
        const shell = UiFactory.createRoundRect(this.topHud, 'TopHudShell', new Size(1148, 72), v3(0, 0, 0), withAlpha(SnookerTheme.metal.darkSoft, 160), withAlpha(SnookerTheme.metal.frameBright, 80), 28);
        this.decorateLitePanel(shell, new Size(1148, 72), 28, withAlpha(SnookerTheme.metal.darkSoft, 160), withAlpha(SnookerTheme.metal.frameBright, 80));
        this.applyTopStripSkin(shell);

        const playerCard = UiFactory.createRoundRect(this.topHud, 'PlayerCard', new Size(300, 62), v3(-396, 0, 0), withAlpha(SnookerTheme.metal.dark, 186), withAlpha(SnookerTheme.metal.frame, 80), 22);
        this.decorateInsetPlate(playerCard, new Size(300, 62), 22, withAlpha(SnookerTheme.metal.dark, 186), withAlpha(SnookerTheme.metal.frameBright, 90));
        this.applyDarkPanelSkin(playerCard);
        this.createHudBadge(playerCard, 'PlayerBadge', v3(-112, 0, 0), 'P1', SnookerTheme.text.primary, SnookerTheme.button.blue);
        const scoreTitle = UiFactory.createLabel(playerCard, 'ScoreTitle', '玩家得分', 15, v3(6, 12, 0), SnookerTheme.text.secondary, 150, 20);
        scoreTitle.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.scoreLabel = UiFactory.createLabel(playerCard, 'ScoreLabel', '0', 34, v3(-8, -12, 0), SnookerTheme.text.primary, 130, 36);
        this.scoreLabel.horizontalAlign = Label.HorizontalAlign.LEFT;

        const breakPill = UiFactory.createRoundRect(playerCard, 'BreakPill', new Size(102, 34), v3(92, 0, 0), withAlpha(SnookerTheme.metal.darkSoft, 220), withAlpha(SnookerTheme.metal.frameBright, 64), 17);
        this.decorateInsetPlate(breakPill, new Size(102, 34), 17, withAlpha(SnookerTheme.metal.darkSoft, 220), withAlpha(SnookerTheme.metal.frameBright, 60));
        this.applyInsetPanelSkin(breakPill);
        UiFactory.createLabel(breakPill, 'BreakTag', 'BREAK', 13, v3(-16, 0, 0), SnookerTheme.text.secondary, 50, 18);
        this.breakLabel = UiFactory.createLabel(breakPill, 'BreakValue', '0', 18, v3(26, 0, 0), SnookerTheme.text.accent, 36, 20);

        const progressCard = UiFactory.createRoundRect(this.topHud, 'ProgressCard', new Size(424, 62), v3(24, 0, 0), withAlpha(SnookerTheme.metal.dark, 176), withAlpha(SnookerTheme.metal.frame, 74), 22);
        this.decorateInsetPlate(progressCard, new Size(424, 62), 22, withAlpha(SnookerTheme.metal.dark, 176), withAlpha(SnookerTheme.metal.frameBright, 84));
        this.applyDarkPanelSkin(progressCard);
        this.stageLabel = UiFactory.createLabel(progressCard, 'StageLabel', '', 24, v3(0, 15, 0), SnookerTheme.text.primary, 300, 26);
        this.shotsLabel = UiFactory.createLabel(progressCard, 'ShotsLabel', '', 18, v3(0, -6, 0), SnookerTheme.text.accent, 360, 22);
        this.targetHintLabel = UiFactory.createLabel(progressCard, 'TargetHintLabel', '', 16, v3(0, -26, 0), SnookerTheme.text.secondary, 360, 20);

        const settlementTestButton = this.createButton(this.topHud, '结算', v3(406, 0, 0), new Size(116, 54), 'bronze', () => this.showSettlementPreview());
        const settlementTestLabel = this.mustFindNode(settlementTestButton, 'ButtonLabel').getComponent(Label)!;
        settlementTestLabel.fontSize = 20;
        this.createButton(this.topHud, '||', v3(520, 0, 0), new Size(72, 54), 'blue', () => this.togglePause());
    }

    private buildBottomHud(): void {
        const shell = UiFactory.createRoundRect(this.bottomHud, 'BottomHudShell', new Size(1148, 88), v3(0, 0, 0), withAlpha(SnookerTheme.metal.darkSoft, 158), withAlpha(SnookerTheme.metal.frameBright, 76), 28);
        this.decorateLitePanel(shell, new Size(1148, 88), 28, withAlpha(SnookerTheme.metal.darkSoft, 158), withAlpha(SnookerTheme.metal.frameBright, 76));
        this.applyTopStripSkin(shell);

        const powerCard = UiFactory.createRoundRect(this.bottomHud, 'PowerCard', new Size(392, 62), v3(-336, 0, 0), withAlpha(SnookerTheme.metal.dark, 184), withAlpha(SnookerTheme.metal.frame, 70), 22);
        this.decorateInsetPlate(powerCard, new Size(392, 62), 22, withAlpha(SnookerTheme.metal.dark, 184), withAlpha(SnookerTheme.metal.frameBright, 80));
        this.applyDarkPanelSkin(powerCard);
        UiFactory.createLabel(powerCard, 'PowerTitle', '力度', 18, v3(-152, 0, 0), SnookerTheme.text.primary, 70, 24);
        const powerBarBg = UiFactory.createRoundRect(powerCard, 'PowerBarBg', new Size(308, 24), v3(16, -4, 0), new Color(20, 24, 24, 255), withAlpha(SnookerTheme.metal.frameBright, 64), 12);
        this.decoratePowerBar(powerBarBg, new Size(308, 24));
        this.applyInsetPanelSkin(powerBarBg, 24);
        const powerFill = UiFactory.ensureNode(powerBarBg, 'PowerFill', v3(0, 0, 0), this.powerFillWidth, 18);
        this.powerFillGraphics = powerFill.getComponent(Graphics) ?? powerFill.addComponent(Graphics);
        this.powerValueLabel = UiFactory.createLabel(powerCard, 'PowerValue', '0%', 19, v3(150, 16, 0), SnookerTheme.text.accent, 84, 22);
        this.powerBandLabel = UiFactory.createLabel(powerCard, 'PowerBand', '轻推', 17, v3(152, -18, 0), SnookerTheme.text.secondary, 84, 22);

        const statusCard = UiFactory.createRoundRect(this.bottomHud, 'StatusCard', new Size(448, 62), v3(80, 0, 0), withAlpha(SnookerTheme.metal.dark, 184), withAlpha(SnookerTheme.metal.frame, 70), 22);
        this.decorateInsetPlate(statusCard, new Size(448, 62), 22, withAlpha(SnookerTheme.metal.dark, 184), withAlpha(SnookerTheme.metal.frameBright, 80));
        this.applyDarkPanelSkin(statusCard);
        UiFactory.createLabel(statusCard, 'StatusTitle', '当前提示', 17, v3(-158, 0, 0), SnookerTheme.text.accent, 92, 22);
        this.statusLabel = UiFactory.createLabel(statusCard, 'StatusLabel', '拖动白球后方开始瞄准。', 18, v3(28, 0, 0), SnookerTheme.text.primary, 296, 40);

        this.helperButton = this.createButton(this.bottomHud, '辅助线：开', v3(468, 0, 0), new Size(170, 54), 'blue', () => this.toggleHelperAim());
        this.helperButtonLabel = this.mustFindNode(this.helperButton, 'ButtonLabel').getComponent(Label)!;
    }

    private buildTableVisuals(): void {
        this.pocketGlowNodes = [];
        const outer = UiFactory.createRoundRect(this.tableRoot, 'TableOuter', new Size(TABLE_OUTER_WIDTH, TABLE_OUTER_HEIGHT), v3(0, 0, 0), SnookerTheme.table.woodMid, SnookerTheme.table.brass, 38);
        this.decorateWoodShell(outer, new Size(TABLE_OUTER_WIDTH, TABLE_OUTER_HEIGHT), 38);
        this.applyWoodSkin(outer);
        const felt = UiFactory.createRoundRect(outer, 'TableFelt', new Size(TABLE_INNER_WIDTH, TABLE_INNER_HEIGHT), v3(0, 0, 0), SnookerTheme.table.felt, SnookerTheme.table.feltLight, 24);
        this.decorateFeltSurface(felt, new Size(TABLE_INNER_WIDTH, TABLE_INNER_HEIGHT), 24);
        this.applyFeltSkin(felt);

        const guideNode = UiFactory.ensureNode(felt, 'TableGuideLines', v3(0, 0, 0), TABLE_INNER_WIDTH, TABLE_INNER_HEIGHT);
        const guideGraphics = guideNode.getComponent(Graphics) ?? guideNode.addComponent(Graphics);
        guideGraphics.clear();
        guideGraphics.strokeColor = SnookerTheme.table.guideLine;
        guideGraphics.lineWidth = 2;
        guideGraphics.moveTo(-TABLE_INNER_WIDTH / 2 + 190, -TABLE_INNER_HEIGHT / 2 + 20);
        guideGraphics.lineTo(-TABLE_INNER_WIDTH / 2 + 190, TABLE_INNER_HEIGHT / 2 - 20);
        guideGraphics.stroke();
        guideGraphics.circle(-TABLE_INNER_WIDTH / 2 + 190, 0, 78);
        guideGraphics.stroke();

        for (let index = 0; index < POCKET_POSITIONS.length; index++) {
            const pocket = UiFactory.createCircle(felt, `Pocket-${index}`, 22, POCKET_POSITIONS[index], SnookerTheme.table.pocket);
            this.applyPocketSkin(pocket);
            this.drawCircleStroke(pocket, 21, SnookerTheme.table.pocketLip, 4);
            const pocketGlow = UiFactory.createCircle(pocket, 'PocketGlow', 26, v2(0, 0), withAlpha(SnookerTheme.text.accent, 32), 0);
            pocketGlow.setScale(1.34, 1.34, 1);
            this.pocketGlowNodes.push(pocketGlow);
        }

        this.tableBallLayer = UiFactory.ensureNode(felt, 'BallLayer', v3(0, 0, 0), TABLE_INNER_WIDTH, TABLE_INNER_HEIGHT);
        const aimNode = UiFactory.ensureNode(felt, 'AimGraphics', v3(0, 0, 0), TABLE_INNER_WIDTH, TABLE_INNER_HEIGHT);
        this.aimGraphics = aimNode.getComponent(Graphics) ?? aimNode.addComponent(Graphics);
        const cueNode = UiFactory.ensureNode(felt, 'CueGraphics', v3(0, 0, 0), TABLE_INNER_WIDTH, TABLE_INNER_HEIGHT);
        this.cueGraphics = cueNode.getComponent(Graphics) ?? cueNode.addComponent(Graphics);
        this.fxLayer = UiFactory.ensureNode(felt, 'FxLayer', v3(0, 0, 0), TABLE_INNER_WIDTH, TABLE_INNER_HEIGHT);
    }

    private buildOverlayLayer(): void {
        this.overlayLayer = this.mustFindNode(this.node, 'OverlayLayer');
        this.messagePanel = this.mustFindNode(this.overlayLayer, 'OverlayPanel');
        this.settingsPanel = this.mustFindNode(this.overlayLayer, 'SettingsPanel');
        this.settlementPanel = this.mustFindNode(this.overlayLayer, 'SettlementPanel');

        const mask = this.mustFindNode(this.overlayLayer, 'OverlayMask');
        const swallowPointer = (event: any) => {
            event.propagationStopped = true;
        };
        mask.on(Node.EventType.TOUCH_START, swallowPointer, this);
        mask.on(Node.EventType.TOUCH_END, swallowPointer, this);
        mask.on(Node.EventType.MOUSE_DOWN, swallowPointer, this);
        mask.on(Node.EventType.MOUSE_UP, swallowPointer, this);

        this.overlayTitleLabel = this.mustFindNode(this.messagePanel, 'OverlayTitle').getComponent(Label)!;
        this.overlayDetailLabel = this.mustFindNode(this.messagePanel, 'OverlayDetail').getComponent(Label)!;
        this.overlayStatsContainer = this.mustFindNode(this.messagePanel, 'OverlayStatsContainer');
        this.overlayStatsNoteLabel = this.mustFindNode(this.messagePanel, 'OverlayStatsNote').getComponent(Label)!;

        this.overlayPrimaryButton = this.mustFindNode(this.messagePanel, 'OverlayPrimaryButton');
        this.overlayPrimaryLabel = this.mustFindNode(this.overlayPrimaryButton, 'ButtonLabel').getComponent(Label)!;
        this.attachButtonRuntime(this.overlayPrimaryButton, () => this.overlayPrimaryAction?.());
        this.restyleButton(this.overlayPrimaryButton, this.overlayPrimaryLabel, '知道了', 'blue');

        this.overlaySecondaryButton = this.mustFindNode(this.messagePanel, 'OverlaySecondaryButton');
        this.overlaySecondaryLabel = this.mustFindNode(this.overlaySecondaryButton, 'ButtonLabel').getComponent(Label)!;
        this.attachButtonRuntime(this.overlaySecondaryButton, () => this.overlaySecondaryAction?.());
        this.restyleButton(this.overlaySecondaryButton, this.overlaySecondaryLabel, '次要操作', 'green');

        this.overlayTertiaryButton = this.mustFindNode(this.messagePanel, 'OverlayTertiaryButton');
        this.overlayTertiaryLabel = this.mustFindNode(this.overlayTertiaryButton, 'ButtonLabel').getComponent(Label)!;
        this.attachButtonRuntime(this.overlayTertiaryButton, () => this.overlayTertiaryAction?.());
        this.restyleButton(this.overlayTertiaryButton, this.overlayTertiaryLabel, '关闭', 'neutral');

        this.settingsContinueButton = this.mustFindNode(this.settingsPanel, 'SettingsContinueButton');
        this.attachButtonRuntime(this.settingsContinueButton, () => undefined);
        this.restyleButton(
            this.settingsContinueButton,
            this.mustFindNode(this.settingsContinueButton, 'ButtonLabel').getComponent(Label)!,
            '继续游戏',
            'blue',
        );
        this.settingsRestartButton = this.mustFindNode(this.settingsPanel, 'SettingsRestartButton');
        this.attachButtonRuntime(this.settingsRestartButton, () => undefined);
        this.restyleButton(
            this.settingsRestartButton,
            this.mustFindNode(this.settingsRestartButton, 'ButtonLabel').getComponent(Label)!,
            '重开本局',
            'red',
        );
        this.settingsHomeButton = this.mustFindNode(this.settingsPanel, 'SettingsHomeButton');
        this.attachButtonRuntime(this.settingsHomeButton, () => undefined);
        this.restyleButton(
            this.settingsHomeButton,
            this.mustFindNode(this.settingsHomeButton, 'ButtonLabel').getComponent(Label)!,
            '返回主页',
            'neutral',
        );

        this.settlementTitleLabel = this.mustFindNode(this.settlementPanel, 'SettlementTitle').getComponent(Label)!;
        this.settlementNoteLabel = this.mustFindNode(this.settlementPanel, 'SettlementNote').getComponent(Label)!;
        this.settlementStatTitleLabels = [];
        this.settlementStatValueLabels = [];
        for (let index = 0; index < 5; index += 1) {
            this.settlementStatTitleLabels.push(this.mustFindNode(this.settlementPanel, `SettlementStatTitle-${index}`).getComponent(Label)!);
            this.settlementStatValueLabels.push(this.mustFindNode(this.settlementPanel, `SettlementStatValue-${index}`).getComponent(Label)!);
        }
        this.settlementRestartButton = this.mustFindNode(this.settlementPanel, 'SettlementRestartButton');
        this.attachButtonRuntime(this.settlementRestartButton, () => undefined);
        this.restyleButton(
            this.settlementRestartButton,
            this.mustFindNode(this.settlementRestartButton, 'ButtonLabel').getComponent(Label)!,
            '再来一局',
            'green',
        );
        this.settlementHomeButton = this.mustFindNode(this.settlementPanel, 'SettlementHomeButton');
        this.attachButtonRuntime(this.settlementHomeButton, () => undefined);
        this.restyleButton(
            this.settlementHomeButton,
            this.mustFindNode(this.settlementHomeButton, 'ButtonLabel').getComponent(Label)!,
            '返回菜单',
            'neutral',
        );

        this.messagePanel.active = false;
        this.settingsPanel.active = false;
        this.settlementPanel.active = false;
        this.overlayLayer.active = false;
    }

    private ensureOverlayButton(
        parent: Node,
        name: string,
        text: string,
        position: Vec3,
        size: Size,
        style: ButtonStyle,
        onClick: () => void,
    ): { button: Node; label: Label } {
        let button = parent.getChildByName(name);
        if (!button) {
            button = this.createButton(parent, text, position, size, style, onClick);
            button.name = name;
        } else {
            button.setPosition(position);
            const transform = button.getComponent(UITransform) ?? button.addComponent(UITransform);
            transform.setContentSize(size.width, size.height);
        }
        const label = UiFactory.createLabel(button, 'ButtonLabel', text, 21, v3(0, 0, 0), SnookerTheme.text.primary, size.width - 24, size.height - 8);
        this.attachButtonRuntime(button, onClick);
        this.restyleButton(button, label, text, style);
        return { button, label };
    }

    private decoratePanel(node: Node, size: Size, radius: number, fillColor: Color, frameColor: Color): void {
        if (node.getComponent(Sprite)) {
            return;
        }
        UiFactory.createRoundRect(node, 'PanelShadow', new Size(size.width + 12, size.height + 12), v3(0, -5, 0), withAlpha(SnookerTheme.metal.shadow, 110), undefined, radius + 6, 170);
        UiFactory.createRoundRect(node, 'PanelInner', new Size(size.width - 14, size.height - 14), v3(0, 0, 0), shiftColor(fillColor, 6), withAlpha(frameColor, 90), Math.max(10, radius - 8));
        const glossNode = UiFactory.ensureNode(node, 'PanelGloss', v3(0, size.height * 0.18, 0), size.width - 34, Math.max(18, size.height * 0.2));
        const glossGraphics = glossNode.getComponent(Graphics) ?? glossNode.addComponent(Graphics);
        glossGraphics.clear();
        glossGraphics.fillColor = SnookerTheme.metal.glass;
        glossGraphics.roundRect(-(size.width - 34) / 2, -Math.max(18, size.height * 0.2) / 2, size.width - 34, Math.max(18, size.height * 0.2), Math.max(10, radius - 12));
        glossGraphics.fill();
    }

    private decorateLitePanel(node: Node, size: Size, radius: number, fillColor: Color, frameColor: Color): void {
        if (node.getComponent(Sprite)) {
            return;
        }
        UiFactory.createRoundRect(node, 'LiteShadow', new Size(size.width + 8, size.height + 8), v3(0, -4, 0), withAlpha(SnookerTheme.metal.shadow, 72), undefined, radius + 4, 100);
        UiFactory.createRoundRect(node, 'LiteInner', new Size(size.width - 12, size.height - 12), v3(0, 0, 0), shiftColor(fillColor, 4), withAlpha(frameColor, 58), Math.max(8, radius - 8));
    }

    private decorateInsetPlate(node: Node, size: Size, radius: number, fillColor: Color, frameColor: Color): void {
        if (node.getComponent(Sprite)) {
            return;
        }
        UiFactory.createRoundRect(node, 'InsetShadow', new Size(size.width + 8, size.height + 8), v3(0, -3, 0), withAlpha(SnookerTheme.metal.shadow, 84), undefined, radius + 4, 120);
        UiFactory.createRoundRect(node, 'InsetCore', new Size(size.width - 10, size.height - 10), v3(0, 0, 0), shiftColor(fillColor, 8), withAlpha(frameColor, 76), Math.max(8, radius - 5));
        const shineNode = UiFactory.ensureNode(node, 'InsetShine', v3(0, size.height * 0.16, 0), size.width - 24, Math.max(12, size.height * 0.22));
        const shineGraphics = shineNode.getComponent(Graphics) ?? shineNode.addComponent(Graphics);
        shineGraphics.clear();
        shineGraphics.fillColor = withAlpha(Color.WHITE, 14);
        shineGraphics.roundRect(-(size.width - 24) / 2, -Math.max(12, size.height * 0.22) / 2, size.width - 24, Math.max(12, size.height * 0.22), Math.max(8, radius - 8));
        shineGraphics.fill();
    }

    private decorateButton(node: Node, size: Size, fillColor: Color): void {
        if (node.getComponent(Sprite)) {
            return;
        }
        UiFactory.createRoundRect(node, 'ButtonInner', new Size(size.width - 10, size.height - 10), v3(0, 0, 0), shiftColor(fillColor, 18), withAlpha(Color.WHITE, 36), 14);
        UiFactory.createRoundRect(node, 'ButtonCap', new Size(size.width - 20, Math.max(10, size.height * 0.26)), v3(0, size.height * 0.18, 0), withAlpha(Color.WHITE, 20), undefined, 10, 110);
    }

    private decorateWoodShell(node: Node, size: Size, radius: number): void {
        if (node.getComponent(Sprite)) {
            return;
        }
        UiFactory.createRoundRect(node, 'WoodShadow', new Size(size.width + 18, size.height + 18), v3(0, -10, 0), withAlpha(SnookerTheme.metal.shadow, 128), undefined, radius + 8, 166);
        UiFactory.createRoundRect(node, 'WoodTrim', new Size(size.width - 24, size.height - 24), v3(0, 0, 0), SnookerTheme.table.woodDark, SnookerTheme.table.brassShadow, Math.max(16, radius - 10));
        UiFactory.createRoundRect(node, 'WoodHighlight', new Size(size.width - 42, 26), v3(0, size.height * 0.34, 0), withAlpha(SnookerTheme.table.woodHighlight, 98), undefined, 13, 150);
    }

    private decorateFeltSurface(node: Node, size: Size, radius: number): void {
        if (node.getComponent(Sprite)) {
            return;
        }
        UiFactory.createRoundRect(node, 'FeltInset', new Size(size.width - 12, size.height - 12), v3(0, 0, 0), SnookerTheme.table.feltShade, undefined, Math.max(10, radius - 6), 92);

        const stripeNode = UiFactory.ensureNode(node, 'FeltStripe', v3(0, 0, 0), size.width - 30, size.height - 30);
        const stripeGraphics = stripeNode.getComponent(Graphics) ?? stripeNode.addComponent(Graphics);
        stripeGraphics.clear();
        stripeGraphics.fillColor = withAlpha(Color.WHITE, 8);
        for (let x = -Math.floor((size.width - 40) / 2); x <= Math.floor((size.width - 40) / 2); x += 28) {
            stripeGraphics.roundRect(x, -(size.height - 34) / 2, 14, size.height - 34, 6);
            stripeGraphics.fill();
        }

        const glowNode = UiFactory.ensureNode(node, 'FeltGlow', v3(0, 0, 0), size.width - 40, size.height - 46);
        const glowGraphics = glowNode.getComponent(Graphics) ?? glowNode.addComponent(Graphics);
        glowGraphics.clear();
        glowGraphics.fillColor = SnookerTheme.table.feltLight;
        glowGraphics.roundRect(-(size.width - 40) / 2, -(size.height - 46) / 2, size.width - 40, size.height - 46, Math.max(12, radius - 12));
        glowGraphics.fill();
    }

    private decoratePowerBar(node: Node, size: Size): void {
        const innerWidth = size.width - 18;
        const trackNode = UiFactory.ensureNode(node, 'PowerTrack', v3(0, 0, 0), innerWidth, size.height - 8);
        trackNode.setSiblingIndex(0);
        const trackGraphics = trackNode.getComponent(Graphics) ?? trackNode.addComponent(Graphics);
        const left = -innerWidth / 2;
        trackGraphics.clear();
        trackGraphics.fillColor = SnookerTheme.text.success;
        trackGraphics.roundRect(left, -8, innerWidth * 0.42, 16, 8);
        trackGraphics.fill();
        trackGraphics.fillColor = SnookerTheme.text.accent;
        trackGraphics.roundRect(left + innerWidth * 0.38, -8, innerWidth * 0.28, 16, 8);
        trackGraphics.fill();
        trackGraphics.fillColor = SnookerTheme.text.danger;
        trackGraphics.roundRect(left + innerWidth * 0.64, -8, innerWidth * 0.36, 16, 8);
        trackGraphics.fill();
        trackGraphics.fillColor = withAlpha(Color.WHITE, 22);
        trackGraphics.roundRect(left, -8, innerWidth, 6, 6);
        trackGraphics.fill();
    }

    private createHudBadge(parent: Node, name: string, position: ReturnType<typeof v3>, text: string, textColor: Color, fillColor: Color): void {
        const badge = UiFactory.createCircle(parent, name, 28, position, shiftColor(fillColor, 8));
        this.drawCircleStroke(badge, 27, SnookerTheme.metal.frameBright, 3);
        UiFactory.createCircle(badge, `${name}-inner`, 20, v2(0, 0), shiftColor(fillColor, 20), 220);
        UiFactory.createLabel(badge, `${name}-label`, text, 18, v3(0, 0, 0), textColor, 40, 24);
    }

    private createStatChip(parent: Node, name: string, position: Vec3, title: string): Label {
        const chip = UiFactory.createRoundRect(parent, name, new Size(160, 52), position, withAlpha(SnookerTheme.metal.darkSoft, 208), withAlpha(SnookerTheme.metal.frameBright, 64), 18);
        this.decorateInsetPlate(chip, new Size(160, 52), 18, withAlpha(SnookerTheme.metal.darkSoft, 208), withAlpha(SnookerTheme.metal.frameBright, 64));
        this.applyInsetPanelSkin(chip);
        UiFactory.createLabel(chip, `${name}Title`, title, 14, v3(0, 12, 0), SnookerTheme.text.secondary, 130, 18);
        return UiFactory.createLabel(chip, `${name}Value`, '', 20, v3(0, -10, 0), SnookerTheme.text.primary, 130, 22);
    }

    private applyTopStripSkin(node: Node): void {
        TextureSkinner.apply(node, 'textures/ui/top_strip', { sliced: true, insetLeft: 40, insetRight: 40, insetTop: 28, insetBottom: 28 });
    }

    private applyDarkPanelSkin(node: Node): void {
        TextureSkinner.apply(node, 'textures/ui/panel_dark', { sliced: true, insetLeft: 34, insetRight: 34, insetTop: 34, insetBottom: 34 });
    }

    private applyInsetPanelSkin(node: Node, inset = 28): void {
        TextureSkinner.apply(node, 'textures/ui/panel_inset', { sliced: true, insetLeft: inset, insetRight: inset, insetTop: inset, insetBottom: inset });
    }

    private applyButtonSkin(node: Node, style: ButtonStyle): void {
        const path = style === 'blue'
            ? 'textures/ui/button_blue'
            : style === 'bronze'
                ? 'textures/ui/button_bronze'
            : style === 'green'
                ? 'textures/ui/button_green'
                : style === 'red'
                    ? 'textures/ui/button_red'
                    : 'textures/ui/button_neutral';
        TextureSkinner.apply(node, path, { sliced: true, insetLeft: 34, insetRight: 34, insetTop: 30, insetBottom: 30 });
    }

    private applyWoodSkin(node: Node): void {
        TextureSkinner.apply(node, 'textures/table/wood_frame', { sliced: true, insetLeft: 90, insetRight: 90, insetTop: 90, insetBottom: 90 });
    }

    private applyFeltSkin(node: Node): void {
        TextureSkinner.apply(node, 'textures/table/felt', { disableGraphics: true });
    }

    private applyPocketSkin(node: Node): void {
        TextureSkinner.apply(node, 'textures/table/pocket', { disableGraphics: true });
    }

    private drawCircleStroke(node: Node, radius: number, strokeColor: Color, lineWidth: number): void {
        const strokeNode = UiFactory.ensureNode(node, 'CircleStroke', v3(0, 0, 0), radius * 2 + lineWidth * 2, radius * 2 + lineWidth * 2);
        const strokeGraphics = strokeNode.getComponent(Graphics) ?? strokeNode.addComponent(Graphics);
        strokeGraphics.clear();
        strokeGraphics.strokeColor = strokeColor;
        strokeGraphics.lineWidth = lineWidth;
        strokeGraphics.circle(0, 0, radius);
        strokeGraphics.stroke();
    }

    private bindPointerInput(): void {
        this.pointerInput = new PointerInput(this.touchLayer, {
            onStart: ({ local }) => this.onPointerStart(local),
            onMove: ({ local }) => this.onPointerMove(local),
            onEnd: ({ local }) => this.onPointerEnd(local),
            onCancel: () => this.cancelAim(),
        });
    }

    private createButton(parent: Node, text: string, position: Vec2 | Vec3, size: Size, style: ButtonStyle, onClick: () => void, options?: ButtonOptions): Node {
        const fillColor = this.getButtonFillColor(style);
        const button = UiFactory.createRoundRect(parent, `Button-${text}`, size, position, fillColor, shiftColor(fillColor, 42), 18);
        this.applySceneButtonSkin(button, style);
        this.decorateButton(button, size, fillColor);
        this.applyButtonSkin(button, style);
        UiFactory.createLabel(button, 'ButtonLabel', text, 21, v3(0, 0, 0), SnookerTheme.text.primary, size.width - 24, size.height - 8);
        this.attachButtonRuntime(button, onClick, options);
        return button;
    }

    private attachButtonRuntime(button: Node, onClick: () => void, options?: ButtonOptions): void {
        const runtimeButton = button as RuntimeButtonNode;
        runtimeButton.__snookerClickAction = onClick;
        if (runtimeButton.__snookerButtonBound) {
            return;
        }
        runtimeButton.__snookerButtonBound = true;
        let holdTimer: ReturnType<typeof setTimeout> | null = null;
        let suppressMouseUntil = 0;
        const triggerClick = () => {
            if (!options?.muteClickSound) {
                this.audio.play('uiTap', { intensity: 0.68 });
            }
            runtimeButton.__snookerClickAction?.();
        };
        const clearHoldTimer = () => {
            if (holdTimer !== null) {
                clearTimeout(holdTimer);
                holdTimer = null;
            }
        };
        const markTouchInteraction = () => {
            suppressMouseUntil = Date.now() + 450;
        };
        const shouldIgnoreMouse = () => Date.now() < suppressMouseUntil;
        const pressIn = (isTouch: boolean) => {
            if (isTouch) {
                markTouchInteraction();
            } else if (shouldIgnoreMouse()) {
                return;
            }
            this.audio.unlock();
            this.setButtonPressed(button, true);
            if (!options?.holdDurationMs) {
                return;
            }
            clearHoldTimer();
            holdTimer = setTimeout(() => {
                this.setButtonPressed(button, false);
                triggerClick();
            }, options.holdDurationMs);
        };
        const handler = (isTouch: boolean) => {
            if (isTouch) {
                markTouchInteraction();
            } else if (shouldIgnoreMouse()) {
                return;
            }
            clearHoldTimer();
            this.setButtonPressed(button, false);
            if (options?.holdDurationMs) {
                return;
            }
            triggerClick();
        };
        const pressOut = (isTouch: boolean) => {
            if (isTouch) {
                markTouchInteraction();
            } else if (shouldIgnoreMouse()) {
                return;
            }
            clearHoldTimer();
            this.setButtonPressed(button, false);
        };
        button.on(Node.EventType.TOUCH_START, () => pressIn(true), this);
        button.on(Node.EventType.TOUCH_END, () => handler(true), this);
        button.on(Node.EventType.TOUCH_CANCEL, () => pressOut(true), this);
        button.on(Node.EventType.MOUSE_DOWN, () => pressIn(false), this);
        button.on(Node.EventType.MOUSE_UP, () => handler(false), this);
        button.on(Node.EventType.MOUSE_LEAVE, () => pressOut(false), this);
    }

    private createModeSelectionButton(
        parent: Node,
        config: MatchModeConfig,
        position: Vec3,
        style: ButtonStyle,
        onClick: () => void,
    ): Node {
        const button = this.createButton(parent, config.name, position, new Size(366, 136), style, onClick);
        const titleLabel = this.mustFindNode(button, 'ButtonLabel').getComponent(Label)!;
        titleLabel.fontSize = 42;
        titleLabel.lineHeight = 46;
        titleLabel.node.setPosition(0, 22, 0);
        UiFactory.createLabel(button, 'ModeSubtitle', config.subtitle, 17, v3(0, -28, 0), withAlpha(Color.WHITE, 226), 300, 36);
        return button;
    }

    private setButtonPressed(button: Node, pressed: boolean): void {
        Tween.stopAllByTarget(button);
        tween(button).to(0.08, { scale: pressed ? v3(0.97, 0.97, 1) : v3(1, 1, 1) }).start();
    }

    private emphasizeSecondaryButton(button: Node): void {
        const opacity = button.getComponent(UIOpacity) ?? button.addComponent(UIOpacity);
        opacity.opacity = 232;
    }

    private mustFindNode(root: Node, name: string): Node {
        if (root.name === name) {
            return root;
        }
        for (const child of root.children) {
            const found = this.findNodeRecursive(child, name);
            if (found) {
                return found;
            }
        }
        throw new Error(`未找到节点: ${name}`);
    }

    private findNodeRecursive(node: Node, name: string): Node | null {
        if (node.name === name) {
            return node;
        }
        for (const child of node.children) {
            const found = this.findNodeRecursive(child, name);
            if (found) {
                return found;
            }
        }
        return null;
    }

    private applySceneButtonSkin(button: Node, style: ButtonStyle): void {
        const sprite = button.getComponent(Sprite);
        if (!sprite) {
            return;
        }
        sprite.color = style === 'red'
            ? withAlpha(SnookerTheme.button.danger, 255)
            : style === 'green'
                ? withAlpha(SnookerTheme.button.green, 255)
                : style === 'bronze'
                    ? withAlpha(SnookerTheme.button.bronze, 255)
                : style === 'blue'
                    ? withAlpha(SnookerTheme.button.blue, 255)
                    : withAlpha(SnookerTheme.button.neutral, 255);
    }

    private getButtonFillColor(style: ButtonStyle): Color {
        switch (style) {
            case 'blue':
                return SnookerTheme.button.blue;
            case 'bronze':
                return SnookerTheme.button.bronze;
            case 'green':
                return SnookerTheme.button.green;
            case 'red':
                return SnookerTheme.button.danger;
            case 'neutral':
            default:
                return SnookerTheme.button.neutral;
        }
    }

    private restyleButton(button: Node, label: Label, text: string, style: ButtonStyle): void {
        const transform = button.getComponent(UITransform);
        const position = button.position.clone();
        if (transform) {
            const size = new Size(transform.contentSize.width, transform.contentSize.height);
            const fillColor = this.getButtonFillColor(style);
            UiFactory.createRoundRect(button.parent!, button.name, size, position, fillColor, shiftColor(fillColor, 42), 18);
            this.decorateButton(button, size, fillColor);
        }
        label.string = text;
        this.applySceneButtonSkin(button, style);
        this.applyButtonSkin(button, style);
    }

    private getCurrentModeConfig(): MatchModeConfig {
        return MATCH_MODE_CONFIGS[this.mode];
    }

    private refreshMenuModeButtons(): void {
        for (const button of this.menuModeButtons) {
            const mode = button.name.includes(MATCH_MODE_CONFIGS[MatchMode.Expert].name) ? MatchMode.Expert : MatchMode.Casual;
            const opacity = button.getComponent(UIOpacity) ?? button.addComponent(UIOpacity);
            opacity.opacity = mode === this.mode ? 255 : 214;
            button.setScale(mode === this.mode ? v3(1.04, 1.04, 1) : v3(1, 1, 1));
        }
    }

    private syncSoundButtonState(): void {
        if (!this.soundButton || !this.soundButtonLabel || !this.soundButton.isValid || !this.soundButtonLabel.node.isValid) {
            return;
        }
        const soundToggleLabel = this.soundEnabled ? '\u97f3\u6548\uff1a\u5f00' : '\u97f3\u6548\uff1a\u5173';
        this.restyleButton(
            this.soundButton,
            this.soundButtonLabel,
            soundToggleLabel,
            this.soundEnabled ? 'blue' : 'neutral',
        );
        this.soundButtonLabel.fontSize = 19;
    }



    private refreshMenuPreview(animate = false): void {
        this.refreshMenuModeButtons();
        this.syncSoundButtonState();

        if (animate) {
            this.playPreviewSwapAnimation();
        }
    }

    private rebuildPreviewBalls(container: Node, layouts: BallLayout[], previewWidth: number, previewHeight: number, radius: number, includeCueBall: boolean): void {
        container.removeAllChildren();
        if (includeCueBall) {
            this.createDecorativeBall(container, 'PreviewCueBall', radius, this.mapTableToPreview(CUE_START_POSITION, previewWidth, previewHeight), BALL_COLORS[BallType.Cue], true);
        }
        layouts.forEach((layout, index) => {
            this.createDecorativeBall(
                container,
                `PreviewBall-${index}`,
                radius,
                this.mapTableToPreview(layout.position, previewWidth, previewHeight),
                BALL_COLORS[layout.ballType],
                previewHeight > 40,
            );
        });
    }

    private createDecorativeBall(parent: Node, name: string, radius: number, position: Vec2, color: Color, withShadow: boolean): void {
        if (withShadow) {
            const shadow = UiFactory.createCircle(parent, `${name}-shadow`, radius, position.clone().add(v2(radius * 0.32, -radius * 0.3)), SnookerTheme.ball.shadow, 116);
            shadow.setScale(1.14, 0.82, 1);
        }
        const ballNode = UiFactory.createCircle(parent, name, radius, position, color);
        const bodyGlow = UiFactory.createCircle(ballNode, `${name}-body-glow`, radius * 0.82, v2(0, 0), withAlpha(shiftColor(color, 18), 110), 120);
        bodyGlow.setScale(0.88, 0.78, 1);
        const highlight = UiFactory.createCircle(ballNode, `${name}-highlight`, radius * 0.36, v2(-radius * 0.3, radius * 0.32), SnookerTheme.ball.highlight, 160);
        highlight.setScale(0.94, 0.8, 1);
        UiFactory.createCircle(ballNode, `${name}-spark`, radius * 0.14, v2(-radius * 0.08, radius * 0.08), SnookerTheme.ball.sparkle, 220);
        this.drawCircleStroke(ballNode, Math.max(2, radius - 0.8), withAlpha(Color.WHITE, 64), Math.max(1.1, radius * 0.1));
    }

    private playPreviewSwapAnimation(): void {
        for (const button of this.menuModeButtons) {
            Tween.stopAllByTarget(button);
            const baseScale = button.getScale().clone();
            button.setScale(baseScale.x * 0.94, baseScale.y * 0.94, 1);
            tween(button).to(0.18, { scale: baseScale }).start();
        }
    }

    private mapTableToPreview(position: Vec2, previewWidth: number, previewHeight: number): Vec2 {
        const x = (position.x / (TABLE_INNER_WIDTH / 2)) * (previewWidth / 2 - 16);
        const y = (position.y / (TABLE_INNER_HEIGHT / 2)) * (previewHeight / 2 - 12);
        return v2(x, y);
    }





    private toggleSound(): void {
        this.soundEnabled = !this.soundEnabled;
        this.audio.setEnabled(this.soundEnabled);
        this.savePersistentData();
        this.refreshMenuPreview();
        if (this.soundEnabled) {
            this.audio.play('uiTap', { intensity: 0.8 });
        }
    }

    private playFramePhysicsSounds(stepResult: PhysicsStepResult): void {
        const now = Date.now();
        if (stepResult.ballCollisionCount > 0 && stepResult.strongestBallCollisionSpeed > 16 && now - this.lastBallCollisionAudioAt >= 46) {
            const intensity = Math.max(0.3, Math.min(1.18,
                stepResult.strongestBallCollisionSpeed / 360 + Math.min(0.2, (stepResult.ballCollisionCount - 1) * 0.04),
            ));
            this.audio.play('ballCollision', { intensity });
            this.lastBallCollisionAudioAt = now;
        }
        if (stepResult.railCollisionCount > 0 && stepResult.strongestRailCollisionSpeed > 24 && now - this.lastRailCollisionAudioAt >= 64) {
            const intensity = Math.max(0.26, Math.min(1.05,
                stepResult.strongestRailCollisionSpeed / 420 + Math.min(0.16, (stepResult.railCollisionCount - 1) * 0.03),
            ));
            this.audio.play('railCollision', { intensity });
            this.lastRailCollisionAudioAt = now;
        }
    }

    private startMatch(mode = this.mode): void {
        this.mode = mode;
        for (const button of this.menuModeButtons) {
            Tween.stopAllByTarget(button);
        }
        this.closeAchievementPanel();
        this.achievementSystem.resetMatch(mode);
        if (!this.helperAimEnabled) {
            this.achievementSystem.onHelperToggle(false);
        }
        this.score = 0;
        this.currentBreak = 0;
        this.shotsUsed = 0;
        this.pottedCount = 0;
        this.isNewHighScoreThisMatch = false;
        this.physicsAccumulator = 0;
        this.pottedThisShot = [];
        this.clearTableBalls();
        this.spawnMatchBalls();
        this.syncBallVisuals();
        this.clearAimGuides();
        this.renderPowerBar(0);
        this.updatePowerDescriptor(0);
        this.hideOverlay();
        this.menuLayer.active = false;
        this.gameLayer.active = true;
        this.openingCuePlacementPending = true;
        this.phase = PlayPhase.Idle;
        this.setCueBallVisible(false);
        this.statusLabel.string = '请先在高亮的 D 区内点击放置白球，然后再拖拽白球开球。';
        this.refreshHud();
        this.renderOpeningPlacementGuide();
        this.updateGameplayPresentation();
    }

    private restartCurrentMatch(): void {
        this.cancelAim();
        this.hideOverlay();
        this.unschedule(this.deferredRestartCurrentMatch);
        this.scheduleOnce(this.deferredRestartCurrentMatch, 0);
    }

    private showMenu(): void {
        this.phase = PlayPhase.Menu;
        this.menuLayer.active = true;
        this.gameLayer.active = false;
        this.closeAchievementPanel();
        this.hideOverlay();
        this.clearAimGuides();
        this.refreshAchievementPanel();
        this.refreshMenuPreview();
        this.startMenuPulse();
        this.updateGameplayPresentation();
    }

    private togglePause(): void {
        if (this.phase === PlayPhase.Menu || this.phase === PlayPhase.Settlement) {
            return;
        }
        if (this.phase === PlayPhase.Paused) {
            this.phase = this.resumePhase;
            this.hideOverlay();
            this.statusLabel.string = '继续瞄准或等待走位结束。';
            this.updateGameplayPresentation();
            return;
        }
        this.resumePhase = this.phase === PlayPhase.Aiming ? PlayPhase.Idle : this.phase;
        this.cancelAim();
        this.phase = PlayPhase.Paused;
        this.updateGameplayPresentation();
        this.showSettingsPanel();
    }

    private showRuleOverlay(): void {
        this.showOverlay(
            '模式说明',
            '1. 休闲模式为 10 红 4 彩，适合快速来一局。\n2. 专家模式为标准 15 红 6 彩，用于完整单人练习。\n3. 开球前需要先在 D 区摆放白球，再从白球位置拖拽出杆。\n4. 进球会累计 BREAK，白球落袋会被判犯规并扣分。',
            { label: '知道了', style: 'blue', action: () => this.hideOverlay() },
        );
    }

    private showSettlementPreview(): void {
        if (this.phase === PlayPhase.Menu || this.phase === PlayPhase.Settlement) {
            return;
        }
        this.cancelAim();
        this.showSettlementLayout();
    }

    private showSettingsPanel(): void {
        this.overlayLayer.active = true;
        this.messagePanel.active = false;
        this.settlementPanel.active = false;
        this.settingsPanel.active = true;
        this.setButtonClickAction(this.settingsContinueButton, () => this.togglePause());
        this.setButtonClickAction(this.settingsRestartButton, () => this.restartCurrentMatch());
        this.setButtonClickAction(this.settingsHomeButton, () => this.showMenu());
    }

    private showOverlay(
        title: string,
        detail: string,
        primary?: OverlayButtonConfig,
        secondary?: OverlayButtonConfig,
        tertiary?: OverlayButtonConfig,
    ): void {
        this.overlayLayer.active = true;
        this.messagePanel.active = true;
        this.settingsPanel.active = false;
        this.settlementPanel.active = false;
        this.overlayTitleLabel.string = title;
        this.overlayStatsContainer.active = false;
        this.overlayDetailLabel.node.active = true;
        this.overlayDetailLabel.node.setPosition(0, 32, 0);
        this.overlayDetailLabel.getComponent(UITransform)?.setContentSize(470, 150);
        this.overlayDetailLabel.lineHeight = 26;
        this.overlayDetailLabel.string = detail;
        this.setOverlayButton(this.overlayPrimaryButton, this.overlayPrimaryLabel, primary, (action) => {
            this.overlayPrimaryAction = action;
        });
        this.setOverlayButton(this.overlaySecondaryButton, this.overlaySecondaryLabel, secondary, (action) => {
            this.overlaySecondaryAction = action;
        });
        this.setOverlayButton(this.overlayTertiaryButton, this.overlayTertiaryLabel, tertiary, (action) => {
            this.overlayTertiaryAction = action;
        });
        this.layoutOverlayButtons();
    }

    private showSettlementOverlay(
        title: string,
        note: string,
        rows: Array<{ title: string; value: string }>,
    ): void {
        this.overlayLayer.active = true;
        this.messagePanel.active = false;
        this.settingsPanel.active = false;
        this.settlementPanel.active = true;
        this.settlementTitleLabel.string = title;
        this.settlementNoteLabel.string = note;
        this.settlementStatTitleLabels.forEach((label, index) => {
            const row = rows[index];
            label.string = row?.title ?? '';
            this.settlementStatValueLabels[index].string = row?.value ?? '';
        });
        this.setButtonClickAction(this.settlementRestartButton, () => this.restartCurrentMatch());
        this.setButtonClickAction(this.settlementHomeButton, () => this.showMenu());
    }

    private setOverlayButton(
        button: Node,
        label: Label,
        config: OverlayButtonConfig | undefined,
        setter: (action: (() => void) | null) => void,
    ): void {
        if (!config) {
            button.active = false;
            setter(null);
            this.setButtonClickAction(button, null);
            return;
        }
        button.active = true;
        setter(config.action);
        this.setButtonClickAction(button, config.action);
        this.restyleButton(button, label, config.label, config.style);
    }

    private layoutOverlayButtons(): void {
        const activeButtons = [
            this.overlayPrimaryButton,
            this.overlaySecondaryButton,
            this.overlayTertiaryButton,
        ].filter((button) => button.active);

        if (activeButtons.length === 0) {
            return;
        }

        if (activeButtons.length === 1) {
            activeButtons[0].setPosition(0, -126, 0);
            return;
        }

        if (activeButtons.length === 2) {
            activeButtons[0].setPosition(-122, -126, 0);
            activeButtons[1].setPosition(122, -126, 0);
            return;
        }

        this.overlayPrimaryButton.setPosition(0, -58, 0);
        this.overlaySecondaryButton.setPosition(-130, -132, 0);
        this.overlayTertiaryButton.setPosition(130, -132, 0);
    }

    private hideOverlay(): void {
        this.overlayLayer.active = false;
        this.messagePanel.active = false;
        this.settingsPanel.active = false;
        this.settlementPanel.active = false;
        this.overlayPrimaryAction = null;
        this.overlaySecondaryAction = null;
        this.overlayTertiaryAction = null;
        this.setButtonClickAction(this.overlayPrimaryButton, null);
        this.setButtonClickAction(this.overlaySecondaryButton, null);
        this.setButtonClickAction(this.overlayTertiaryButton, null);
        this.setButtonClickAction(this.settingsContinueButton, null);
        this.setButtonClickAction(this.settingsRestartButton, null);
        this.setButtonClickAction(this.settingsHomeButton, null);
        this.setButtonClickAction(this.settlementRestartButton, null);
        this.setButtonClickAction(this.settlementHomeButton, null);
        this.updateGameplayPresentation();
    }

    private setButtonClickAction(button: Node, action: (() => void) | null): void {
        (button as RuntimeButtonNode).__snookerClickAction = action;
    }

    private readonly deferredRestartCurrentMatch = (): void => {
        this.startMatch(this.mode);
    };

    private startMenuPulse(): void {
        for (const button of this.menuModeButtons) {
            Tween.stopAllByTarget(button);
            const baseScale = button.getScale().clone();
            tween(button)
                .repeatForever(
                    tween(button)
                        .to(0.92, { scale: v3(baseScale.x * 1.03, baseScale.y * 1.03, 1) })
                        .to(0.92, { scale: baseScale }),
                )
                .start();
        }
    }

    private spawnMatchBalls(): void {
        const config = this.getCurrentModeConfig();
        this.balls = [];
        this.createBall(BallType.Cue, CUE_START_POSITION.clone(), 'cue-ball');
        config.ballLayouts.forEach((layout, index) => this.createBall(layout.ballType, layout.position.clone(), layout.id ?? `${layout.ballType}-${index}`));
    }

    private createBall(ballType: BallType, position: Vec2, id: string): void {
        const shadowNode = UiFactory.createCircle(this.tableBallLayer, `${id}-shadow`, BALL_RADIUS, position.clone().add(v2(5, -5)), SnookerTheme.ball.shadow, 132);
        shadowNode.setScale(1.18, 0.82, 1);
        const ballNode = UiFactory.createCircle(this.tableBallLayer, id, BALL_RADIUS, position, BALL_COLORS[ballType]);
        const bodyGlow = UiFactory.createCircle(ballNode, `${id}-body-glow`, BALL_RADIUS * 0.82, v2(0, 0), withAlpha(shiftColor(BALL_COLORS[ballType], 22), 110), 120);
        bodyGlow.setScale(0.86, 0.78, 1);
        const highlight = UiFactory.createCircle(ballNode, `${id}-highlight`, BALL_RADIUS * 0.35, v2(-BALL_RADIUS * 0.34, BALL_RADIUS * 0.32), SnookerTheme.ball.highlight, 180);
        highlight.setScale(0.92, 0.8, 1);
        UiFactory.createCircle(ballNode, `${id}-spark`, BALL_RADIUS * 0.14, v2(-BALL_RADIUS * 0.1, BALL_RADIUS * 0.1), SnookerTheme.ball.sparkle, 220);
        this.drawCircleStroke(ballNode, BALL_RADIUS - 1, withAlpha(Color.WHITE, 78), 1.8);
        this.balls.push({
            id,
            ballType,
            scoreValue: BALL_SCORES[ballType],
            color: BALL_COLORS[ballType],
            radius: BALL_RADIUS,
            node: ballNode,
            shadowNode,
            position,
            velocity: v2(),
            isPotted: false,
        });
    }

    private clearTableBalls(): void {
        for (const ball of this.balls) {
            // 先把旧球节点移出层级，避免同帧重开时被同名查找误复用。
            ball.node.removeFromParent();
            ball.shadowNode.removeFromParent();
            ball.node.destroy();
            ball.shadowNode.destroy();
        }
        this.balls = [];
    }



    private refreshHud(): void {
        const config = this.getCurrentModeConfig();
        const remainingObjectBalls = this.balls.filter((ball) => !ball.isPotted && ball.ballType !== BallType.Cue);
        const remainingReds = remainingObjectBalls.filter((ball) => ball.ballType === BallType.Red).length;
        const remainingColors = remainingObjectBalls.length - remainingReds;
        this.scoreLabel.string = `${this.score}`;
        this.breakLabel.string = `${this.currentBreak}`;
        this.stageLabel.string = config.name;
        this.shotsLabel.string = `本杆 ${this.currentBreak} · 已进 ${this.pottedCount} · 出杆 ${this.shotsUsed}`;
        this.targetHintLabel.string = remainingObjectBalls.length > 0
            ? `剩余 ${remainingReds} 红 ${remainingColors} 彩 · ${config.difficultyLabel}`
            : `${config.name}已清台，准备结算。`;
        this.updateHelperButton();
        this.updateGameplayPresentation();
    }

    private updateHelperButton(): void {
        this.restyleButton(this.helperButton, this.helperButtonLabel, this.helperAimEnabled ? '辅助线：开' : '辅助线：关', this.helperAimEnabled ? 'blue' : 'neutral');
    }

    private toggleHelperAim(): void {
        this.helperAimEnabled = !this.helperAimEnabled;
        this.achievementSystem.onHelperToggle(this.helperAimEnabled);
        this.updateHelperButton();
        if (this.phase === PlayPhase.Aiming && this.currentAimPointerOnTable) {
            this.updateAimGuides(this.currentAimPointerOnTable);
            return;
        }
        if (!this.helperAimEnabled) {
            this.aimGraphics.clear();
            this.statusLabel.string = '辅助线已关闭，拖动白球时不再显示预测线。';
            return;
        }
        this.statusLabel.string = '辅助线已开启，拖动白球即可显示预测线。';
    }

    private onPointerStart(localInGame: Vec2): void {
        this.audio.unlock();
        if (this.phase !== PlayPhase.Idle) {
            return;
        }
        const cueBall = this.getCueBall();
        if (!cueBall || cueBall.isPotted) {
            return;
        }
        const localOnTable = this.toTableLocal(localInGame);
        if (!this.physics.isPointInsidePlayArea(localOnTable)) {
            return;
        }
        if (this.openingCuePlacementPending) {
            this.tryPlaceOpeningCueBall(localOnTable, cueBall);
            return;
        }
        if (cueBall.position.clone().subtract(localOnTable).length() > BALL_RADIUS * 3.5) {
            return;
        }
        this.currentAimPointerOnTable = localOnTable.clone();
        this.phase = PlayPhase.Aiming;
        this.statusLabel.string = '拖动白球后方开始瞄准。';
        this.updateGameplayPresentation();
        this.updateAimGuides(localOnTable);
    }

    private onPointerMove(localInGame: Vec2): void {
        if (this.phase !== PlayPhase.Aiming) {
            return;
        }
        const pointerOnTable = this.toTableLocal(localInGame);
        this.currentAimPointerOnTable = pointerOnTable.clone();
        this.updateAimGuides(pointerOnTable);
    }

    private onPointerEnd(localInGame: Vec2): void {
        if (this.phase !== PlayPhase.Aiming) {
            return;
        }
        const pointerOnTable = this.toTableLocal(localInGame);
        this.currentAimPointerOnTable = pointerOnTable.clone();
        this.shootCueBall(pointerOnTable);
    }

    private cancelAim(): void {
        if (this.phase === PlayPhase.Aiming) {
            this.phase = PlayPhase.Idle;
        }
        this.currentAimPointerOnTable = null;
        this.clearAimGuides();
        this.renderPowerBar(0);
        this.updatePowerDescriptor(0);
        if (this.openingCuePlacementPending) {
            this.renderOpeningPlacementGuide();
        }
        this.updateGameplayPresentation();
    }

    private shootCueBall(pointerOnTable: Vec2): void {
        const cueBall = this.getCueBall();
        if (!cueBall) {
            this.cancelAim();
            return;
        }
        const shotVector = cueBall.position.clone().subtract(pointerOnTable);
        const dragDistance = shotVector.length();
        if (dragDistance < 12) {
            this.statusLabel.string = '拖拽距离太短，未出杆。';
            this.cancelAim();
            return;
        }
        const powerRatio = math.clamp01(dragDistance / MAX_DRAG_DISTANCE);
        const shotSpeed = MIN_SHOT_SPEED + (MAX_SHOT_SPEED - MIN_SHOT_SPEED) * powerRatio;
        cueBall.velocity = shotVector.normalize().multiplyScalar(shotSpeed);
        this.audio.play('cueStrike', { intensity: Math.max(0.35, Math.min(1.2, powerRatio + 0.3)) });
        this.openingCuePlacementPending = false;
        this.phase = PlayPhase.Moving;
        this.currentAimPointerOnTable = null;
        this.shotsUsed += 1;
        this.queueAchievementToasts(this.achievementSystem.onShotTaken({ shotsUsed: this.shotsUsed }));
        this.pottedThisShot = [];
        this.renderPowerBar(powerRatio);
        this.updatePowerDescriptor(powerRatio);
        this.statusLabel.string = '已出杆，观察走位与落袋反馈。';
        this.refreshHud();
        this.clearAimGuides();
        this.updateGameplayPresentation();
        this.shakeTable(8);
    }

    private tryPlaceOpeningCueBall(pointerOnTable: Vec2, cueBall: BallState): void {
        if (!this.isPointInsideBaulkD(pointerOnTable)) {
            this.statusLabel.string = '白球开局只能摆在 D 区内，请点到开球线左侧半圆区域。';
            return;
        }
        if (this.isPositionBlocked(pointerOnTable, cueBall)) {
            this.statusLabel.string = '这个位置离其他球太近，请在 D 区内换一个空位。';
            return;
        }
        cueBall.position = pointerOnTable.clone();
        cueBall.velocity = v2();
        this.openingCuePlacementPending = false;
        this.setCueBallVisible(true);
        this.clearAimGuides();
        this.syncBallVisuals();
        this.audio.play('cuePlace', { intensity: 0.78 });
        this.statusLabel.string = '白球已摆好，现在从白球位置拖拽即可瞄准开球。';
    }

    private onBallsPotted(pottedBalls: BallState[]): void {
        this.pottedThisShot.push(...pottedBalls);
        for (const ball of pottedBalls) {
            ball.node.active = false;
            ball.shadowNode.active = false;
            this.highlightNearestPocket(ball.position, ball.ballType === BallType.Cue ? SnookerTheme.text.danger : ball.color);
            if (ball.ballType !== BallType.Cue) {
                this.pottedCount += 1;
                this.spawnFloatingText(`+${ball.scoreValue}`, ball.position.clone(), ball.color, 26, 70);
            } else {
                this.spawnFloatingText('犯规', ball.position.clone(), SnookerTheme.text.danger, 26, 70);
            }
        }
        this.audio.play('pocket', {
            intensity: Math.max(0.55, Math.min(1.16, 0.62 + pottedBalls.length * 0.12)),
        });
        this.shakeTable(5);
    }

    private finishCurrentShot(): void {
        this.phase = PlayPhase.Idle;
        this.physicsAccumulator = 0;
        const resolution = this.rules.evaluateShot(this.pottedThisShot);
        const objectBallCount = this.pottedThisShot.filter((ball) => ball.ballType !== BallType.Cue).length;
        const nextScore = Math.max(0, this.score + resolution.scoreDelta - resolution.foulPenalty);
        const nextBreak = resolution.breakDelta > 0 ? this.currentBreak + resolution.breakDelta : 0;
        const report = this.composeShotReport(resolution, nextScore);
        this.score = nextScore;
        this.currentBreak = nextBreak;
        if (resolution.cueBallPotted) {
            this.respotCueBall();
        }
        this.statusLabel.string = resolution.message;
        this.showBattleReport(report.text, report.color);
        this.renderPowerBar(0);
        this.updatePowerDescriptor(0);
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.isNewHighScoreThisMatch = true;
            this.savePersistentData();
        }
        this.queueAchievementToasts(this.achievementSystem.onShotResolved({
            mode: this.mode,
            objectBallCount,
            scoreDelta: resolution.scoreDelta,
            cueBallPotted: resolution.cueBallPotted,
            nextBreak,
            shotsUsed: this.shotsUsed,
            helperEnabled: this.helperAimEnabled,
        }));
        this.refreshHud();
        this.syncBallVisuals();
        if (resolution.cueBallPotted) {
            this.audio.play('foul', { intensity: objectBallCount > 0 ? 1.02 : 0.84 });
        }
        if (objectBallCount > 1 && !resolution.cueBallPotted) {
            this.spawnFloatingText(`COMBO x${objectBallCount}`, v2(0, 48), SnookerTheme.text.accent, 28, 86);
        }
        this.pottedThisShot = [];
        this.updateGameplayPresentation();
        if (this.shouldSettleMatch()) {
            this.queueAchievementToasts(this.achievementSystem.onMatchCompleted({
                mode: this.mode,
                score: this.score,
                shotsUsed: this.shotsUsed,
                helperEnabled: this.helperAimEnabled,
            }));
            this.showSettlementLayout();
        }
    }




    private composeShotReport(resolution: ShotResolution, nextScore: number): { text: string; color: Color } {
        const objectBalls = this.pottedThisShot.filter((ball) => ball.ballType !== BallType.Cue);
        const remainingBalls = this.balls.filter((ball) => !ball.isPotted && ball.ballType !== BallType.Cue).length;
        const remainingTail = remainingBalls > 0 ? `，剩余 ${remainingBalls} 球` : '，清台完成';
        if (resolution.cueBallPotted && objectBalls.length > 0) {
            return {
                text: `进球 +${resolution.scoreDelta}，但白球犯规`,
                color: SnookerTheme.text.danger,
            };
        }
        if (resolution.cueBallPotted) {
            return {
                text: '白球落袋，犯规',
                color: SnookerTheme.text.danger,
            };
        }
        if (objectBalls.length === 1) {
            const ball = objectBalls[0];
            return {
                text: `${this.getBattleReportBallTypeLabel(ball.ballType)}入袋 +${ball.scoreValue}，当前总分 ${nextScore}${remainingTail}`,
                color: SnookerTheme.text.accent,
            };
        }
        if (objectBalls.length > 1) {
            return {
                text: `连进 ${objectBalls.length} 球 +${resolution.scoreDelta}，当前总分 ${nextScore}${remainingTail}`,
                color: SnookerTheme.text.accent,
            };
        }
        return {
            text: remainingBalls > 0 ? '本杆未得分，继续寻找机会' : '本杆未得分，但球桌已经清空',
            color: SnookerTheme.text.secondary,
        };
    }

    private getBattleReportBallTypeLabel(ballType: BallType): string {
        switch (ballType) {
            case BallType.Red:
                return '\u7ea2\u7403';
            case BallType.Yellow:
                return '\u9ec4\u7403';
            case BallType.Green:
                return '\u7eff\u7403';
            case BallType.Brown:
                return '\u68d5\u7403';
            case BallType.Blue:
                return '\u84dd\u7403';
            case BallType.Pink:
                return '\u7c89\u7403';
            case BallType.Black:
                return '\u9ed1\u7403';
            case BallType.Cue:
            default:
                return '\u767d\u7403';
        }
    }

    private shouldSettleMatch(): boolean {
        const hasRemainingObjectBall = this.balls.some((ball) => !ball.isPotted && ball.ballType !== BallType.Cue);
        return !hasRemainingObjectBall;
    }


    private showSettlement(): void {
        this.phase = PlayPhase.Settlement;
        this.updateGameplayPresentation();
        const config = this.getCurrentModeConfig();
        const summary = `模式：${config.name}\n得分：${this.score}\n进球：${this.pottedCount}\n出杆：${this.shotsUsed}\n最高分：${this.highScore}\n${
            this.isNewHighScoreThisMatch
                ? '已刷新本地最高分。'
                : this.mode === MatchMode.Casual
                    ? '这一局节奏很快，适合马上再来。'
                    : '标准球型已清台，可以继续冲击更高 BREAK。'
        }`;
        this.showOverlay(
            this.isNewHighScoreThisMatch ? '刷新纪录' : `${config.name}完成`,
            summary,
            undefined,
            { label: '再来一局', style: 'green', action: () => this.restartCurrentMatch() },
            { label: '返回菜单', style: 'neutral', action: () => this.showMenu() },
        );
    }

    private showSettlementLayout(): void {
        this.phase = PlayPhase.Settlement;
        this.updateGameplayPresentation();
        this.audio.play('settlement', { intensity: this.isNewHighScoreThisMatch ? 1.08 : 0.92 });
        const config = this.getCurrentModeConfig();
        const note = this.isNewHighScoreThisMatch
            ? '已刷新本地最高分。'
            : this.mode === MatchMode.Casual
                ? '这一局节奏很快，适合马上再来。'
                : '标准球型已清台，可以继续冲击更高 BREAK。';
        this.showSettlementOverlay(
            this.isNewHighScoreThisMatch ? '刷新纪录' : `${config.name}完成`,
            note,
            [
                { title: '模式', value: config.name },
                { title: '得分', value: `${this.score}` },
                { title: '进球', value: `${this.pottedCount}` },
                { title: '出杆', value: `${this.shotsUsed}` },
                { title: '最高分', value: `${this.highScore}` },
            ],
        );
    }

    private respotCueBall(): void {
        const cueBall = this.getCueBall();
        if (!cueBall) {
            return;
        }
        const candidates = [
            CUE_START_POSITION.clone(),
            CUE_START_POSITION.clone().add(v2(0, 50)),
            CUE_START_POSITION.clone().add(v2(0, -50)),
            CUE_START_POSITION.clone().add(v2(0, 100)),
            CUE_START_POSITION.clone().add(v2(0, -100)),
        ];
        for (const candidate of candidates) {
            if (!this.isPositionBlocked(candidate, cueBall)) {
                cueBall.position = candidate;
                cueBall.velocity = v2();
                cueBall.isPotted = false;
                cueBall.node.active = true;
                cueBall.shadowNode.active = true;
                return;
            }
        }
        cueBall.position = CUE_START_POSITION.clone();
        cueBall.velocity = v2();
        cueBall.isPotted = false;
        cueBall.node.active = true;
        cueBall.shadowNode.active = true;
    }

    private isPositionBlocked(candidate: Vec2, self: BallState): boolean {
        return this.balls.some((ball) => ball !== self && !ball.isPotted && ball.position.clone().subtract(candidate).length() < ball.radius * 2.1);
    }

    private isPointInsideBaulkD(candidate: Vec2): boolean {
        if (candidate.x > BAULK_LINE_X - BALL_RADIUS * 0.25) {
            return false;
        }
        const dCenter = v2(BAULK_LINE_X, 0);
        return candidate.clone().subtract(dCenter).length() <= D_RADIUS - BALL_RADIUS * 0.35;
    }

    private setCueBallVisible(visible: boolean): void {
        const cueBall = this.getCueBall();
        if (!cueBall) {
            return;
        }
        cueBall.node.active = visible;
        cueBall.shadowNode.active = visible;
    }

    private renderOpeningPlacementGuide(): void {
        this.clearAimGuides();
        this.aimGraphics.fillColor = withAlpha(SnookerTheme.text.accent, 34);
        this.aimGraphics.circle(BAULK_LINE_X, 0, D_RADIUS);
        this.aimGraphics.fill();
        this.aimGraphics.strokeColor = withAlpha(SnookerTheme.text.accent, 196);
        this.aimGraphics.lineWidth = 3;
        this.aimGraphics.circle(BAULK_LINE_X, 0, D_RADIUS);
        this.aimGraphics.stroke();
        this.aimGraphics.moveTo(BAULK_LINE_X, -D_RADIUS);
        this.aimGraphics.lineTo(BAULK_LINE_X, D_RADIUS);
        this.aimGraphics.stroke();
    }

    private syncBallVisuals(): void {
        for (const ball of this.balls) {
            if (ball.isPotted) {
                continue;
            }
            ball.node.setPosition(ball.position.x, ball.position.y, 0);
            ball.shadowNode.setPosition(ball.position.x + 4, ball.position.y - 4, 0);
        }
    }

    private updateAimGuides(pointerOnTable: Vec2): void {
        const cueBall = this.getCueBall();
        if (!cueBall) {
            return;
        }
        const shotVector = cueBall.position.clone().subtract(pointerOnTable);
        const powerRatio = math.clamp01(shotVector.length() / MAX_DRAG_DISTANCE);
        this.renderPowerBar(powerRatio);
        this.updatePowerDescriptor(powerRatio);
        if (shotVector.length() <= 4) {
            this.clearAimGuides();
            return;
        }
        const direction = shotVector.normalize();
        const prediction = this.findCollisionPrediction(cueBall, direction);
        this.drawCueStick(cueBall.position, direction, powerRatio);
        if (!this.helperAimEnabled) {
            this.statusLabel.string = `辅助线已关闭 · ${this.getPowerBandText(powerRatio)}`;
            this.aimGraphics.clear();
            return;
        }
        this.drawAimPrediction(cueBall.position, direction, powerRatio, prediction);
        if (prediction) {
            this.statusLabel.string = `预计命中 ${this.getBallTypeLabel(prediction.ball.ballType)} · ${this.getPowerBandText(powerRatio)}`;
        } else {
            this.statusLabel.string = `拖动继续调角度 · ${this.getPowerBandText(powerRatio)}`;
        }
    }

    private findCollisionPrediction(cueBall: BallState, direction: Vec2): CollisionPrediction | null {
        let best: CollisionPrediction | null = null;
        const hitRadius = cueBall.radius * 2;
        for (const ball of this.balls) {
            if (ball.isPotted || ball.ballType === BallType.Cue) {
                continue;
            }
            const toBall = ball.position.clone().subtract(cueBall.position);
            const projected = toBall.dot(direction);
            if (projected <= 0) {
                continue;
            }
            const perpendicularSquared = toBall.lengthSqr() - projected * projected;
            if (perpendicularSquared > hitRadius * hitRadius) {
                continue;
            }
            const offset = Math.sqrt(Math.max(0, hitRadius * hitRadius - perpendicularSquared));
            const travelDistance = projected - offset;
            if (travelDistance <= 0) {
                continue;
            }
            if (!best || travelDistance < best.travelDistance) {
                const impactPoint = cueBall.position.clone().add(direction.clone().multiplyScalar(travelDistance));
                const targetDirection = ball.position.clone().subtract(impactPoint).normalize();
                best = {
                    ball,
                    impactPoint,
                    travelDistance,
                    targetDirection,
                };
            }
        }
        return best;
    }

    private drawAimPrediction(cuePosition: Vec2, direction: Vec2, powerRatio: number, prediction: CollisionPrediction | null): void {
        const guideLength = 178 + powerRatio * 160;
        this.aimGraphics.clear();
        this.aimGraphics.lineWidth = 3.5;
        this.aimGraphics.strokeColor = withAlpha(Color.WHITE, 210);
        const start = cuePosition.clone().add(direction.clone().multiplyScalar(BALL_RADIUS + 6));
        const end = prediction
            ? prediction.impactPoint.clone()
            : cuePosition.clone().add(direction.clone().multiplyScalar(guideLength));
        this.aimGraphics.moveTo(start.x, start.y);
        this.aimGraphics.lineTo(end.x, end.y);
        this.aimGraphics.stroke();

        this.aimGraphics.lineWidth = 2;
        this.aimGraphics.strokeColor = withAlpha(Color.WHITE, 124);
        let distance = 28;
        while (distance < guideLength) {
            const dashStart = cuePosition.clone().add(direction.clone().multiplyScalar(distance));
            const dashEnd = cuePosition.clone().add(direction.clone().multiplyScalar(Math.min(guideLength, distance + 12)));
            this.aimGraphics.moveTo(dashStart.x, dashStart.y);
            this.aimGraphics.lineTo(dashEnd.x, dashEnd.y);
            distance += 24;
        }
        this.aimGraphics.stroke();

        if (!prediction) {
            return;
        }

        this.aimGraphics.fillColor = withAlpha(SnookerTheme.text.accent, 48);
        this.aimGraphics.circle(prediction.impactPoint.x, prediction.impactPoint.y, 10);
        this.aimGraphics.fill();
        this.aimGraphics.strokeColor = withAlpha(SnookerTheme.text.accent, 218);
        this.aimGraphics.lineWidth = 2.5;
        this.aimGraphics.circle(prediction.impactPoint.x, prediction.impactPoint.y, 14);
        this.aimGraphics.stroke();

        const projectedEnd = prediction.ball.position.clone().add(prediction.targetDirection.clone().multiplyScalar(92));
        this.aimGraphics.strokeColor = withAlpha(prediction.ball.color, 170);
        this.aimGraphics.lineWidth = 3;
        this.aimGraphics.moveTo(prediction.ball.position.x, prediction.ball.position.y);
        this.aimGraphics.lineTo(projectedEnd.x, projectedEnd.y);
        this.aimGraphics.stroke();

        this.aimGraphics.strokeColor = withAlpha(prediction.ball.color, 150);
        this.aimGraphics.lineWidth = 2;
        this.aimGraphics.circle(prediction.ball.position.x, prediction.ball.position.y, BALL_RADIUS + 4);
        this.aimGraphics.stroke();
    }

    private drawCueStick(cuePosition: Vec2, direction: Vec2, powerRatio: number): void {
        this.cueGraphics.clear();
        const cueStart = cuePosition.clone().subtract(direction.clone().multiplyScalar(22));
        const cueEnd = cuePosition.clone().subtract(direction.clone().multiplyScalar(108 + powerRatio * 88));
        this.cueGraphics.lineWidth = 11;
        this.cueGraphics.strokeColor = new Color(150, 103, 58, 236);
        this.cueGraphics.moveTo(cueStart.x, cueStart.y);
        this.cueGraphics.lineTo(cueEnd.x, cueEnd.y);
        this.cueGraphics.stroke();
        this.cueGraphics.lineWidth = 3;
        this.cueGraphics.strokeColor = withAlpha(Color.WHITE, 110);
        this.cueGraphics.moveTo(cueStart.x, cueStart.y);
        this.cueGraphics.lineTo(cueEnd.x, cueEnd.y);
        this.cueGraphics.stroke();
    }

    private clearAimGuides(): void {
        this.aimGraphics.clear();
        this.cueGraphics.clear();
    }

    private renderPowerBar(ratio: number): void {
        const clamped = math.clamp01(ratio);
        const width = this.powerFillWidth * clamped;
        const left = -this.powerFillWidth / 2;
        this.powerFillGraphics.clear();
        if (width <= 0) {
            return;
        }
        const color = clamped < 0.45 ? SnookerTheme.text.success : clamped < 0.75 ? SnookerTheme.text.accent : SnookerTheme.text.danger;
        this.powerFillGraphics.fillColor = color;
        this.powerFillGraphics.roundRect(left, -9, width, 18, 9);
        this.powerFillGraphics.fill();
        this.powerFillGraphics.fillColor = withAlpha(Color.WHITE, 32);
        this.powerFillGraphics.roundRect(left, -9, width, 6, 6);
        this.powerFillGraphics.fill();
    }

    private updatePowerDescriptor(ratio: number): void {
        const clamped = math.clamp01(ratio);
        this.powerValueLabel.string = `${Math.round(clamped * 100)}%`;
        this.powerBandLabel.string = this.getPowerBandText(clamped);
    }

    private getPowerBandText(ratio: number): string {
        if (ratio < 0.35) {
            return '轻推';
        }
        if (ratio < 0.72) {
            return '标准';
        }
        return '强击';
    }

    private highlightNearestPocket(position: Vec2, color: Color): void {
        let bestIndex = 0;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (let index = 0; index < POCKET_POSITIONS.length; index++) {
            const distance = position.clone().subtract(POCKET_POSITIONS[index]).lengthSqr();
            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = index;
            }
        }
        const glowNode = this.pocketGlowNodes[bestIndex];
        if (!glowNode) {
            return;
        }
        const graphics = glowNode.getComponent(Graphics) ?? glowNode.addComponent(Graphics);
        const opacity = glowNode.getComponent(UIOpacity) ?? glowNode.addComponent(UIOpacity);
        graphics.clear();
        graphics.fillColor = withAlpha(color, 86);
        graphics.circle(0, 0, 26);
        graphics.fill();
        glowNode.setScale(1.18, 1.18, 1);
        opacity.opacity = 0;
        Tween.stopAllByTarget(glowNode);
        Tween.stopAllByTarget(opacity);
        tween(opacity).to(0.1, { opacity: 215 }).to(0.28, { opacity: 0 }).start();
        tween(glowNode).to(0.12, { scale: v3(1.56, 1.56, 1) }).to(0.22, { scale: v3(1.24, 1.24, 1) }).start();
    }

    private shakeTable(intensity: number): void {
        Tween.stopAllByTarget(this.tableRoot);
        this.tableRoot.setPosition(this.tableBasePosition);
        tween(this.tableRoot)
            .to(0.04, { position: v3(this.tableBasePosition.x + intensity, this.tableBasePosition.y - intensity * 0.45, 0) })
            .to(0.04, { position: v3(this.tableBasePosition.x - intensity * 0.7, this.tableBasePosition.y + intensity * 0.36, 0) })
            .to(0.04, { position: v3(this.tableBasePosition.x + intensity * 0.42, this.tableBasePosition.y + intensity * 0.18, 0) })
            .to(0.05, { position: this.tableBasePosition })
            .start();
    }

    private showBattleReport(text: string, color: Color): void {
        const label = this.mustFindNode(this.battleReportNode, 'BattleReportLabel').getComponent(Label)!;
        label.string = text;
        label.color = color;
        this.battleReportNode.active = true;
        this.battleReportNode.setPosition(this.battleReportBasePosition);
        this.battleReportNode.setScale(0.96, 0.96, 1);
        this.battleReportOpacity.opacity = 0;
        Tween.stopAllByTarget(this.battleReportNode);
        Tween.stopAllByTarget(this.battleReportOpacity);
        tween(this.battleReportOpacity)
            .to(0.12, { opacity: 255 })
            .delay(0.8)
            .to(0.18, { opacity: 0 })
            .start();
        tween(this.battleReportNode)
            .to(0.12, { scale: v3(1, 1, 1), position: v3(this.battleReportBasePosition.x, this.battleReportBasePosition.y + 8, 0) })
            .delay(0.8)
            .call(() => {
                this.battleReportNode.active = false;
            })
            .start();
    }

    private updateGameplayPresentation(): void {
        if (!this.gameLayer) {
            return;
        }
        if (!this.gameLayer.active) {
            this.topHud.setPosition(this.topHudBasePosition);
            this.bottomHud.setPosition(this.bottomHudBasePosition);
            return;
        }

        const topOpacity = this.topHud.getComponent(UIOpacity) ?? this.topHud.addComponent(UIOpacity);
        const bottomOpacity = this.bottomHud.getComponent(UIOpacity) ?? this.bottomHud.addComponent(UIOpacity);
        let nextTopOpacity = 255;
        let nextBottomOpacity = 255;
        let nextTopPosition = this.topHudBasePosition;
        let nextBottomPosition = this.bottomHudBasePosition;
        let helperVisible = true;

        switch (this.phase) {
            case PlayPhase.Aiming:
                nextTopOpacity = 88;
                nextBottomOpacity = 226;
                nextTopPosition = this.topHudFocusPosition;
                nextBottomPosition = this.bottomHudFocusPosition;
                helperVisible = true;
                break;
            case PlayPhase.Moving:
                nextTopOpacity = 178;
                nextBottomOpacity = 214;
                helperVisible = false;
                break;
            case PlayPhase.Paused:
            case PlayPhase.Settlement:
                nextTopOpacity = 110;
                nextBottomOpacity = 110;
                helperVisible = false;
                break;
            case PlayPhase.Menu:
                nextTopOpacity = 0;
                nextBottomOpacity = 0;
                helperVisible = false;
                break;
            case PlayPhase.Idle:
            default:
                nextTopOpacity = 255;
                nextBottomOpacity = 255;
                helperVisible = true;
                break;
        }

        this.helperButton.active = helperVisible;
        Tween.stopAllByTarget(topOpacity);
        Tween.stopAllByTarget(bottomOpacity);
        Tween.stopAllByTarget(this.topHud);
        Tween.stopAllByTarget(this.bottomHud);
        tween(topOpacity).to(0.16, { opacity: nextTopOpacity }).start();
        tween(bottomOpacity).to(0.16, { opacity: nextBottomOpacity }).start();
        tween(this.topHud).to(0.16, { position: nextTopPosition }).start();
        tween(this.bottomHud).to(0.16, { position: nextBottomPosition }).start();
    }

    private spawnFloatingText(text: string, tablePosition: Vec2, color: Color, fontSize = 24, rise = 62): void {
        const label = UiFactory.createLabel(this.fxLayer, `Float-${Date.now()}-${Math.random()}`, text, fontSize, tablePosition, color, 180, 36);
        const node = label.node;
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        opacity.opacity = 255;
        node.setScale(0.86, 0.86, 1);
        tween(opacity).to(0.16, { opacity: 255 }).to(0.46, { opacity: 0 }).start();
        tween(node)
            .to(0.14, { scale: v3(1, 1, 1), position: v3(tablePosition.x, tablePosition.y + rise * 0.42, 0) })
            .to(0.48, { position: v3(tablePosition.x, tablePosition.y + rise, 0) })
            .call(() => node.destroy())
            .start();
    }

    private getBallTypeLabel(ballType: BallType): string {
        switch (ballType) {
            case BallType.Red:
                return '红球';
            case BallType.Yellow:
                return '黄球';
            case BallType.Green:
                return '绿球';
            case BallType.Brown:
                return '棕球';
            case BallType.Blue:
                return '蓝球';
            case BallType.Pink:
                return '粉球';
            case BallType.Black:
                return '黑球';
            case BallType.Cue:
            default:
                return '白球';
        }
    }

    private toTableLocal(gameLocal: Vec2): Vec2 {
        return v2(gameLocal.x - this.tableRoot.position.x, gameLocal.y - this.tableRoot.position.y);
    }

    private getCueBall(): BallState | undefined {
        return this.balls.find((ball) => ball.ballType === BallType.Cue);
    }
}
