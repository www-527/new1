import { Color, Size, Vec2, v2 } from 'cc';
import { BallLayout, BallType, MatchMode, MatchModeConfig } from '../core/SnookerTypes';

export const DESIGN_SIZE = new Size(1280, 720);
export const TABLE_OUTER_WIDTH = 1040;
export const TABLE_OUTER_HEIGHT = 560;
export const TABLE_RAIL = 34;
export const TABLE_INNER_WIDTH = TABLE_OUTER_WIDTH - TABLE_RAIL * 2;
export const TABLE_INNER_HEIGHT = TABLE_OUTER_HEIGHT - TABLE_RAIL * 2;
export const BALL_RADIUS = 14;
export const POCKET_RADIUS = 30;
export const POCKET_CAPTURE_RADIUS = 32;
export const BALL_RESTITUTION = 0.98;
export const WALL_RESTITUTION = 0.9;
export const LINEAR_FRICTION = 260;
export const STOP_SPEED = 8;
export const MAX_DRAG_DISTANCE = 220;
export const MAX_SHOT_SPEED = 1180;
export const MIN_SHOT_SPEED = 220;
export const FIXED_TIME_STEP = 1 / 120;

export const TABLE_CENTER = v2(0, -20);

export const BAULK_LINE_X = -TABLE_INNER_WIDTH * 0.25;
export const D_RADIUS = TABLE_INNER_HEIGHT * 0.17;
const BLUE_SPOT = v2(0, 0);
const PINK_SPOT = v2(TABLE_INNER_WIDTH * 0.2, 0);
const BLACK_SPOT = v2(TABLE_INNER_WIDTH * 0.37, 0);

export const CUE_START_POSITION = v2(BAULK_LINE_X - D_RADIUS * 0.92, 0);

export const POCKET_POSITIONS = [
    v2(-TABLE_INNER_WIDTH / 2, TABLE_INNER_HEIGHT / 2),
    v2(0, TABLE_INNER_HEIGHT / 2),
    v2(TABLE_INNER_WIDTH / 2, TABLE_INNER_HEIGHT / 2),
    v2(-TABLE_INNER_WIDTH / 2, -TABLE_INNER_HEIGHT / 2),
    v2(0, -TABLE_INNER_HEIGHT / 2),
    v2(TABLE_INNER_WIDTH / 2, -TABLE_INNER_HEIGHT / 2),
];

export const BALL_COLORS: Record<BallType, Color> = {
    [BallType.Cue]: new Color(244, 238, 220, 255),
    [BallType.Red]: new Color(205, 42, 48, 255),
    [BallType.Yellow]: new Color(240, 198, 52, 255),
    [BallType.Green]: new Color(46, 142, 74, 255),
    [BallType.Brown]: new Color(140, 84, 38, 255),
    [BallType.Blue]: new Color(45, 100, 219, 255),
    [BallType.Pink]: new Color(242, 122, 168, 255),
    [BallType.Black]: new Color(32, 32, 36, 255),
};

export const BALL_SCORES: Record<BallType, number> = {
    [BallType.Cue]: 0,
    [BallType.Red]: 1,
    [BallType.Yellow]: 2,
    [BallType.Green]: 3,
    [BallType.Brown]: 4,
    [BallType.Blue]: 5,
    [BallType.Pink]: 6,
    [BallType.Black]: 7,
};

function createTriangleReds(anchor: Vec2, rows: number, spacing = BALL_RADIUS * 2.08): BallLayout[] {
    const layouts: BallLayout[] = [];
    let id = 0;
    for (let row = 0; row < rows; row++) {
        for (let column = 0; column <= row; column++) {
            const x = anchor.x + row * spacing;
            const y = anchor.y + (column - row / 2) * spacing;
            layouts.push({
                id: `red-${id++}`,
                ballType: BallType.Red,
                position: v2(x, y),
            });
        }
    }
    return layouts;
}

function createStandardOpeningLayouts(): BallLayout[] {
    const redSpacing = BALL_RADIUS * 2.08;
    const redApex = v2(PINK_SPOT.x + redSpacing, 0);
    const reds = createTriangleReds(redApex, 5, redSpacing);
    const colors: BallLayout[] = [
        { id: 'yellow-standard', ballType: BallType.Yellow, position: v2(BAULK_LINE_X, -D_RADIUS) },
        { id: 'green-standard', ballType: BallType.Green, position: v2(BAULK_LINE_X, D_RADIUS) },
        { id: 'brown-standard', ballType: BallType.Brown, position: v2(BAULK_LINE_X, 0) },
        { id: 'blue-standard', ballType: BallType.Blue, position: BLUE_SPOT.clone() },
        { id: 'pink-standard', ballType: BallType.Pink, position: PINK_SPOT.clone() },
        { id: 'black-standard', ballType: BallType.Black, position: BLACK_SPOT.clone() },
    ];
    return reds.concat(colors);
}

function createCasualOpeningLayouts(): BallLayout[] {
    const redSpacing = BALL_RADIUS * 2.08;
    const redApex = v2(PINK_SPOT.x + redSpacing * 0.88, 0);
    const reds = createTriangleReds(redApex, 4, redSpacing);
    const colors: BallLayout[] = [
        { id: 'yellow-casual', ballType: BallType.Yellow, position: v2(BAULK_LINE_X, -D_RADIUS) },
        { id: 'green-casual', ballType: BallType.Green, position: v2(BAULK_LINE_X, D_RADIUS) },
        { id: 'blue-casual', ballType: BallType.Blue, position: BLUE_SPOT.clone() },
        { id: 'black-casual', ballType: BallType.Black, position: BLACK_SPOT.clone() },
    ];
    return reds.concat(colors);
}

export const MATCH_MODE_ORDER: MatchMode[] = [MatchMode.Casual, MatchMode.Expert];

export const MATCH_MODE_CONFIGS: Record<MatchMode, MatchModeConfig> = {
    [MatchMode.Casual]: {
        mode: MatchMode.Casual,
        name: '休闲模式',
        subtitle: '10 红 4 彩，适合快速来一局',
        description: '减少红球和彩球数量，保留开球、落袋和基础计分体验，适合碎片时间快速清台。',
        difficultyLabel: '快速开局',
        redCount: 10,
        colorCount: 4,
        ballLayouts: createCasualOpeningLayouts(),
    },
    [MatchMode.Expert]: {
        mode: MatchMode.Expert,
        name: '专家模式',
        subtitle: '标准斯诺克开局，完整单人练习',
        description: '使用完整 15 红 6 彩标准球型，适合连续走位、长杆练习和高分挑战。',
        difficultyLabel: '标准开局',
        redCount: 15,
        colorCount: 6,
        ballLayouts: createStandardOpeningLayouts(),
    },
};
