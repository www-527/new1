import { BALL_SCORES } from '../config/SnookerConfig';
import { BallState, BallType, ShotResolution } from './SnookerTypes';

export class SnookerRules {
    public evaluateShot(pottedBalls: BallState[]): ShotResolution {
        const cueBallPotted = pottedBalls.some((ball) => ball.ballType === BallType.Cue);
        const objectBalls = pottedBalls.filter((ball) => ball.ballType !== BallType.Cue);
        const scoreDelta = objectBalls.reduce((sum, ball) => sum + BALL_SCORES[ball.ballType], 0);
        const foulPenalty = cueBallPotted ? 4 : 0;
        const breakDelta = cueBallPotted ? 0 : scoreDelta;

        let message = '本杆未进球，轮到下一次击球。';
        if (cueBallPotted && objectBalls.length > 0) {
            message = `进球 +${scoreDelta}，但白球落袋，犯规 -${foulPenalty}。`;
        } else if (cueBallPotted) {
            message = `白球落袋，犯规 -${foulPenalty}。`;
        } else if (objectBalls.length > 0) {
            message = `本杆进球 +${scoreDelta}，继续保持手感。`;
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
