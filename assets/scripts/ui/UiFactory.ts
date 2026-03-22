import {
    Color,
    Graphics,
    Label,
    Layers,
    Node,
    Size,
    UITransform,
    UIOpacity,
    Vec2,
    Vec3,
} from 'cc';

export class UiFactory {
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
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        parent.addChild(node);
        node.setPosition(position.x, position.y, (position as Vec3).z ?? 0);

        const transform = node.addComponent(UITransform);
        transform.setContentSize(size.width, size.height);

        const uiOpacity = node.addComponent(UIOpacity);
        uiOpacity.opacity = opacity;

        const graphics = node.addComponent(Graphics);
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
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        parent.addChild(node);
        node.setPosition(position.x, position.y, (position as Vec3).z ?? 0);

        const transform = node.addComponent(UITransform);
        transform.setContentSize(diameter, diameter);

        const uiOpacity = node.addComponent(UIOpacity);
        uiOpacity.opacity = opacity;

        const graphics = node.addComponent(Graphics);
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
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        parent.addChild(node);
        node.setPosition(position.x, position.y, (position as Vec3).z ?? 0);

        const transform = node.addComponent(UITransform);
        transform.setContentSize(width, height);

        const label = node.addComponent(Label);
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
}
