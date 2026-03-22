#!/usr/bin/env python3
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCENE_PATH = ROOT / "assets" / "scenes" / "Main.scene"
DEFAULT_SPRITE_MATERIAL_UUID = "eca5d2f2-8ef6-41c2-bbe6-f9c79d09c432"
SPRITEFRAME_ID = "f9941"


EXACT_BINDINGS = {
    "Background": ("resources/textures/ui/backdrop.png", False),
    "TopStrip": ("resources/textures/ui/top_strip.png", True),
    "PreviewTable": ("resources/textures/table/wood_frame.png", True),
    "PreviewFelt": ("resources/textures/table/felt.png", True),
    "LeftPanel": ("resources/textures/ui/panel_dark.png", True),
    "Button-上一关": ("resources/textures/ui/button_neutral.png", True),
    "Button-下一关": ("resources/textures/ui/button_neutral.png", True),
    "Button-开始闯关": ("resources/textures/ui/button_green.png", True),
    "Button-练习模式": ("resources/textures/ui/button_blue.png", True),
    "Button-重新开始": ("resources/textures/ui/button_red.png", True),
    "TableOuter": ("resources/textures/table/wood_frame.png", True),
    "TableFelt": ("resources/textures/table/felt.png", True),
    "TopHud": ("resources/textures/ui/panel_dark.png", True),
    "Button-暂停": ("resources/textures/ui/button_bronze.png", True),
    "Button-重开": ("resources/textures/ui/button_neutral.png", True),
    "Button-主页": ("resources/textures/ui/button_neutral.png", True),
    "BottomHud": ("resources/textures/ui/panel_dark.png", True),
    "PowerBarBg": ("resources/textures/ui/panel_inset.png", True),
    "OverlayPanel": ("resources/textures/ui/panel_dark.png", True),
    "Button-继续游戏": ("resources/textures/ui/button_blue.png", True),
    "Button-再来一局": ("resources/textures/ui/button_green.png", True),
    "Button-返回主页": ("resources/textures/ui/button_neutral.png", True),
}

PREFIX_BINDINGS = {
    "PreviewPocket-": ("resources/textures/table/pocket.png", False),
    "Pocket-": ("resources/textures/table/pocket.png", False),
}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sprite_frame_uuid(asset_rel: str) -> str:
    meta_path = (ROOT / "assets" / asset_rel).with_suffix(".png.meta")
    meta = read_json(meta_path)
    return meta["subMetas"][SPRITEFRAME_ID]["uuid"]


def node_binding(name: str):
    if name in EXACT_BINDINGS:
        return EXACT_BINDINGS[name]
    for prefix, binding in PREFIX_BINDINGS.items():
        if name.startswith(prefix):
            return binding
    return None


def has_sprite(items, node):
    for ref in node.get("_components", []):
        component = items[ref["__id__"]]
        if component.get("__type__") == "cc.Sprite":
            return True
    return False


def add_sprite(items, node_index: int, sprite_uuid: str, sliced: bool):
    node = items[node_index]
    sprite_index = len(items)
    node.setdefault("_components", []).append({"__id__": sprite_index})
    items.append(
        {
            "__type__": "cc.Sprite",
            "_name": "",
            "_objFlags": 0,
            "__editorExtras__": {},
            "node": {"__id__": node_index},
            "_enabled": True,
            "__prefab": None,
            "_customMaterial": None,
            "_visFlags": 0,
            "_srcBlendFactor": 2,
            "_dstBlendFactor": 4,
            "_color": {"__type__": "cc.Color", "r": 255, "g": 255, "b": 255, "a": 255},
            "_spriteFrame": {"__uuid__": sprite_uuid},
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


def main():
    items = read_json(SCENE_PATH)
    updated = 0
    for index, item in enumerate(items):
        if item.get("__type__") != "cc.Node":
            continue
        binding = node_binding(item.get("_name", ""))
        if not binding:
            continue
        if has_sprite(items, item):
            continue
        asset_rel, sliced = binding
        add_sprite(items, index, sprite_frame_uuid(asset_rel), sliced)
        updated += 1

    SCENE_PATH.write_text(json.dumps(items, indent=2) + "\n", encoding="utf-8")
    print(f"attached sprite components: {updated}")


if __name__ == "__main__":
    main()
