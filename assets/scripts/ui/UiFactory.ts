import {
    Color,
    Graphics,
    Label,
    Layers,
    Node,
    Size,
    Sprite,
    UITransform,
    UIOpacity,
    Vec2,
    Vec3,
} from 'cc';

export class UiFactory {
    public static ensureNode(
        parent: Node,
        name: string,
        position: Vec2 | Vec3,
        width = 0,
        height = 0,
    ): Node {
        const node = this.getOrCreateNode(parent, name);
        node.setPosition(position.x, position.y, (position as Vec3).z ?? 0);
        const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
        transform.setContentSize(width, height);
        return node;
    }

    public static createRoundRect(
        parent: Node,
        name: string,
        size: Size,
        position: Vec2 | Vec3,
        fillColor: Color,
        strokeColor?: Color,
        radius = 16,
        opacity = 255,
    ): Node {
        const node = this.getOrCreateNode(parent, name);
        node.setPosition(position.x, position.y, (position as Vec3).z ?? 0);

        const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
        transform.setContentSize(size.width, size.height);

        const uiOpacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        uiOpacity.opacity = opacity;

        if (node.getComponent(Sprite)) {
            return node;
        }

        const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
        graphics.clear();
        graphics.fillColor = fillColor;
        graphics.roundRect(-size.width / 2, -size.height / 2, size.width, size.height, radius);
        graphics.fill();

        if (strokeColor) {
            graphics.strokeColor = strokeColor;
            graphics.lineWidth = 2;
            graphics.roundRect(-size.width / 2, -size.height / 2, size.width, size.height, radius);
            graphics.stroke();
        }

        return node;
    }

    public static createCircle(
        parent: Node,
        name: string,
        radius: number,
        position: Vec2 | Vec3,
        fillColor: Color,
        opacity = 255,
    ): Node {
        const diameter = radius * 2;
        const node = this.getOrCreateNode(parent, name);
        node.setPosition(position.x, position.y, (position as Vec3).z ?? 0);

        const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
        transform.setContentSize(diameter, diameter);

        const uiOpacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        uiOpacity.opacity = opacity;

        if (node.getComponent(Sprite)) {
            return node;
        }

        const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
        graphics.clear();
        graphics.fillColor = fillColor;
        graphics.circle(0, 0, radius);
        graphics.fill();
        return node;
    }

    public static createLabel(
        parent: Node,
        name: string,
        text: string,
        fontSize: number,
        position: Vec2 | Vec3,
        color = Color.WHITE,
        width = 320,
        height = 48,
    ): Label {
        const node = this.getOrCreateNode(parent, name);
        node.setPosition(position.x, position.y, (position as Vec3).z ?? 0);

        const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
        transform.setContentSize(width, height);

        const label = node.getComponent(Label) ?? node.addComponent(Label);
        label.useSystemFont = true;
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = Math.round(fontSize * 1.25);
        label.color = color;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        return label;
    }

    private static getOrCreateNode(parent: Node, name: string): Node {
        let node = parent.getChildByName(name);
        if (!node) {
            node = new Node(name);
            parent.addChild(node);
        }
        node.layer = Layers.Enum.UI_2D;
        return node;
    }
}
