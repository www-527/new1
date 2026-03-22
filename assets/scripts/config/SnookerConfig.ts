import { Color, Size, Vec2, v2 } from 'cc';
import { BallLayout, BallType, LevelConfig } from '../core/SnookerTypes';

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
export const CUE_START_POSITION = v2(-TABLE_INNER_WIDTH * 0.33, 0);

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
    [BallType.Blue]: new Color(45, 100, 219, 255),
    [BallType.Black]: new Color(32, 32, 36, 255),
};

export const BALL_SCORES: Record<BallType, number> = {
    [BallType.Cue]: 0,
    [BallType.Red]: 1,
    [BallType.Yellow]: 2,
    [BallType.Blue]: 5,
    [BallType.Black]: 7,
};

function createTriangleReds(anchor: Vec2, spacing = BALL_RADIUS * 2.15): BallLayout[] {
    const rows = 3;
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

function createLevelBalls(index: number): BallLayout[] {
    const redAnchorX = -40 + (index % 4) * 28;
    const redAnchorY = ((index % 3) - 1) * 36;
    const reds = createTriangleReds(v2(redAnchorX, redAnchorY));

    const colorOffset = index * 8;
    const colors: BallLayout[] = [
        {
            id: `yellow-${index}`,
            ballType: BallType.Yellow,
            position: v2(180 + (index % 2) * 36, 140 - colorOffset * 0.4),
        },
        {
            id: `blue-${index}`,
            ballType: BallType.Blue,
            position: v2(120 - (index % 3) * 40, 0 + (index % 2 === 0 ? 40 : -40)),
        },
        {
            id: `black-${index}`,
            ballType: BallType.Black,
            position: v2(300 - (index % 4) * 22, -140 + colorOffset * 0.35),
        },
    ];

    return reds.concat(colors);
}

export const PRACTICE_LAYOUTS: BallLayout[] = [
    ...createTriangleReds(v2(-20, 0)),
    { id: 'yellow-practice', ballType: BallType.Yellow, position: v2(250, -10) },
    { id: 'blue-practice', ballType: BallType.Blue, position: v2(120, 0) },
    { id: 'black-practice', ballType: BallType.Black, position: v2(-260, -170) },
];

export const LEVEL_CONFIGS: LevelConfig[] = Array.from({ length: 10 }, (_, rawIndex) => {
    const index = rawIndex + 1;
    return {
        id: index,
        name: `第 ${index} 关`,
        description: index <= 3
            ? '开放布局，适合熟悉拖拽瞄准和落袋节奏。'
            : index <= 7
                ? '红球更靠近中台，需要更稳的力度控制。'
                : '彩球角度刁钻，建议先清理挡线路径。',
        shotLimit: 5 + Math.floor(index / 2),
        targetScore: 8 + index * 2,
        ballLayouts: createLevelBalls(index),
    };
});
