import { BALL_SCORES } from '../config/SnookerConfig';
import { BallState, BallType, ShotResolution } from './SnookerTypes';

export class SnookerRules {
    public evaluateShot(pottedBalls: BallState[]): ShotResolution {
        const cueBallPotted = pottedBalls.some((ball) => ball.ballType === BallType.Cue);
        const objectBalls = pottedBalls.filter((ball) => ball.ballType !== BallType.Cue);
        const scoreDelta = objectBalls.reduce((sum, ball) => sum + BALL_SCORES[ball.ballType], 0);
        const foulPenalty = cueBallPotted ? 4 : 0;
        const breakDelta = cueBallPotted ? 0 : scoreDelta;

        let message = '\u672c\u6746\u672a\u8fdb\u7403\uff0c\u8f6e\u5230\u4e0b\u4e00\u6b21\u51fb\u7403\u3002';
        if (cueBallPotted && objectBalls.length > 0) {
            message = `\u8fdb\u7403 +${scoreDelta}\uff0c\u4f46\u767d\u7403\u843d\u888b\uff0c\u72af\u89c4 -${foulPenalty}\u3002`;
        } else if (cueBallPotted) {
            message = `\u767d\u7403\u843d\u888b\uff0c\u72af\u89c4 -${foulPenalty}\u3002`;
        } else if (objectBalls.length > 0) {
            message = `\u672c\u6746\u8fdb\u7403 +${scoreDelta}\uff0c\u7ee7\u7eed\u4fdd\u6301\u624b\u611f\u3002`;
        }

        return {
            pottedBalls,
            cueBallPotted,
            scoreDelta,
            foulPenalty,
            breakDelta,
            message,
        };
    }
}
