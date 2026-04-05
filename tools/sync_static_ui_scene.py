#!/usr/bin/env python3
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCENE_PATH = ROOT / "assets" / "game" / "scenes" / "Main.scene"
DEFAULT_SPRITE_MATERIAL_UUID = "eca5d2f2-8ef6-41c2-bbe6-f9c79d09c432"
SPRITEFRAME_ID = "f9941"
UI_LAYER = 33554432

TEXT_COLORS = {
    "primary": (245, 239, 218, 255),
    "secondary": (188, 194, 199, 255),
    "accent": (212, 183, 104, 255),
    "success": (135, 211, 145, 255),
    "danger": (224, 119, 109, 255),
    "dark": (54, 39, 18, 255),
}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sprite_frame_uuid(asset_rel: str) -> str:
    meta_path = (ROOT / "assets" / "game" / asset_rel).with_suffix(".png.meta")
    meta = read_json(meta_path)
    return meta["subMetas"][SPRITEFRAME_ID]["uuid"]


class SceneBuilder:
    def __init__(self, items):
        self.items = items

    def find_node(self, name: str):
        for index, item in enumerate(self.items):
            if item.get("__type__") == "cc.Node" and item.get("_name") == name:
                return index
        return None

    def add_node(self, name, parent_id, size, pos=(0, 0, 0), active=True, layer=UI_LAYER):
        node_id = len(self.items)
        transform_id = node_id + 1
        node = {
            "__type__": "cc.Node",
            "_name": name,
            "_objFlags": 0,
            "__editorExtras__": {},
            "_parent": {"__id__": parent_id} if parent_id is not None else None,
            "_children": [],
            "_active": active,
            "_components": [{"__id__": transform_id}],
            "_prefab": None,
            "_lpos": {"__type__": "cc.Vec3", "x": pos[0], "y": pos[1], "z": pos[2]},
            "_lrot": {"__type__": "cc.Quat", "x": 0, "y": 0, "z": 0, "w": 1},
            "_lscale": {"__type__": "cc.Vec3", "x": 1, "y": 1, "z": 1},
            "_mobility": 0,
            "_layer": layer,
            "_euler": {"__type__": "cc.Vec3", "x": 0, "y": 0, "z": 0},
            "_id": "",
        }
        transform = {
            "__type__": "cc.UITransform",
            "_name": "",
            "_objFlags": 0,
            "__editorExtras__": {},
            "node": {"__id__": node_id},
            "_enabled": True,
            "__prefab": None,
            "_contentSize": {"__type__": "cc.Size", "width": size[0], "height": size[1]},
            "_anchorPoint": {"__type__": "cc.Vec2", "x": 0.5, "y": 0.5},
            "_id": "",
        }
        self.items.extend([node, transform])
        if parent_id is not None:
            self.items[parent_id]["_children"].append({"__id__": node_id})
        return node_id

    def find_child(self, parent_id: int, name: str):
        for child_ref in self.items[parent_id].get("_children", []):
            child_id = child_ref["__id__"]
            child = self.items[child_id]
            if child.get("__type__") == "cc.Node" and child.get("_name") == name:
                return child_id
        return None

    def component_of_type(self, node_id: int, component_type: str):
        for component_ref in self.items[node_id].get("_components", []):
            component_id = component_ref["__id__"]
            component = self.items[component_id]
            if component.get("__type__") == component_type:
                return component_id
        return None

    def set_node_rect(self, node_id: int, size=None, pos=None, active=None):
        if active is not None:
            self.items[node_id]["_active"] = active
        if pos is not None:
            self.items[node_id]["_lpos"]["x"] = pos[0]
            self.items[node_id]["_lpos"]["y"] = pos[1]
            self.items[node_id]["_lpos"]["z"] = pos[2]
        if size is not None:
            transform_id = self.component_of_type(node_id, "cc.UITransform")
            if transform_id is None:
                raise RuntimeError(f"节点 {self.items[node_id]['_name']} 缺少 UITransform。")
            self.items[transform_id]["_contentSize"]["width"] = size[0]
            self.items[transform_id]["_contentSize"]["height"] = size[1]

    def set_label(self, node_id: int, *, text=None, font_size=None, size=None, pos=None, color=None, horizontal_align=None, line_height=None):
        if size is not None or pos is not None:
            self.set_node_rect(node_id, size=size, pos=pos)
        label_id = self.component_of_type(node_id, "cc.Label")
        if label_id is None:
            raise RuntimeError(f"节点 {self.items[node_id]['_name']} 缺少 Label。")
        label = self.items[label_id]
        if text is not None:
            label["_string"] = text
        if font_size is not None:
            label["_actualFontSize"] = font_size
            label["_fontSize"] = font_size
        if color is not None:
            label["_color"]["r"] = color[0]
            label["_color"]["g"] = color[1]
            label["_color"]["b"] = color[2]
            label["_color"]["a"] = color[3]
        if horizontal_align is not None:
            label["_horizontalAlign"] = horizontal_align
        if line_height is not None:
            label["_lineHeight"] = line_height

    def set_sprite_color(self, node_id: int, color):
        sprite_id = self.component_of_type(node_id, "cc.Sprite")
        if sprite_id is None:
            raise RuntimeError(f"节点 {self.items[node_id]['_name']} 缺少 Sprite。")
        sprite = self.items[sprite_id]
        sprite["_color"]["r"] = color[0]
        sprite["_color"]["g"] = color[1]
        sprite["_color"]["b"] = color[2]
        sprite["_color"]["a"] = color[3]

    def set_parent(self, node_id: int, parent_id: int):
        current_parent_ref = self.items[node_id].get("_parent")
        if current_parent_ref is not None:
            current_parent_id = current_parent_ref["__id__"]
            self.items[current_parent_id]["_children"] = [
                child_ref for child_ref in self.items[current_parent_id].get("_children", [])
                if child_ref["__id__"] != node_id
            ]
        self.items[node_id]["_parent"] = {"__id__": parent_id}
        if not any(child_ref["__id__"] == node_id for child_ref in self.items[parent_id].get("_children", [])):
            self.items[parent_id]["_children"].append({"__id__": node_id})

    def add_opacity(self, node_id, opacity):
        comp_id = len(self.items)
        self.items[node_id]["_components"].append({"__id__": comp_id})
        self.items.append(
            {
                "__type__": "cc.UIOpacity",
                "_name": "",
                "_objFlags": 0,
                "__editorExtras__": {},
                "node": {"__id__": node_id},
                "_enabled": True,
                "__prefab": None,
                "_opacity": opacity,
                "_id": "",
            }
        )

    def add_sprite(self, node_id, asset_rel, sliced=False, color=(255, 255, 255, 255)):
        comp_id = len(self.items)
        self.items[node_id]["_components"].append({"__id__": comp_id})
        self.items.append(
            {
                "__type__": "cc.Sprite",
                "_name": "",
                "_objFlags": 0,
                "__editorExtras__": {},
                "node": {"__id__": node_id},
                "_enabled": True,
                "__prefab": None,
                "_customMaterial": None,
                "_visFlags": 0,
                "_srcBlendFactor": 2,
                "_dstBlendFactor": 4,
                "_color": {
                    "__type__": "cc.Color",
                    "r": color[0],
                    "g": color[1],
                    "b": color[2],
                    "a": color[3],
                },
                "_spriteFrame": {"__uuid__": sprite_frame_uuid(asset_rel)},
                "_type": 1 if sliced else 0,
                "_fillType": 0,
                "_sizeMode": 0,
                "_fillCenter": {"__type__": "cc.Vec2", "x": 0, "y": 0},
                "_fillStart": 0,
                "_fillRange": 0,
                "_isTrimmedMode": True,
                "_useGrayscale": False,
                "_materials": [{"__uuid__": DEFAULT_SPRITE_MATERIAL_UUID}],
                "_atlas": None,
                "_id": "",
            }
        )

    def add_label(
        self,
        parent_id,
        name,
        text,
        font_size,
        size,
        pos,
        color,
        horizontal_align=1,
        vertical_align=1,
        overflow=2,
        line_height=None,
    ):
        node_id = self.add_node(name, parent_id, size, pos=pos)
        comp_id = len(self.items)
        self.items[node_id]["_components"].append({"__id__": comp_id})
        self.items.append(
            {
                "__type__": "cc.Label",
                "_name": "",
                "_objFlags": 0,
                "__editorExtras__": {},
                "node": {"__id__": node_id},
                "_enabled": True,
                "__prefab": None,
                "_customMaterial": None,
                "_srcBlendFactor": 2,
                "_dstBlendFactor": 4,
                "_color": {
                    "__type__": "cc.Color",
                    "r": color[0],
                    "g": color[1],
                    "b": color[2],
                    "a": color[3],
                },
                "_string": text,
                "_horizontalAlign": horizontal_align,
                "_verticalAlign": vertical_align,
                "_actualFontSize": font_size,
                "_fontSize": font_size,
                "_fontFamily": "Arial",
                "_lineHeight": line_height or round(font_size * 1.25),
                "_overflow": overflow,
                "_enableWrapText": True,
                "_font": None,
                "_isSystemFontUsed": True,
                "_spacingX": 0,
                "_isItalic": False,
                "_isBold": False,
                "_isUnderline": False,
                "_underlineHeight": 2,
                "_cacheMode": 0,
                "_id": "",
            }
        )
        return node_id

    def add_button(self, parent_id, name, text, pos, size, asset_rel, font_size=21):
        button_id = self.add_node(name, parent_id, size, pos=pos)
        self.add_sprite(button_id, asset_rel, sliced=True)
        self.add_opacity(button_id, 255)
        self.add_label(
            button_id,
            "ButtonLabel",
            text,
            font_size,
            (size[0] - 24, size[1] - 8),
            (0, 0, 0),
            TEXT_COLORS["primary"],
        )
        return button_id


def ensure_overlay_panels(builder: SceneBuilder):
    overlay_layer = builder.find_node("OverlayLayer")
    if overlay_layer is None:
        raise RuntimeError("未找到 OverlayLayer，无法写入静态设置/结算面板。")

    if builder.find_node("SettingsPanel") is None:
        panel = builder.add_node("SettingsPanel", overlay_layer, (590, 392), pos=(0, 8, 0), active=False)
        builder.add_sprite(panel, "resources/textures/ui/panel_dark.png", sliced=True)
        builder.add_opacity(panel, 255)
        builder.add_label(panel, "SettingsTitle", "设置", 36, (460, 50), (0, 126, 0), TEXT_COLORS["primary"])
        builder.add_label(
            panel,
            "SettingsDetail",
            "继续即可回到球桌；若想重新组织节奏，可以直接重开这一局，也可以返回主页面重新选择模式。",
            20,
            (470, 150),
            (0, 34, 0),
            TEXT_COLORS["secondary"],
            line_height=26,
        )
        builder.add_button(panel, "SettingsContinueButton", "继续游戏", (0, -58, 0), (236, 54), "resources/textures/ui/button_blue.png")
        builder.add_button(panel, "SettingsRestartButton", "重开本局", (-130, -132, 0), (202, 56), "resources/textures/ui/button_red.png")
        builder.add_button(panel, "SettingsHomeButton", "返回主页", (130, -132, 0), (202, 56), "resources/textures/ui/button_neutral.png")

    if builder.find_node("SettlementPanel") is None:
        panel = builder.add_node("SettlementPanel", overlay_layer, (590, 392), pos=(0, 8, 0), active=False)
        builder.add_sprite(panel, "resources/textures/ui/panel_dark.png", sliced=True)
        builder.add_opacity(panel, 255)
        builder.add_label(panel, "SettlementTitle", "本局完成", 36, (460, 50), (0, 126, 0), TEXT_COLORS["primary"])
        builder.add_label(panel, "SettlementNote", "继续保持手感。", 20, (470, 44), (0, 96, 0), TEXT_COLORS["secondary"], line_height=24)
        stats = builder.add_node("SettlementStatsContainer", panel, (470, 176), pos=(0, -6, 0))
        titles = ["模式", "得分", "进球", "出杆", "最高分"]
        for index, title in enumerate(titles):
            row = builder.add_node(f"SettlementStatRow-{index}", stats, (446, 30), pos=(0, 44 - index * 38, 0))
            builder.add_sprite(row, "resources/textures/ui/panel_inset.png", sliced=True)
            builder.add_opacity(row, 236)
            builder.add_label(row, f"SettlementStatTitle-{index}", title, 18, (160, 22), (-170, 0, 0), TEXT_COLORS["secondary"], horizontal_align=0)
            builder.add_label(row, f"SettlementStatValue-{index}", "-", 22, (160, 22), (170, 0, 0), TEXT_COLORS["primary"], horizontal_align=2)
        builder.add_button(panel, "SettlementRestartButton", "再来一局", (-122, -126, 0), (202, 56), "resources/textures/ui/button_green.png")
        builder.add_button(panel, "SettlementHomeButton", "返回菜单", (122, -126, 0), (202, 56), "resources/textures/ui/button_neutral.png")


def add_summary_chip(builder: SceneBuilder, parent_id, name, title, pos):
    chip = builder.add_node(name, parent_id, (256, 58), pos=pos)
    builder.add_sprite(chip, "resources/textures/ui/panel_inset.png", sliced=True)
    builder.add_opacity(chip, 255)
    builder.add_label(chip, f"{name}-Title", title, 16, (96, 22), (-64, 0, 0), TEXT_COLORS["secondary"], horizontal_align=0)
    builder.add_label(chip, f"{name}-Value", "0 / 0", 22, (116, 26), (64, 0, 0), TEXT_COLORS["primary"], horizontal_align=2)


def add_achievement_card(builder: SceneBuilder, parent_id, index, pos):
    card = builder.add_node(f"AchievementCard-{index}", parent_id, (220, 78), pos=pos)
    builder.add_sprite(card, "resources/textures/ui/panel_inset.png", sliced=True)
    builder.add_opacity(card, 255)
    builder.add_label(card, "AchievementName", "成就名称", 19, (150, 24), (-14, 18, 0), TEXT_COLORS["primary"], horizontal_align=0)
    badge = builder.add_node("AchievementPointsBadge", card, (56, 24), pos=(72, 18, 0))
    builder.add_sprite(badge, "resources/textures/ui/top_strip.png", sliced=True, color=(210, 190, 126, 255))
    builder.add_opacity(badge, 255)
    builder.add_label(badge, "AchievementPointsLabel", "10", 13, (40, 16), (0, 0, 0), TEXT_COLORS["dark"])
    builder.add_label(card, "AchievementDesc", "成就描述文本", 12, (190, 30), (0, -4, 0), (210, 214, 220, 214), line_height=14)
    builder.add_label(card, "AchievementFooter", "普通 · 1", 12, (190, 16), (0, -25, 0), TEXT_COLORS["accent"], line_height=14)


def restyle_achievement_cards(builder: SceneBuilder, grid_id: int):
    grid_width = 920
    grid_height = 1780
    card_width = 900
    card_height = 92
    gap_y = 18
    top_padding = 28

    builder.set_node_rect(grid_id, size=(grid_width, grid_height), pos=(0, 0, 0))
    start_y = grid_height / 2 - top_padding - card_height / 2

    for index in range(16):
        card_id = builder.find_child(grid_id, f"AchievementCard-{index}")
        if card_id is None:
            continue

        pos_y = start_y - index * (card_height + gap_y)
        builder.set_node_rect(card_id, size=(card_width, card_height), pos=(0, pos_y, 0), active=True)

        name_id = builder.find_child(card_id, "AchievementName")
        desc_id = builder.find_child(card_id, "AchievementDesc")
        footer_id = builder.find_child(card_id, "AchievementFooter")
        badge_id = builder.find_child(card_id, "AchievementPointsBadge")

        if name_id is not None:
            builder.set_label(name_id, font_size=24, size=(540, 30), pos=(-146, 24, 0), horizontal_align=0, line_height=30)
        if desc_id is not None:
            builder.set_label(desc_id, font_size=15, size=(670, 28), pos=(-81, -2, 0), horizontal_align=0, line_height=18)
        if footer_id is not None:
            builder.set_label(footer_id, font_size=14, size=(670, 20), pos=(-81, -28, 0), horizontal_align=0, line_height=18)
        if badge_id is not None:
            builder.set_node_rect(badge_id, size=(96, 30), pos=(362, 22, 0))
            builder.set_sprite_color(badge_id, (210, 190, 126, 255))
            points_id = builder.find_child(badge_id, "AchievementPointsLabel")
            if points_id is not None:
                builder.set_label(points_id, font_size=16, size=(72, 20), pos=(0, 0, 0), line_height=20)


def ensure_achievement_viewport(builder: SceneBuilder, grid_shell_id: int):
    viewport = builder.find_child(grid_shell_id, "AchievementGridViewport")
    if viewport is None:
        viewport = builder.add_node("AchievementGridViewport", grid_shell_id, (944, 308), pos=(0, 0, 0))
    else:
        builder.set_node_rect(viewport, size=(944, 308), pos=(0, 0, 0), active=True)
    return viewport


def ensure_achievement_panel(builder: SceneBuilder):
    game_root = builder.find_node("GameRoot")
    if game_root is None:
        raise RuntimeError("未找到 GameRoot，无法写入静态成就面板。")

    panel = builder.find_node("AchievementPanel")
    if panel is not None:
        summary = builder.find_node("AchievementSummaryPlate")
        grid_shell = builder.find_node("AchievementGridShell")
        grid = builder.find_node("AchievementGrid")
        if summary is None or grid_shell is None or grid is None:
            raise RuntimeError("现有成就面板缺少关键节点，无法重排为滚动栏。")
        builder.set_node_rect(summary, size=(984, 88), pos=(0, 148, 0))
        builder.set_node_rect(grid_shell, size=(992, 344), pos=(0, -78, 0))
        viewport = ensure_achievement_viewport(builder, grid_shell)
        if builder.items[grid]["_parent"] is None or builder.items[grid]["_parent"]["__id__"] != viewport:
            builder.set_parent(grid, viewport)
        restyle_achievement_cards(builder, grid)
        return

    panel = builder.add_node("AchievementPanel", game_root, (1280, 720), pos=(0, 0, 30), active=False)
    mask = builder.add_node("AchievementMask", panel, (1280, 720), pos=(0, 0, 0))
    builder.add_sprite(mask, "resources/textures/ui/backdrop.png", color=(16, 18, 20, 255))
    builder.add_opacity(mask, 220)

    board = builder.add_node("AchievementBoard", panel, (1140, 636), pos=(0, 0, 0))
    builder.add_sprite(board, "resources/textures/table/wood_frame.png", sliced=True)
    builder.add_opacity(board, 255)

    felt = builder.add_node("AchievementFelt", board, (1060, 556), pos=(0, 0, 0))
    builder.add_sprite(felt, "resources/textures/table/felt.png", sliced=True)
    builder.add_opacity(felt, 255)

    title_ribbon = builder.add_node("AchievementTitleRibbon", felt, (356, 72), pos=(0, 228, 0))
    builder.add_sprite(title_ribbon, "resources/textures/ui/top_strip.png", sliced=True)
    builder.add_opacity(title_ribbon, 255)
    builder.add_label(title_ribbon, "AchievementTitle", "成就馆", 34, (240, 36), (0, 10, 0), TEXT_COLORS["primary"])
    builder.add_label(title_ribbon, "AchievementSubtitle", "COLLECTION BOARD", 14, (220, 18), (0, -18, 0), TEXT_COLORS["accent"])

    summary = builder.add_node("AchievementSummaryPlate", felt, (984, 88), pos=(0, 148, 0))
    builder.add_sprite(summary, "resources/textures/ui/panel_dark.png", sliced=True)
    builder.add_opacity(summary, 255)
    add_summary_chip(builder, summary, "SummaryUnlocked", "已解锁", (-286, 0, 0))
    add_summary_chip(builder, summary, "SummaryPoints", "成就点", (0, 0, 0))
    add_summary_chip(builder, summary, "SummaryHidden", "隐藏收集", (286, 0, 0))

    grid_shell = builder.add_node("AchievementGridShell", felt, (992, 344), pos=(0, -78, 0))
    builder.add_sprite(grid_shell, "resources/textures/ui/panel_inset.png", sliced=True)
    builder.add_opacity(grid_shell, 255)

    viewport = builder.add_node("AchievementGridViewport", grid_shell, (944, 308), pos=(0, 0, 0))
    grid = builder.add_node("AchievementGrid", viewport, (920, 1780), pos=(0, 0, 0))
    for index in range(16):
        add_achievement_card(builder, grid, index, (0, 0, 0))
    restyle_achievement_cards(builder, grid)

    builder.add_button(felt, "AchievementCloseButton", "关闭", (426, 228, 0), (146, 52), "resources/textures/ui/button_neutral.png")


def main():
    items = read_json(SCENE_PATH)
    builder = SceneBuilder(items)
    ensure_overlay_panels(builder)
    ensure_achievement_panel(builder)
    SCENE_PATH.write_text(json.dumps(items, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("同步完成：已写入设置/结算/成就静态面板。")


if __name__ == "__main__":
    main()
