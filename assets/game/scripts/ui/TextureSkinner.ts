import { Color, Graphics, Layers, Node, resources, Sprite, SpriteFrame, UITransform, UIOpacity, v3 } from 'cc';

export interface SkinOptions {
    disableGraphics?: boolean;
    sliced?: boolean;
    insetLeft?: number;
    insetRight?: number;
    insetTop?: number;
    insetBottom?: number;
    color?: Color;
}

export class TextureSkinner {
    private static readonly skinNodeName = '__TextureSkin';
    private static readonly spriteFrameCache = new Map<string, Promise<SpriteFrame | null>>();

    public static preload(paths: string[]): void {
        paths.forEach((path) => {
            void this.loadSpriteFrame(path);
        });
    }

    public static apply(node: Node, path: string, options: SkinOptions = {}): void {
        void this.loadSpriteFrame(path).then((spriteFrame) => {
            if (!spriteFrame || !node.isValid) {
                return;
            }

            const skinNode = this.ensureSkinNode(node);
            const sprite = skinNode.getComponent(Sprite) ?? skinNode.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.type = options.sliced ? Sprite.Type.SLICED : Sprite.Type.SIMPLE;
            if (options.sliced) {
                spriteFrame.insetLeft = options.insetLeft ?? 28;
                spriteFrame.insetRight = options.insetRight ?? 28;
                spriteFrame.insetTop = options.insetTop ?? 28;
                spriteFrame.insetBottom = options.insetBottom ?? 28;
            }
            sprite.spriteFrame = spriteFrame;
            if (options.color) {
                sprite.color = options.color;
            }

            if (options.disableGraphics !== false) {
                const graphics = node.getComponent(Graphics);
                if (graphics) {
                    graphics.enabled = false;
                }
            }
        });
    }

    private static ensureSkinNode(node: Node): Node {
        let skinNode = node.getChildByName(this.skinNodeName);
        if (!skinNode) {
            skinNode = new Node(this.skinNodeName);
            skinNode.layer = Layers.Enum.UI_2D;
            node.addChild(skinNode);
        }

        const parentTransform = node.getComponent(UITransform);
        const transform = skinNode.getComponent(UITransform) ?? skinNode.addComponent(UITransform);
        transform.setContentSize(
            parentTransform?.contentSize.width ?? 0,
            parentTransform?.contentSize.height ?? 0,
        );

        const opacity = skinNode.getComponent(UIOpacity) ?? skinNode.addComponent(UIOpacity);
        opacity.opacity = 255;
        skinNode.setPosition(v3());
        skinNode.setSiblingIndex(0);
        return skinNode;
    }

    private static loadSpriteFrame(path: string): Promise<SpriteFrame | null> {
        const normalizedPath = path.endsWith('/spriteFrame') ? path : `${path}/spriteFrame`;
        let pending = this.spriteFrameCache.get(normalizedPath);
        if (!pending) {
            pending = new Promise((resolve) => {
                resources.load(normalizedPath, SpriteFrame, (error, spriteFrame) => {
                    if (error) {
                        console.warn(`[TextureSkinner] 贴图加载失败: ${normalizedPath}`, error);
                        resolve(null);
                        return;
                    }
                    resolve(spriteFrame);
                });
            });
            this.spriteFrameCache.set(normalizedPath, pending);
        }
        return pending;
    }
}
