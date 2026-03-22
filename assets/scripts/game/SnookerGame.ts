import {
    _decorator,
    Color,
    Component,
    Graphics,
    Label,
    Layers,
    Node,
    Size,
    UITransform,
    UIOpacity,
    Vec2,
    math,
    sys,
    tween,
    v2,
    v3,
} from 'cc';
import {
    BALL_COLORS,
    BALL_RADIUS,
    BALL_SCORES,
    CUE_START_POSITION,
    DESIGN_SIZE,
    FIXED_TIME_STEP,
    LEVEL_CONFIGS,
    MAX_DRAG_DISTANCE,
    MAX_SHOT_SPEED,
    MIN_SHOT_SPEED,
    POCKET_POSITIONS,
    PRACTICE_LAYOUTS,
    TABLE_CENTER,
    TABLE_INNER_HEIGHT,
    TABLE_INNER_WIDTH,
    TABLE_OUTER_HEIGHT,
    TABLE_OUTER_WIDTH,
} from '../config/SnookerConfig';
import { PointerInput } from '../core/PointerInput';
import { SnookerPhysics } from '../core/SnookerPhysics';
import { SnookerRules } from '../core/SnookerRules';
import { BallState, BallType, MatchMode, PlayPhase } from '../core/SnookerTypes';
import { UiFactory } from '../ui/UiFactory';

const { ccclass } = _decorator;
const HIGH_SCORE_KEY = 'simple-snooker-high-score';
const SOUND_KEY = 'simple-snooker-sound-enabled';

@ccclass('SnookerGame')
export class SnookerGame extends Component {
    private phase = PlayPhase.Menu;
    private resumePhase = PlayPhase.Idle;
    private mode = MatchMode.Practice;
    private selectedLevelIndex = 0;
    private physics = new SnookerPhysics();
    private rules = new SnookerRules();
    private pointerInput: PointerInput | null = null;

    private menuLayer!: Node;
    private gameLayer!: Node;
    private overlayLayer!: Node;
    private tableRoot!: Node;
    private tableBallLayer!: Node;
    private fxLayer!: Node;
    private touchLayer!: Node;
    private aimGraphics!: Graphics;
    private cueGraphics!: Graphics;
    private powerFillGraphics!: Graphics;

    private scoreLabel!: Label;
    private breakLabel!: Label;
    private stageLabel!: Label;
    private shotsLabel!: Label;
    private statusLabel!: Label;
    private powerValueLabel!: Label;
    private menuLevelLabel!: Label;
    private menuDetailLabel!: Label;
    private menuHighScoreLabel!: Label;
    private soundButtonLabel!: Label;
    private overlayTitleLabel!: Label;
    private overlayDetailLabel!: Label;
    private overlayResumeButton!: Node;

    private balls: BallState[] = [];
    private pottedThisShot: BallState[] = [];
    private physicsAccumulator = 0;
    private score = 0;
    private currentBreak = 0;
    private shotsUsed = 0;
    private pottedCount = 0;
    private highScore = 0;
    private soundEnabled = true;

    protected onLoad(): void {
        this.initializeRoot();
        this.loadPersistentData();
        this.buildSceneGraph();
        this.bindPointerInput();
        this.showMenu();
    }

    protected onDestroy(): void {
        this.pointerInput?.destroy();
        this.pointerInput = null;
    }

    protected update(deltaTime: number): void {
        if (this.phase !== PlayPhase.Moving) {
            return;
        }

        this.physicsAccumulator += Math.min(deltaTime, 0.033);
        while (this.physicsAccumulator >= FIXED_TIME_STEP) {
            this.physicsAccumulator -= FIXED_TIME_STEP;
            const pottedBalls = this.physics.step(this.balls, POCKET_POSITIONS, FIXED_TIME_STEP);
            if (pottedBalls.length > 0) {
                this.onBallsPotted(pottedBalls);
            }
            this.syncBallVisuals();
        }

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
        this.highScore = Number(sys.localStorage.getItem(HIGH_SCORE_KEY) ?? 0);
        const soundRaw = sys.localStorage.getItem(SOUND_KEY);
        this.soundEnabled = soundRaw === null ? true : soundRaw === '1';
    }

    private savePersistentData(): void {
        sys.localStorage.setItem(HIGH_SCORE_KEY, `${this.highScore}`);
        sys.localStorage.setItem(SOUND_KEY, this.soundEnabled ? '1' : '0');
    }

    private buildSceneGraph(): void {
        this.node.removeAllChildren();
        this.buildBackground();
        this.buildMenuLayer();
        this.buildGameLayer();
        this.buildOverlayLayer();
    }

    private buildBackground(): void {
        UiFactory.createRoundRect(this.node, 'Background', new Size(DESIGN_SIZE.width, DESIGN_SIZE.height), v3(0, 0, 0), new Color(17, 17, 20, 255));
        const glowNode = new Node('BackdropGlow');
        glowNode.layer = Layers.Enum.UI_2D;
        this.node.addChild(glowNode);
        glowNode.setPosition(0, 0, 0);
        glowNode.addComponent(UITransform).setContentSize(DESIGN_SIZE);
        const graphics = glowNode.addComponent(Graphics);
        graphics.fillColor = new Color(34, 58, 40, 180);
        graphics.roundRect(-420, -200, 840, 400, 48);
        graphics.fill();
        UiFactory.createRoundRect(this.node, 'TopStrip', new Size(1180, 88), v3(0, 296, 0), new Color(28, 28, 31, 220), new Color(137, 100, 44, 255), 18);
    }

    private buildMenuLayer(): void {
        this.menuLayer = new Node('MenuLayer');
        this.menuLayer.layer = Layers.Enum.UI_2D;
        this.node.addChild(this.menuLayer);
        this.menuLayer.addComponent(UITransform).setContentSize(DESIGN_SIZE);

        const title = UiFactory.createLabel(this.menuLayer, 'Title', 'Snooker Break', 42, v3(0, 225, 0), new Color(250, 245, 233, 255), 520, 70);
        UiFactory.createLabel(this.menuLayer, 'Subtitle', '简洁休闲风，拖拽瞄准，松手击球，兼容鼠标与触屏。', 20, v3(0, 182, 0), new Color(205, 208, 214, 255), 700, 40);

        const previewTable = UiFactory.createRoundRect(this.menuLayer, 'PreviewTable', new Size(660, 270), v3(210, -10, 0), new Color(92, 52, 23, 255), new Color(188, 148, 79, 255), 28);
        const felt = UiFactory.createRoundRect(previewTable, 'PreviewFelt', new Size(596, 206), v3(0, 0, 0), new Color(44, 136, 67, 255), undefined, 18);
        for (const pocket of [v2(-298, 103), v2(0, 103), v2(298, 103), v2(-298, -103), v2(0, -103), v2(298, -103)]) {
            UiFactory.createCircle(felt, `PreviewPocket-${pocket.x}-${pocket.y}`, 18, pocket, new Color(20, 18, 18, 255));
        }
        [
            { position: v2(-150, 0), color: BALL_COLORS[BallType.Cue] },
            { position: v2(-40, 0), color: BALL_COLORS[BallType.Red] },
            { position: v2(-10, 16), color: BALL_COLORS[BallType.Red] },
            { position: v2(-10, -16), color: BALL_COLORS[BallType.Red] },
            { position: v2(115, 0), color: BALL_COLORS[BallType.Blue] },
            { position: v2(220, -10), color: BALL_COLORS[BallType.Yellow] },
            { position: v2(270, -10), color: BALL_COLORS[BallType.Black] },
        ].forEach((ball, index) => UiFactory.createCircle(felt, `PreviewBall-${index}`, 12, ball.position, ball.color));

        const leftPanel = UiFactory.createRoundRect(this.menuLayer, 'LeftPanel', new Size(360, 360), v3(-340, -12, 0), new Color(29, 29, 32, 225), new Color(118, 90, 44, 255), 26);
        this.menuLevelLabel = UiFactory.createLabel(leftPanel, 'MenuLevelLabel', '', 24, v3(0, 112, 0), new Color(250, 245, 233, 255), 280, 42);
        this.menuDetailLabel = UiFactory.createLabel(leftPanel, 'MenuDetailLabel', '', 18, v3(0, 44, 0), new Color(205, 208, 214, 255), 300, 110);
        this.menuHighScoreLabel = UiFactory.createLabel(leftPanel, 'MenuHighScoreLabel', '', 18, v3(0, -40, 0), new Color(240, 198, 52, 255), 280, 40);
        this.createButton(leftPanel, '上一关', v3(-86, -112, 0), new Size(116, 46), new Color(59, 59, 64, 255), () => this.selectLevel(-1));
        this.createButton(leftPanel, '下一关', v3(86, -112, 0), new Size(116, 46), new Color(59, 59, 64, 255), () => this.selectLevel(1));
        this.createButton(leftPanel, '开始闯关', v3(0, -176, 0), new Size(250, 56), new Color(44, 146, 58, 255), () => this.startLevelMode());
        this.createButton(this.menuLayer, '练习模式', v3(-205, -244, 0), new Size(180, 56), new Color(40, 118, 165, 255), () => this.startPracticeMode());
        const soundButton = this.createButton(this.menuLayer, '', v3(0, -244, 0), new Size(180, 56), new Color(78, 61, 35, 255), () => this.toggleSound());
        this.soundButtonLabel = soundButton.getChildByName('ButtonLabel')!.getComponent(Label)!;
        this.createButton(this.menuLayer, '重新开始', v3(205, -244, 0), new Size(180, 56), new Color(137, 68, 47, 255), () => this.startLevelMode());
        this.refreshMenuPreview();
    }

    private buildGameLayer(): void {
        this.gameLayer = new Node('GameLayer');
        this.gameLayer.layer = Layers.Enum.UI_2D;
        this.node.addChild(this.gameLayer);
        this.gameLayer.addComponent(UITransform).setContentSize(DESIGN_SIZE);

        this.tableRoot = new Node('TableRoot');
        this.tableRoot.layer = Layers.Enum.UI_2D;
        this.gameLayer.addChild(this.tableRoot);
        this.tableRoot.setPosition(TABLE_CENTER.x, TABLE_CENTER.y, 0);
        this.tableRoot.addComponent(UITransform).setContentSize(TABLE_OUTER_WIDTH, TABLE_OUTER_HEIGHT);
        this.buildTableVisuals();

        this.touchLayer = new Node('TouchLayer');
        this.touchLayer.layer = Layers.Enum.UI_2D;
        this.gameLayer.addChild(this.touchLayer);
        this.touchLayer.addComponent(UITransform).setContentSize(DESIGN_SIZE);
        this.touchLayer.addComponent(UIOpacity).opacity = 1;

        const topHud = UiFactory.createRoundRect(this.gameLayer, 'TopHud', new Size(1160, 82), v3(0, 296, 0), new Color(25, 25, 28, 235), new Color(147, 110, 54, 255), 18);
        const scoreTitle = UiFactory.createLabel(topHud, 'ScoreTitle', '得分', 18, v3(-450, 18, 0), new Color(210, 212, 220, 255), 120, 28);
        scoreTitle.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.scoreLabel = UiFactory.createLabel(topHud, 'ScoreLabel', '0', 30, v3(-450, -16, 0), Color.WHITE, 120, 36);
        this.scoreLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        const breakTitle = UiFactory.createLabel(topHud, 'BreakTitle', 'BREAK', 18, v3(-70, 18, 0), new Color(210, 212, 220, 255), 140, 28);
        this.breakLabel = UiFactory.createLabel(topHud, 'BreakLabel', '0', 30, v3(-70, -16, 0), new Color(240, 198, 52, 255), 140, 36);
        this.stageLabel = UiFactory.createLabel(topHud, 'StageLabel', '', 22, v3(120, 0, 0), Color.WHITE, 260, 40);
        this.shotsLabel = UiFactory.createLabel(topHud, 'ShotsLabel', '', 20, v3(360, 0, 0), new Color(215, 216, 220, 255), 180, 40);
        this.createButton(topHud, '暂停', v3(500, 0, 0), new Size(92, 42), new Color(95, 74, 38, 255), () => this.togglePause());
        this.createButton(topHud, '重开', v3(390, 0, 0), new Size(92, 42), new Color(67, 67, 72, 255), () => this.restartCurrentMatch());
        this.createButton(topHud, '主页', v3(280, 0, 0), new Size(92, 42), new Color(67, 67, 72, 255), () => this.showMenu());

        const bottomHud = UiFactory.createRoundRect(this.gameLayer, 'BottomHud', new Size(1120, 96), v3(0, -300, 0), new Color(25, 25, 28, 235), new Color(147, 110, 54, 255), 18);
        UiFactory.createLabel(bottomHud, 'PowerTitle', '力度', 18, v3(-440, 22, 0), new Color(210, 212, 220, 255), 80, 26);
        const powerBarBg = UiFactory.createRoundRect(bottomHud, 'PowerBarBg', new Size(330, 24), v3(-230, -2, 0), new Color(49, 49, 54, 255), new Color(110, 110, 118, 255), 12);
        const powerFill = new Node('PowerFill');
        powerFill.layer = Layers.Enum.UI_2D;
        powerBarBg.addChild(powerFill);
        powerFill.addComponent(UITransform).setContentSize(320, 18);
        this.powerFillGraphics = powerFill.addComponent(Graphics);
        this.powerValueLabel = UiFactory.createLabel(bottomHud, 'PowerValue', '0%', 18, v3(-40, -2, 0), new Color(240, 198, 52, 255), 80, 28);
        this.statusLabel = UiFactory.createLabel(bottomHud, 'StatusLabel', '拖动白球后方蓄力，松手击球。', 18, v3(250, -2, 0), new Color(225, 226, 231, 255), 520, 40);

        this.gameLayer.active = false;
        this.renderPowerBar(0);
    }

    private buildTableVisuals(): void {
        const outer = UiFactory.createRoundRect(this.tableRoot, 'TableOuter', new Size(TABLE_OUTER_WIDTH, TABLE_OUTER_HEIGHT), v3(0, 0, 0), new Color(101, 54, 25, 255), new Color(193, 156, 82, 255), 36);
        const felt = UiFactory.createRoundRect(outer, 'TableFelt', new Size(TABLE_INNER_WIDTH, TABLE_INNER_HEIGHT), v3(0, 0, 0), new Color(36, 137, 66, 255), undefined, 24);
        const midLineNode = new Node('MidLine');
        midLineNode.layer = Layers.Enum.UI_2D;
        felt.addChild(midLineNode);
        midLineNode.addComponent(UITransform).setContentSize(TABLE_INNER_WIDTH, TABLE_INNER_HEIGHT);
        const midGraphics = midLineNode.addComponent(Graphics);
        midGraphics.strokeColor = new Color(255, 255, 255, 30);
        midGraphics.lineWidth = 2;
        midGraphics.moveTo(-TABLE_INNER_WIDTH / 2 + 190, -TABLE_INNER_HEIGHT / 2 + 20);
        midGraphics.lineTo(-TABLE_INNER_WIDTH / 2 + 190, TABLE_INNER_HEIGHT / 2 - 20);
        midGraphics.stroke();
        for (let index = 0; index < POCKET_POSITIONS.length; index++) {
            UiFactory.createCircle(felt, `Pocket-${index}`, 22, POCKET_POSITIONS[index], new Color(18, 16, 17, 255));
        }
        this.tableBallLayer = new Node('BallLayer');
        this.tableBallLayer.layer = Layers.Enum.UI_2D;
        felt.addChild(this.tableBallLayer);
        this.tableBallLayer.addComponent(UITransform).setContentSize(TABLE_INNER_WIDTH, TABLE_INNER_HEIGHT);
        const aimNode = new Node('AimGraphics');
        aimNode.layer = Layers.Enum.UI_2D;
        felt.addChild(aimNode);
        aimNode.addComponent(UITransform).setContentSize(TABLE_INNER_WIDTH, TABLE_INNER_HEIGHT);
        this.aimGraphics = aimNode.addComponent(Graphics);
        const cueNode = new Node('CueGraphics');
        cueNode.layer = Layers.Enum.UI_2D;
        felt.addChild(cueNode);
        cueNode.addComponent(UITransform).setContentSize(TABLE_INNER_WIDTH, TABLE_INNER_HEIGHT);
        this.cueGraphics = cueNode.addComponent(Graphics);
        this.fxLayer = new Node('FxLayer');
        this.fxLayer.layer = Layers.Enum.UI_2D;
        felt.addChild(this.fxLayer);
        this.fxLayer.addComponent(UITransform).setContentSize(TABLE_INNER_WIDTH, TABLE_INNER_HEIGHT);
    }

    private buildOverlayLayer(): void {
        this.overlayLayer = new Node('OverlayLayer');
        this.overlayLayer.layer = Layers.Enum.UI_2D;
        this.node.addChild(this.overlayLayer);
        this.overlayLayer.addComponent(UITransform).setContentSize(DESIGN_SIZE);
        const mask = UiFactory.createRoundRect(this.overlayLayer, 'OverlayMask', new Size(DESIGN_SIZE.width, DESIGN_SIZE.height), v3(0, 0, 0), new Color(0, 0, 0, 200));
        mask.getComponent(UIOpacity)!.opacity = 180;
        const panel = UiFactory.createRoundRect(this.overlayLayer, 'OverlayPanel', new Size(520, 300), v3(0, 10, 0), new Color(30, 30, 34, 245), new Color(150, 115, 54, 255), 26);
        this.overlayTitleLabel = UiFactory.createLabel(panel, 'OverlayTitle', '', 34, v3(0, 92, 0), Color.WHITE, 360, 56);
        this.overlayDetailLabel = UiFactory.createLabel(panel, 'OverlayDetail', '', 20, v3(0, 20, 0), new Color(220, 222, 227, 255), 400, 120);
        this.overlayResumeButton = this.createButton(panel, '继续游戏', v3(0, -28, 0), new Size(220, 48), new Color(52, 126, 187, 255), () => {
            this.togglePause();
        });
        this.createButton(panel, '再来一局', v3(-110, -92, 0), new Size(180, 52), new Color(44, 146, 58, 255), () => this.restartCurrentMatch());
        this.createButton(panel, '返回主页', v3(110, -92, 0), new Size(180, 52), new Color(75, 75, 80, 255), () => this.showMenu());
        this.overlayLayer.active = false;
    }

    private bindPointerInput(): void {
        this.pointerInput = new PointerInput(this.touchLayer, {
            onStart: ({ local }) => this.onPointerStart(local),
            onMove: ({ local }) => this.onPointerMove(local),
            onEnd: ({ local }) => this.onPointerEnd(local),
            onCancel: () => this.cancelAim(),
        });
    }

    private createButton(parent: Node, text: string, position: Vec2 | ReturnType<typeof v3>, size: Size, fillColor: Color, onClick: () => void): Node {
        const button = UiFactory.createRoundRect(parent, `Button-${text}`, size, position, fillColor, new Color(230, 230, 235, 40), 14);
        const label = UiFactory.createLabel(button, 'ButtonLabel', text, 20, v3(0, 0, 0), Color.WHITE, size.width - 24, size.height - 8);
        const handler = () => onClick();
        button.on(Node.EventType.TOUCH_END, handler, this);
        button.on(Node.EventType.MOUSE_UP, handler, this);
        return button;
    }

    private selectLevel(offset: number): void {
        const total = LEVEL_CONFIGS.length;
        this.selectedLevelIndex = (this.selectedLevelIndex + offset + total) % total;
        this.refreshMenuPreview();
    }

    private refreshMenuPreview(): void {
        const config = LEVEL_CONFIGS[this.selectedLevelIndex];
        this.menuLevelLabel.string = config.name;
        this.menuDetailLabel.string = `${config.description}\n目标分数：${config.targetScore}\n推荐杆数：${config.shotLimit}`;
        this.menuHighScoreLabel.string = `本地最高分：${this.highScore}`;
        this.soundButtonLabel.string = this.soundEnabled ? '音效：开启' : '音效：关闭';
    }

    private toggleSound(): void {
        this.soundEnabled = !this.soundEnabled;
        this.savePersistentData();
        this.refreshMenuPreview();
    }

    private startPracticeMode(): void {
        this.mode = MatchMode.Practice;
        this.startMatch();
    }

    private startLevelMode(): void {
        this.mode = MatchMode.Level;
        this.startMatch();
    }

    private startMatch(): void {
        this.score = 0;
        this.currentBreak = 0;
        this.shotsUsed = 0;
        this.pottedCount = 0;
        this.physicsAccumulator = 0;
        this.pottedThisShot = [];
        this.clearTableBalls();
        this.spawnMatchBalls();
        this.syncBallVisuals();
        this.clearAimGuides();
        this.renderPowerBar(0);
        this.menuLayer.active = false;
        this.gameLayer.active = true;
        this.overlayLayer.active = false;
        this.phase = PlayPhase.Idle;
        this.statusLabel.string = '拖动白球后方蓄力，松手击球。';
        this.refreshHud();
    }

    private restartCurrentMatch(): void {
        if (this.phase === PlayPhase.Menu) {
            this.startLevelMode();
            return;
        }
        this.startMatch();
    }

    private showMenu(): void {
        this.phase = PlayPhase.Menu;
        this.menuLayer.active = true;
        this.gameLayer.active = false;
        this.overlayLayer.active = false;
        this.clearAimGuides();
        this.refreshMenuPreview();
    }

    private togglePause(): void {
        if (this.phase === PlayPhase.Menu || this.phase === PlayPhase.Settlement) {
            return;
        }
        if (this.phase === PlayPhase.Paused) {
            this.phase = this.resumePhase;
            this.overlayLayer.active = false;
            this.statusLabel.string = '继续游戏，拖动白球后方蓄力。';
            return;
        }
        this.resumePhase = this.phase === PlayPhase.Aiming ? PlayPhase.Idle : this.phase;
        this.cancelAim();
        this.phase = PlayPhase.Paused;
        this.overlayTitleLabel.string = '已暂停';
        this.overlayDetailLabel.string = '你可以继续当前球局，或者直接返回主页。';
        this.overlayResumeButton.active = true;
        this.overlayLayer.active = true;
    }

    private spawnMatchBalls(): void {
        const layouts = this.mode === MatchMode.Practice ? PRACTICE_LAYOUTS : LEVEL_CONFIGS[this.selectedLevelIndex].ballLayouts;
        this.balls = [];
        this.createBall(BallType.Cue, CUE_START_POSITION.clone(), 'cue-ball');
        layouts.forEach((layout, index) => this.createBall(layout.ballType, layout.position.clone(), layout.id ?? `${layout.ballType}-${index}`));
    }

    private createBall(ballType: BallType, position: Vec2, id: string): void {
        const shadowNode = UiFactory.createCircle(this.tableBallLayer, `${id}-shadow`, BALL_RADIUS, position.clone().add(v2(4, -4)), new Color(0, 0, 0, 80), 120);
        const ballNode = UiFactory.createCircle(this.tableBallLayer, id, BALL_RADIUS, position, BALL_COLORS[ballType]);
        const highlight = UiFactory.createCircle(ballNode, `${id}-highlight`, BALL_RADIUS * 0.35, v2(-BALL_RADIUS * 0.34, BALL_RADIUS * 0.32), new Color(255, 255, 255, 110), 160);
        highlight.setScale(0.92, 0.8, 1);
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
            ball.node.destroy();
            ball.shadowNode.destroy();
        }
        this.balls = [];
    }

    private refreshHud(): void {
        this.scoreLabel.string = `${this.score}`;
        this.breakLabel.string = `${this.currentBreak}`;
        this.stageLabel.string = this.mode === MatchMode.Practice ? '练习模式' : LEVEL_CONFIGS[this.selectedLevelIndex].name;
        if (this.mode === MatchMode.Practice) {
            this.shotsLabel.string = `已出杆 ${this.shotsUsed}`;
        } else {
            const leftShots = Math.max(0, LEVEL_CONFIGS[this.selectedLevelIndex].shotLimit - this.shotsUsed);
            this.shotsLabel.string = `剩余杆数 ${leftShots}`;
        }
    }

    private onPointerStart(localInGame: Vec2): void {
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
        if (cueBall.position.clone().subtract(localOnTable).length() > BALL_RADIUS * 3.5) {
            return;
        }
        this.phase = PlayPhase.Aiming;
        this.updateAimGuides(localOnTable);
    }

    private onPointerMove(localInGame: Vec2): void {
        if (this.phase !== PlayPhase.Aiming) {
            return;
        }
        this.updateAimGuides(this.toTableLocal(localInGame));
    }

    private onPointerEnd(localInGame: Vec2): void {
        if (this.phase !== PlayPhase.Aiming) {
            return;
        }
        this.shootCueBall(this.toTableLocal(localInGame));
    }

    private cancelAim(): void {
        if (this.phase === PlayPhase.Aiming) {
            this.phase = PlayPhase.Idle;
        }
        this.clearAimGuides();
        this.renderPowerBar(0);
        this.powerValueLabel.string = '0%';
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
        this.phase = PlayPhase.Moving;
        this.shotsUsed += 1;
        this.pottedThisShot = [];
        this.renderPowerBar(powerRatio);
        this.powerValueLabel.string = `${Math.round(powerRatio * 100)}%`;
        this.statusLabel.string = '球体运动中...';
        this.refreshHud();
        this.clearAimGuides();
    }

    private onBallsPotted(pottedBalls: BallState[]): void {
        this.pottedThisShot.push(...pottedBalls);
        for (const ball of pottedBalls) {
            ball.node.active = false;
            ball.shadowNode.active = false;
            if (ball.ballType !== BallType.Cue) {
                this.pottedCount += 1;
                this.spawnFloatingText(`+${ball.scoreValue}`, ball.position.clone(), ball.color);
            } else {
                this.spawnFloatingText('犯规', ball.position.clone(), new Color(255, 120, 120, 255));
            }
        }
    }

    private finishCurrentShot(): void {
        this.phase = PlayPhase.Idle;
        this.physicsAccumulator = 0;
        const resolution = this.rules.evaluateShot(this.pottedThisShot);
        this.score = Math.max(0, this.score + resolution.scoreDelta - resolution.foulPenalty);
        this.currentBreak = resolution.breakDelta > 0 ? this.currentBreak + resolution.breakDelta : 0;
        if (resolution.cueBallPotted) {
            this.respotCueBall();
        }
        this.statusLabel.string = resolution.message;
        this.renderPowerBar(0);
        this.powerValueLabel.string = '0%';
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.savePersistentData();
        }
        this.refreshHud();
        this.syncBallVisuals();
        this.pottedThisShot = [];
        if (this.shouldSettleMatch()) {
            this.showSettlement();
        }
    }

    private shouldSettleMatch(): boolean {
        const hasRemainingObjectBall = this.balls.some((ball) => !ball.isPotted && ball.ballType !== BallType.Cue);
        if (this.mode === MatchMode.Practice) {
            return !hasRemainingObjectBall;
        }
        const config = LEVEL_CONFIGS[this.selectedLevelIndex];
        const leftShots = Math.max(0, config.shotLimit - this.shotsUsed);
        return this.score >= config.targetScore || leftShots <= 0 || !hasRemainingObjectBall;
    }

    private showSettlement(): void {
        this.phase = PlayPhase.Settlement;
        const passed = this.mode === MatchMode.Practice ? true : this.score >= LEVEL_CONFIGS[this.selectedLevelIndex].targetScore;
        this.overlayResumeButton.active = false;
        this.overlayTitleLabel.string = this.mode === MatchMode.Practice ? '练习完成' : passed ? '闯关成功' : '本关未达标';
        if (this.mode === MatchMode.Practice) {
            this.overlayDetailLabel.string = `本局得分：${this.score}\n进球数量：${this.pottedCount}\n出杆次数：${this.shotsUsed}\n本地最高分：${this.highScore}`;
        } else {
            const config = LEVEL_CONFIGS[this.selectedLevelIndex];
            this.overlayDetailLabel.string = `本局得分：${this.score}\n目标分数：${config.targetScore}\n进球数量：${this.pottedCount}\n出杆次数：${this.shotsUsed}\n${passed ? '你已经可以继续挑战下一关。' : '可以重开再试，先稳住力度控制。'}`;
        }
        this.overlayLayer.active = true;
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
        this.powerValueLabel.string = `${Math.round(powerRatio * 100)}%`;
        if (shotVector.length() <= 4) {
            this.clearAimGuides();
            return;
        }
        const direction = shotVector.normalize();
        const lineLength = 140 + powerRatio * 140;
        this.aimGraphics.clear();
        this.aimGraphics.lineWidth = 4;
        this.aimGraphics.strokeColor = new Color(255, 255, 255, 160);
        let distance = 22;
        while (distance < lineLength) {
            const start = cueBall.position.clone().add(direction.clone().multiplyScalar(distance));
            const end = cueBall.position.clone().add(direction.clone().multiplyScalar(Math.min(lineLength, distance + 16)));
            this.aimGraphics.moveTo(start.x, start.y);
            this.aimGraphics.lineTo(end.x, end.y);
            distance += 26;
        }
        this.aimGraphics.stroke();
        this.cueGraphics.clear();
        this.cueGraphics.lineWidth = 10;
        this.cueGraphics.strokeColor = new Color(122, 81, 40, 240);
        const cueStart = cueBall.position.clone().subtract(direction.clone().multiplyScalar(24));
        const cueEnd = cueBall.position.clone().subtract(direction.clone().multiplyScalar(96 + powerRatio * 76));
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
        const width = 308 * clamped;
        this.powerFillGraphics.clear();
        if (width <= 0) {
            return;
        }
        const color = clamped < 0.45 ? new Color(71, 194, 83, 255) : clamped < 0.75 ? new Color(232, 180, 46, 255) : new Color(212, 76, 62, 255);
        this.powerFillGraphics.fillColor = color;
        this.powerFillGraphics.roundRect(-154, -9, width, 18, 9);
        this.powerFillGraphics.fill();
    }

    private spawnFloatingText(text: string, tablePosition: Vec2, color: Color): void {
        const label = UiFactory.createLabel(this.fxLayer, `Float-${Date.now()}-${Math.random()}`, text, 24, tablePosition, color, 120, 32);
        const node = label.node;
        const opacity = node.addComponent(UIOpacity);
        opacity.opacity = 255;
        tween(node).to(0.65, { position: v3(tablePosition.x, tablePosition.y + 62, 0) }).call(() => node.destroy()).start();
    }

    private toTableLocal(gameLocal: Vec2): Vec2 {
        return v2(gameLocal.x - this.tableRoot.position.x, gameLocal.y - this.tableRoot.position.y);
    }

    private getCueBall(): BallState | undefined {
        return this.balls.find((ball) => ball.ballType === BallType.Cue);
    }
}
