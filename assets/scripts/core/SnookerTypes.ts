import { Color, Node, Vec2 } from 'cc';

export enum BallType {
    Cue = 'cue',
    Red = 'red',
    Yellow = 'yellow',
    Green = 'green',
    Brown = 'brown',
    Blue = 'blue',
    Pink = 'pink',
    Black = 'black',
}

export enum MatchMode {
    Practice = 'practice',
    Level = 'level',
}

export enum PlayPhase {
    Menu = 'menu',
    Idle = 'idle',
    Aiming = 'aiming',
    Moving = 'moving',
    Paused = 'paused',
    Settlement = 'settlement',
}

export interface BallLayout {
    id?: string;
    ballType: BallType;
    position: Vec2;
}

export interface LevelConfig {
    id: number;
    name: string;
    description: string;
    shotLimit: number;
    targetScore: number;
    ballLayouts: BallLayout[];
}

export interface BallSpec {
    id: string;
    ballType: BallType;
    scoreValue: number;
    color: Color;
    radius: number;
}

export interface BallState extends BallSpec {
    node: Node;
    shadowNode: Node;
    position: Vec2;
    velocity: Vec2;
    isPotted: boolean;
}

export interface ShotResolution {
    pottedBalls: BallState[];
    cueBallPotted: boolean;
    scoreDelta: number;
    foulPenalty: number;
    breakDelta: number;
    message: string;
}


