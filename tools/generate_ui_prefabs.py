#!/usr/bin/env python3
import json
import uuid
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEXTURES = ROOT / "assets" / "resources" / "textures"
PREFABS = ROOT / "assets" / "resources" / "prefabs" / "ui"

DEFAULT_SPRITE_MATERIAL_UUID = "eca5d2f2-8ef6-41c2-bbe6-f9c79d09c432"
SPRITEFRAME_ID = "f9941"
TEXTURE_ID = "6c48a"


def stable_uuid(key: str) -> str:
    return str(uuid.uuid5(uuid.UUID("b90af4f5-7bc0-4ae0-bc4b-0ec81095a431"), key))


def file_id(key: str) -> str:
    return stable_uuid(f"fileid:{key}").replace("-", "")[:22]


TEXTURE_DEFS = {
    "resources/textures/ui/panel_dark.png": (256, 256, (44, 44, 44, 44)),
    "resources/textures/ui/panel_inset.png": (256, 128, (28, 28, 28, 28)),
    "resources/textures/ui/top_strip.png": (1024, 96, (48, 48, 24, 24)),
    "resources/textures/ui/button_blue.png": (256, 96, (32, 32, 24, 24)),
    "resources/textures/ui/button_green.png": (256, 96, (32, 32, 24, 24)),
    "resources/textures/ui/button_bronze.png": (256, 96, (32, 32, 24, 24)),
    "resources/textures/ui/button_neutral.png": (256, 96, (32, 32, 24, 24)),
    "resources/textures/ui/button_red.png": (256, 96, (32, 32, 24, 24)),
    "resources/textures/ui/backdrop.png": (1024, 512, (0, 0, 0, 0)),
    "resources/textures/table/felt.png": (1024, 512, (72, 72, 72, 72)),
    "resources/textures/table/wood_frame.png": (1024, 512, (96, 96, 96, 96)),
    "resources/textures/table/pocket.png": (128, 128, (0, 0, 0, 0)),
}


def ensure_parent_meta(path: Path):
    current = path.parent
    while current != ROOT and current != ROOT.parent:
        meta = current.with_suffix(current.suffix + ".meta") if current.suffix else Path(str(current) + ".meta")
        if not meta.exists():
            meta.parent.mkdir(parents=True, exist_ok=True)
            meta.write_text(
                json.dumps(
                    {
                        "ver": "1.0.0",
                        "importer": "directory",
                        "imported": True,
                        "uuid": stable_uuid(str(current.relative_to(ROOT))),
                        "files": [],
                        "subMetas": {},
                        "userData": {},
                    },
                    indent=2,
                )
                + "\n",
                encoding="utf-8",
            )
        if current == ROOT / "assets":
            break
        current = current.parent


def read_meta(path: Path):
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def meta_path_from_asset(asset_path: str) -> Path:
    asset = ROOT / "assets" / asset_path
    return asset.with_suffix(asset.suffix + ".meta")


def image_meta(asset_path: str, width: int, height: int, border):
    meta_path = meta_path_from_asset(asset_path)
    existing = read_meta(meta_path) or {}
    image_uuid = existing.get("uuid", stable_uuid(asset_path))
    texture_meta = existing.get("subMetas", {}).get(TEXTURE_ID, {})
    sprite_frame_meta = existing.get("subMetas", {}).get(SPRITEFRAME_ID, {})
    texture_user_data = texture_meta.get("userData", {})
    sprite_frame_user_data = sprite_frame_meta.get("userData", {})
    tex_uuid = f"{image_uuid}@{TEXTURE_ID}"
    if texture_meta.get("uuid"):
        tex_uuid = texture_meta["uuid"]
    sf_uuid = f"{image_uuid}@{SPRITEFRAME_ID}"
    if sprite_frame_meta.get("uuid"):
        sf_uuid = sprite_frame_meta["uuid"]
    left, right, top, bottom = border
    return {
        "ver": "1.0.27",
        "importer": "image",
        "imported": True,
        "uuid": image_uuid,
        "files": [".json", ".png"],
        "subMetas": {
            TEXTURE_ID: {
                "importer": "texture",
                "uuid": tex_uuid,
                "displayName": Path(asset_path).stem,
                "id": TEXTURE_ID,
                "name": "texture",
                "userData": {
                    "minfilter": texture_user_data.get("minfilter", "linear"),
                    "magfilter": texture_user_data.get("magfilter", "linear"),
                    "wrapModeT": texture_user_data.get("wrapModeT", "clamp-to-edge"),
                    "wrapModeS": texture_user_data.get("wrapModeS", "clamp-to-edge"),
                    "mipfilter": texture_user_data.get("mipfilter", "none"),
                    "imageUuidOrDatabaseUri": image_uuid,
                    "isUuid": True,
                    "visible": False,
                    "anisotropy": texture_user_data.get("anisotropy", 0),
                },
                "ver": "1.0.22",
                "imported": True,
                "files": [".json"],
                "subMetas": {},
            },
            SPRITEFRAME_ID: {
                "importer": "sprite-frame",
                "uuid": sf_uuid,
                "displayName": Path(asset_path).stem,
                "id": SPRITEFRAME_ID,
                "name": "spriteFrame",
                "userData": {
                    "importer": "sprite-frame",
                    "trimType": sprite_frame_user_data.get("trimType", "custom"),
                    "trimThreshold": sprite_frame_user_data.get("trimThreshold", 1),
                    "rotated": sprite_frame_user_data.get("rotated", False),
                    "offsetX": sprite_frame_user_data.get("offsetX", 0),
                    "offsetY": sprite_frame_user_data.get("offsetY", 0),
                    "trimX": sprite_frame_user_data.get("trimX", 0),
                    "trimY": sprite_frame_user_data.get("trimY", 0),
                    "width": width,
                    "height": height,
                    "rawWidth": width,
                    "rawHeight": height,
                    "borderTop": top,
                    "borderBottom": bottom,
                    "borderLeft": left,
                    "borderRight": right,
                    "imageUuidOrDatabaseUri": tex_uuid,
                    "packable": sprite_frame_user_data.get("packable", True),
                    "pixelsToUnit": sprite_frame_user_data.get("pixelsToUnit", 100),
                    "pivotX": sprite_frame_user_data.get("pivotX", 0.5),
                    "pivotY": sprite_frame_user_data.get("pivotY", 0.5),
                    "meshType": sprite_frame_user_data.get("meshType", 0),
                    "vertices": {
                        "rawPosition": [-width / 2, -height / 2, 0, width / 2, -height / 2, 0, -width / 2, height / 2, 0, width / 2, height / 2, 0],
                        "indexes": [0, 1, 2, 2, 1, 3],
                        "uv": [0, height, width, height, 0, 0, width, 0],
                        "nuv": [0, 0, 1, 0, 0, 1, 1, 1],
                        "minPos": [-width / 2, -height / 2, 0],
                        "maxPos": [width / 2, height / 2, 0],
                    },
                    "isUuid": True,
                    "atlasUuid": "",
                },
                "ver": "1.0.12",
                "imported": True,
                "files": [".json"],
                "subMetas": {},
            },
        },
        "userData": {
            "type": "sprite-frame",
            "fixAlphaTransparencyArtifacts": False,
            "redirect": tex_uuid,
            "hasAlpha": True,
        },
    }


class PrefabBuilder:
    def __init__(self, name: str, asset_rel: str):
        self.asset_rel = asset_rel
        meta = read_meta(meta_path_from_asset(asset_rel)) or {}
        self.asset_uuid = meta.get("uuid", stable_uuid(asset_rel))
        self.items = [
            {
                "__type__": "cc.Prefab",
                "_name": name,
                "_objFlags": 0,
                "_native": "",
                "data": {"__id__": 1},
                "optimizationPolicy": 0,
                "asyncLoadAssets": False,
                "readonly": False,
                "persistent": False,
            }
        ]

    def add_node(self, name, parent_id, size, pos=(0, 0, 0), active=True, layer=33554432):
        node_id = len(self.items)
        transform_id = node_id + 1
        prefab_info_id = None
        node = {
            "__type__": "cc.Node",
            "_name": name,
            "_objFlags": 0,
            "_parent": None if parent_id is None else {"__id__": parent_id},
            "_children": [],
            "_active": active,
            "_components": [{"__id__": transform_id}],
            "_prefab": None,
            "_lpos": {"__type__": "cc.Vec3", "x": pos[0], "y": pos[1], "z": pos[2]},
            "_lrot": {"__type__": "cc.Quat", "x": 0, "y": 0, "z": 0, "w": 1},
            "_lscale": {"__type__": "cc.Vec3", "x": 1, "y": 1, "z": 1},
            "_layer": layer,
            "_euler": {"__type__": "cc.Vec3", "x": 0, "y": 0, "z": 0},
            "_level": 1 if parent_id is None else 2,
            "_id": "",
        }
        transform = {
            "__type__": "cc.UITransform",
            "_name": "",
            "_objFlags": 0,
            "node": {"__id__": node_id},
            "_enabled": True,
            "__prefab": {"__id__": transform_id + 1},
            "_contentSize": {"__type__": "cc.Size", "width": size[0], "height": size[1]},
            "_anchorPoint": {"__type__": "cc.Vec2", "x": 0.5, "y": 0.5},
        }
        transform_info = {"__type__": "cc.CompPrefabInfo", "fileId": file_id(f"{self.asset_rel}:{name}:transform")}
        self.items.extend([node, transform, transform_info])
        prefab_info_id = len(self.items)
        node["_prefab"] = {"__id__": prefab_info_id}
        prefab_info = {
            "__type__": "cc.PrefabInfo",
            "root": {"__id__": 1},
            "asset": {"__id__": 0},
            "fileId": file_id(f"{self.asset_rel}:{name}:node"),
        }
        self.items.append(prefab_info)
        if parent_id is not None:
            self.items[parent_id]["_children"].append({"__id__": node_id})
        return node_id

    def add_sprite(self, node_id, texture_asset_rel, sliced=False):
        comp_id = len(self.items)
        info_id = comp_id + 1
        sprite_meta = read_meta(meta_path_from_asset(texture_asset_rel)) or {}
        sprite_frame_uuid = sprite_meta.get("subMetas", {}).get(SPRITEFRAME_ID, {}).get("uuid", f"{stable_uuid(texture_asset_rel)}@{SPRITEFRAME_ID}")
        self.items[node_id]["_components"].append({"__id__": comp_id})
        self.items.append(
            {
                "__type__": "cc.Sprite",
                "_name": "",
                "_objFlags": 0,
                "node": {"__id__": node_id},
                "_enabled": True,
                "__prefab": {"__id__": info_id},
                "_customMaterial": None,
                "_visFlags": 0,
                "_srcBlendFactor": 2,
                "_dstBlendFactor": 4,
                "_color": {"__type__": "cc.Color", "r": 255, "g": 255, "b": 255, "a": 255},
                "_spriteFrame": {"__uuid__": sprite_frame_uuid},
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
        self.items.append({"__type__": "cc.CompPrefabInfo", "fileId": file_id(f"{self.asset_rel}:{node_id}:sprite")})

    def add_opacity(self, node_id, opacity=255):
        comp_id = len(self.items)
        info_id = comp_id + 1
        self.items[node_id]["_components"].append({"__id__": comp_id})
        self.items.append(
            {
                "__type__": "cc.UIOpacity",
                "_name": "",
                "_objFlags": 0,
                "node": {"__id__": node_id},
                "_enabled": True,
                "__prefab": {"__id__": info_id},
                "_opacity": opacity,
            }
        )
        self.items.append({"__type__": "cc.CompPrefabInfo", "fileId": file_id(f"{self.asset_rel}:{node_id}:opacity")})

    def add_label(
        self,
        node_id,
        text,
        font_size,
        color=(255, 255, 255, 255),
        line_height=None,
        width=220,
        height=32,
        position=(0, 0, 0),
        horizontal_align=1,
        vertical_align=1,
        overflow=2,
    ):
        label_node = self.add_node(
            f"Label-{len(self.items)}",
            node_id,
            (width, height),
            pos=position,
        )
        comp_id = len(self.items)
        info_id = comp_id + 1
        self.items[label_node]["_components"].append({"__id__": comp_id})
        self.items.append(
            {
                "__type__": "cc.Label",
                "_name": "",
                "_objFlags": 0,
                "node": {"__id__": label_node},
                "_enabled": True,
                "__prefab": {"__id__": info_id},
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
        self.items.append({"__type__": "cc.CompPrefabInfo", "fileId": file_id(f"{self.asset_rel}:{label_node}:label")})
        return label_node

    def write(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.items, indent=2) + "\n", encoding="utf-8")
        meta = {
            "ver": "1.1.50",
            "importer": "prefab",
            "imported": True,
            "uuid": self.asset_uuid,
            "files": [".json"],
            "subMetas": {},
            "userData": {"syncNodeName": self.items[1]["_name"]},
        }
        path.with_suffix(path.suffix + ".meta").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")


def build_common_button():
    builder = PrefabBuilder("CommonButton", "assets/resources/prefabs/ui/CommonButton.prefab")
    root = builder.add_node("CommonButton", None, (256, 96))
    builder.add_opacity(root)
    skins = [
        ("SkinNeutral", "resources/textures/ui/button_neutral.png", True, True),
        ("SkinBlue", "resources/textures/ui/button_blue.png", True, False),
        ("SkinGreen", "resources/textures/ui/button_green.png", True, False),
        ("SkinBronze", "resources/textures/ui/button_bronze.png", True, False),
        ("SkinRed", "resources/textures/ui/button_red.png", True, False),
    ]
    for name, tex, sliced, active in skins:
        node = builder.add_node(name, root, (256, 96), active=active)
        builder.add_sprite(node, tex, sliced=sliced)
    builder.add_node("LabelSlot", root, (212, 60))
    builder.write(PREFABS / "CommonButton.prefab")


def build_top_hud():
    builder = PrefabBuilder("TopHud", "assets/resources/prefabs/ui/TopHud.prefab")
    root = builder.add_node("TopHud", None, (1186, 94))
    builder.add_sprite(root, "resources/textures/ui/panel_dark.png", sliced=True)
    builder.add_opacity(root)
    left_badge = builder.add_node("LeftBadgeSlot", root, (68, 68), (-548, 0, 0))
    right_badge = builder.add_node("RightBadgeSlot", root, (68, 68), (548, 0, 0))
    player_plate = builder.add_node("PlayerPlate", root, (238, 62), (-338, 0, 0))
    builder.add_sprite(player_plate, "resources/textures/ui/panel_inset.png", sliced=True)
    break_plate = builder.add_node("BreakPlate", root, (292, 62), (-20, 0, 0))
    builder.add_sprite(break_plate, "resources/textures/ui/panel_inset.png", sliced=True)
    info_plate = builder.add_node("InfoPlate", root, (254, 62), (262, 0, 0))
    builder.add_sprite(info_plate, "resources/textures/ui/panel_inset.png", sliced=True)
    builder.add_node("ScoreTitleSlot", player_plate, (98, 24), (-62, 12, 0))
    builder.add_node("ScoreValueSlot", player_plate, (110, 36), (-66, -14, 0))
    builder.add_node("BreakTitleSlot", break_plate, (130, 32), (-30, 0, 0))
    builder.add_node("BreakValueSlot", break_plate, (90, 40), (78, 0, 0))
    builder.add_node("StageSlot", info_plate, (220, 28), (0, 12, 0))
    builder.add_node("ShotsSlot", info_plate, (220, 24), (0, -14, 0))
    builder.add_node("HomeButtonSlot", root, (88, 42), (232, 0, 0))
    builder.add_node("RestartButtonSlot", root, (88, 42), (332, 0, 0))
    builder.add_node("PauseButtonSlot", root, (88, 42), (432, 0, 0))
    builder.write(PREFABS / "TopHud.prefab")


def build_bottom_hud():
    builder = PrefabBuilder("BottomHud", "assets/resources/prefabs/ui/BottomHud.prefab")
    root = builder.add_node("BottomHud", None, (1160, 100))
    builder.add_sprite(root, "resources/textures/ui/panel_dark.png", sliced=True)
    builder.add_opacity(root)
    power_module = builder.add_node("PowerModule", root, (468, 64), (-294, 0, 0))
    builder.add_sprite(power_module, "resources/textures/ui/panel_inset.png", sliced=True)
    status_module = builder.add_node("StatusModule", root, (540, 64), (230, 0, 0))
    builder.add_sprite(status_module, "resources/textures/ui/panel_inset.png", sliced=True)
    power_bar_bg = builder.add_node("PowerBarBg", power_module, (266, 24), (-16, 0, 0))
    builder.add_sprite(power_bar_bg, "resources/textures/ui/panel_inset.png", sliced=True)
    builder.add_node("PowerTitleSlot", power_module, (100, 24), (-176, 0, 0))
    builder.add_node("PowerFillSlot", power_bar_bg, (256, 18), (0, 0, 0))
    builder.add_node("PowerValueSlot", power_module, (70, 24), (186, 0, 0))
    builder.add_node("StatusTitleSlot", status_module, (150, 24), (-170, 0, 0))
    builder.add_node("StatusValueSlot", status_module, (320, 40), (62, 0, 0))
    builder.write(PREFABS / "BottomHud.prefab")


def build_achievement_card():
    builder = PrefabBuilder("AchievementCard", "assets/resources/prefabs/ui/AchievementCard.prefab")
    root = builder.add_node("AchievementCard", None, (220, 78))
    builder.add_sprite(root, "resources/textures/ui/panel_inset.png", sliced=True)
    builder.add_opacity(root)

    badge = builder.add_node("AchievementPointsBadge", root, (56, 24), (72, 18, 0))
    builder.add_sprite(badge, "resources/textures/ui/top_strip.png", sliced=True)
    builder.add_label(badge, "10", 13, color=(54, 39, 18, 255), width=40, height=16)

    builder.add_label(
        root,
        "成就名称",
        19,
        color=(245, 239, 218, 255),
        width=150,
        height=24,
        position=(-14, 18, 0),
        horizontal_align=0,
    )
    builder.add_label(
        root,
        "成就描述文本",
        12,
        color=(210, 214, 220, 214),
        line_height=14,
        width=190,
        height=30,
        position=(0, -4, 0),
    )
    builder.add_label(
        root,
        "普通 · 1",
        12,
        color=(212, 183, 104, 255),
        line_height=14,
        width=190,
        height=16,
        position=(0, -25, 0),
    )
    builder.write(PREFABS / "AchievementCard.prefab")


def build_achievement_summary_chip():
    builder = PrefabBuilder("AchievementSummaryChip", "assets/resources/prefabs/ui/AchievementSummaryChip.prefab")
    root = builder.add_node("AchievementSummaryChip", None, (256, 58))
    builder.add_sprite(root, "resources/textures/ui/panel_inset.png", sliced=True)
    builder.add_opacity(root)
    builder.add_label(root, "已解锁", 16, color=(188, 194, 199, 255), width=96, height=22, position=(-64, 0, 0), horizontal_align=0)
    builder.add_label(root, "0 / 0", 22, color=(245, 239, 218, 255), width=116, height=26, position=(64, 0, 0), horizontal_align=2)
    builder.write(PREFABS / "AchievementSummaryChip.prefab")


def build_settlement_stat_row():
    builder = PrefabBuilder("SettlementStatRow", "assets/resources/prefabs/ui/SettlementStatRow.prefab")
    root = builder.add_node("SettlementStatRow", None, (446, 30))
    builder.add_sprite(root, "resources/textures/ui/panel_inset.png", sliced=True)
    builder.add_opacity(root, 236)
    builder.add_label(root, "得分", 18, color=(188, 194, 199, 255), width=160, height=22, position=(-170, 0, 0), horizontal_align=0)
    builder.add_label(root, "0", 22, color=(245, 239, 218, 255), width=160, height=22, position=(170, 0, 0), horizontal_align=2)
    builder.write(PREFABS / "SettlementStatRow.prefab")


def main():
    for rel, (w, h, border) in TEXTURE_DEFS.items():
        asset = ROOT / "assets" / rel
        if not asset.exists():
            continue
        ensure_parent_meta(asset)
        meta_path = asset.with_suffix(asset.suffix + ".meta")
        meta_path.write_text(json.dumps(image_meta(rel, w, h, border), indent=2) + "\n", encoding="utf-8")
    ensure_parent_meta(PREFABS / "CommonButton.prefab")
    build_common_button()
    build_top_hud()
    build_bottom_hud()
    build_achievement_card()
    build_achievement_summary_chip()
    build_settlement_stat_row()
    print("generated prefab and meta assets")


if __name__ == "__main__":
    main()
