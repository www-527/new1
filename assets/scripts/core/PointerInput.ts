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
    private readonly transform: UITransform;

    constructor(private readonly target: Node, private readonly handlers: PointerHandlers) {
        this.transform = target.getComponent(UITransform)!;
        this.bind();
    }

    public destroy(): void {
        this.target.off(Node.EventType.TOUCH_START, this.handleStart, this);
        this.target.off(Node.EventType.TOUCH_MOVE, this.handleMove, this);
        this.target.off(Node.EventType.TOUCH_END, this.handleEnd, this);
        this.target.off(Node.EventType.TOUCH_CANCEL, this.handleCancel, this);
        this.target.off(Node.EventType.MOUSE_DOWN, this.handleStart, this);
        this.target.off(Node.EventType.MOUSE_MOVE, this.handleMove, this);
        this.target.off(Node.EventType.MOUSE_UP, this.handleEnd, this);
        this.target.off(Node.EventType.MOUSE_LEAVE, this.handleCancel, this);
    }

    private bind(): void {
        this.target.on(Node.EventType.TOUCH_START, this.handleStart, this);
        this.target.on(Node.EventType.TOUCH_MOVE, this.handleMove, this);
        this.target.on(Node.EventType.TOUCH_END, this.handleEnd, this);
        this.target.on(Node.EventType.TOUCH_CANCEL, this.handleCancel, this);
        this.target.on(Node.EventType.MOUSE_DOWN, this.handleStart, this);
        this.target.on(Node.EventType.MOUSE_MOVE, this.handleMove, this);
        this.target.on(Node.EventType.MOUSE_UP, this.handleEnd, this);
        this.target.on(Node.EventType.MOUSE_LEAVE, this.handleCancel, this);
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
        const uiLocation = event.getUILocation();
        const width = this.transform.contentSize.width;
        const height = this.transform.contentSize.height;
        const anchorX = this.transform.anchorX;
        const anchorY = this.transform.anchorY;

        return {
            local: v2(
                uiLocation.x - width * anchorX,
                uiLocation.y - height * anchorY,
            ),
        };
    }
}
