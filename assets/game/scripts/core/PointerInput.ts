import { EventMouse, EventTouch, Node, UITransform, Vec2, v2 } from 'cc';

export interface PointerEventData {
    local: Vec2;
}

export interface PointerHandlers {
    onStart?: (event: PointerEventData) => void;
    onMove?: (event: PointerEventData) => void;
    onEnd?: (event: PointerEventData) => void;
    onCancel?: (event: PointerEventData) => void;
}

type SupportedPointerEvent = EventTouch | EventMouse;

export class PointerInput {
    private target: Node | null;
    private transform: UITransform | null;

    constructor(target: Node, private readonly handlers: PointerHandlers) {
        this.target = target;
        this.transform = target.getComponent(UITransform)!;
        this.bind();
    }

    public destroy(): void {
        const target = this.target;
        if (target?.isValid) {
            target.off(Node.EventType.TOUCH_START, this.handleStart, this);
            target.off(Node.EventType.TOUCH_MOVE, this.handleMove, this);
            target.off(Node.EventType.TOUCH_END, this.handleEnd, this);
            target.off(Node.EventType.TOUCH_CANCEL, this.handleCancel, this);
            target.off(Node.EventType.MOUSE_DOWN, this.handleStart, this);
            target.off(Node.EventType.MOUSE_MOVE, this.handleMove, this);
            target.off(Node.EventType.MOUSE_UP, this.handleEnd, this);
            target.off(Node.EventType.MOUSE_LEAVE, this.handleCancel, this);
        }

        this.target = null;
        this.transform = null;
    }

    private bind(): void {
        const target = this.target;
        if (!target?.isValid) {
            return;
        }

        target.on(Node.EventType.TOUCH_START, this.handleStart, this);
        target.on(Node.EventType.TOUCH_MOVE, this.handleMove, this);
        target.on(Node.EventType.TOUCH_END, this.handleEnd, this);
        target.on(Node.EventType.TOUCH_CANCEL, this.handleCancel, this);
        target.on(Node.EventType.MOUSE_DOWN, this.handleStart, this);
        target.on(Node.EventType.MOUSE_MOVE, this.handleMove, this);
        target.on(Node.EventType.MOUSE_UP, this.handleEnd, this);
        target.on(Node.EventType.MOUSE_LEAVE, this.handleCancel, this);
    }

    private handleStart(event: SupportedPointerEvent): void {
        this.handlers.onStart?.(this.toPointerData(event));
    }

    private handleMove(event: SupportedPointerEvent): void {
        this.handlers.onMove?.(this.toPointerData(event));
    }

    private handleEnd(event: SupportedPointerEvent): void {
        this.handlers.onEnd?.(this.toPointerData(event));
    }

    private handleCancel(event: SupportedPointerEvent): void {
        this.handlers.onCancel?.(this.toPointerData(event));
    }

    private toPointerData(event: SupportedPointerEvent): PointerEventData {
        const transform = this.transform;
        if (!transform || !transform.node.isValid) {
            return {
                local: v2(),
            };
        }

        const uiLocation = event.getUILocation();
        const width = transform.contentSize.width;
        const height = transform.contentSize.height;
        const anchorX = transform.anchorX;
        const anchorY = transform.anchorY;

        return {
            local: v2(
                uiLocation.x - width * anchorX,
                uiLocation.y - height * anchorY,
            ),
        };
    }
}
