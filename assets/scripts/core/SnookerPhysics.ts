import { Rect, Vec2, v2 } from 'cc';
import {
    BALL_RESTITUTION,
    LINEAR_FRICTION,
    POCKET_CAPTURE_RADIUS,
    STOP_SPEED,
    TABLE_INNER_HEIGHT,
    TABLE_INNER_WIDTH,
    WALL_RESTITUTION,
} from '../config/SnookerConfig';
import { BallState } from './SnookerTypes';

export class SnookerPhysics {
    private readonly playRect = new Rect(
        -TABLE_INNER_WIDTH / 2,
        -TABLE_INNER_HEIGHT / 2,
        TABLE_INNER_WIDTH,
        TABLE_INNER_HEIGHT,
    );

    public step(balls: BallState[], pockets: readonly Vec2[], dt: number): BallState[] {
        const pottedThisFrame: BallState[] = [];

        for (const ball of balls) {
            if (ball.isPotted) {
                continue;
            }

            this.applyFriction(ball, dt);
            ball.position.add(ball.velocity.clone().multiplyScalar(dt));
            this.resolveRailCollision(ball);
        }

        for (let i = 0; i < balls.length; i++) {
            const left = balls[i];
            if (left.isPotted) {
                continue;
            }

            for (let j = i + 1; j < balls.length; j++) {
                const right = balls[j];
                if (right.isPotted) {
                    continue;
                }
                this.resolveBallCollision(left, right);
            }
        }

        for (const ball of balls) {
            if (ball.isPotted) {
                continue;
            }

            for (const pocket of pockets) {
                if (ball.position.clone().subtract(pocket).length() <= POCKET_CAPTURE_RADIUS) {
                    ball.isPotted = true;
                    ball.velocity.set(Vec2.ZERO);
                    pottedThisFrame.push(ball);
                    break;
                }
            }
        }

        return pottedThisFrame;
    }

    public areAllBallsStopped(balls: BallState[]): boolean {
        return balls.every((ball) => ball.isPotted || ball.velocity.lengthSqr() <= STOP_SPEED * STOP_SPEED);
    }

    public isPointInsidePlayArea(point: Vec2): boolean {
        return this.playRect.contains(point);
    }

    private applyFriction(ball: BallState, dt: number): void {
        const speed = ball.velocity.length();
        if (speed <= 0) {
            ball.velocity.set(Vec2.ZERO);
            return;
        }

        const nextSpeed = Math.max(0, speed - LINEAR_FRICTION * dt);
        if (nextSpeed <= STOP_SPEED) {
            ball.velocity.set(Vec2.ZERO);
            return;
        }

        ball.velocity.multiplyScalar(nextSpeed / speed);
    }

    private resolveRailCollision(ball: BallState): void {
        const minX = this.playRect.x + ball.radius;
        const maxX = this.playRect.x + this.playRect.width - ball.radius;
        const minY = this.playRect.y + ball.radius;
        const maxY = this.playRect.y + this.playRect.height - ball.radius;

        if (ball.position.x < minX) {
            ball.position.x = minX;
            ball.velocity.x = Math.abs(ball.velocity.x) * WALL_RESTITUTION;
        } else if (ball.position.x > maxX) {
            ball.position.x = maxX;
            ball.velocity.x = -Math.abs(ball.velocity.x) * WALL_RESTITUTION;
        }

        if (ball.position.y < minY) {
            ball.position.y = minY;
            ball.velocity.y = Math.abs(ball.velocity.y) * WALL_RESTITUTION;
        } else if (ball.position.y > maxY) {
            ball.position.y = maxY;
            ball.velocity.y = -Math.abs(ball.velocity.y) * WALL_RESTITUTION;
        }
    }

    private resolveBallCollision(left: BallState, right: BallState): void {
        const delta = right.position.clone().subtract(left.position);
        let distance = delta.length();
        const minDistance = left.radius + right.radius;

        if (distance >= minDistance) {
            return;
        }

        if (distance === 0) {
            delta.set(v2(1, 0));
            distance = 1;
        }

        const normal = delta.multiplyScalar(1 / distance);
        const overlap = minDistance - distance;
        const correction = normal.clone().multiplyScalar(overlap * 0.5);
        left.position.subtract(correction);
        right.position.add(correction);

        const relativeVelocity = right.velocity.clone().subtract(left.velocity);
        const separatingSpeed = relativeVelocity.dot(normal);
        if (separatingSpeed > 0) {
            return;
        }

        const impulse = -(1 + BALL_RESTITUTION) * separatingSpeed * 0.5;
        const impulseVector = normal.multiplyScalar(impulse);
        left.velocity.subtract(impulseVector);
        right.velocity.add(impulseVector);
    }
}
