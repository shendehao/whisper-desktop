"""重新生成桌面客户端图标资源 —— 白色圆形底盘 + 现有黑色 logo。

输出文件：
    icons/32x32.png        ← Windows/Linux 小图标
    icons/64x64.png        ← 中等
    icons/128x128.png      ← 桌面大图标
    icons/128x128@2x.png   ← HiDPI（256×256）
    icons/icon.png         ← 主图（512×512）
    icons/icon.ico         ← Windows 多分辨率 (16/24/32/48/64/128/256)

输入：icons/icon.png（必须是 512×512 黑色 logo + 白底）
"""
from __future__ import annotations
import os
import sys
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS = os.path.join(ROOT, "src-tauri", "icons")
# 用 public/img/logo.png 作为干净源（不会被本脚本覆盖），保证可重入
SRC_LOGO = os.path.join(ROOT, "public", "img", "logo.png")


def load_logo() -> Image.Image:
    """读取黑色 logo PNG，转成正方形 RGBA。"""
    if not os.path.isfile(SRC_LOGO):
        sys.exit(f"找不到源 logo：{SRC_LOGO}")
    img = Image.open(SRC_LOGO).convert("RGBA")
    # 统一拉成正方形（按短边裁剪以居中）
    if img.size[0] != img.size[1]:
        s = min(img.size)
        left = (img.size[0] - s) // 2
        top = (img.size[1] - s) // 2
        img = img.crop((left, top, left + s, top + s))
    return img


def make_circular_icon(logo: Image.Image, size: int) -> Image.Image:
    """生成方形透明画布，中心白色圆形 + logo 居中。

    设计参数：
        - 画布外侧：完全透明（让 Windows/macOS 任意背景下渲染圆形外形）
        - 圆白底：留 2% 边距
        - logo 缩放：圆直径的 64%（视觉居中、四周留呼吸感）
        - 圆边缘：1px 浅灰描边（让纯白桌面下也有边界感）
    """
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    margin = max(1, int(round(size * 0.02)))
    # 白底圆
    draw.ellipse(
        (margin, margin, size - margin - 1, size - margin - 1),
        fill=(255, 255, 255, 255),
    )

    # logo 缩放
    logo_target = max(8, int(round(size * 0.64)))
    logo_resized = logo.resize((logo_target, logo_target), Image.LANCZOS)
    paste_x = (size - logo_target) // 2
    paste_y = (size - logo_target) // 2
    img.paste(logo_resized, (paste_x, paste_y), logo_resized)

    # 浅灰描边（仅大图，避免小图发糊）
    if size >= 64:
        edge = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        edraw = ImageDraw.Draw(edge)
        edraw.ellipse(
            (margin, margin, size - margin - 1, size - margin - 1),
            outline=(0, 0, 0, 28),
            width=max(1, size // 256),
        )
        img = Image.alpha_composite(img, edge)

    return img


def main():
    logo = load_logo()
    print(f"Loaded source logo: {logo.size}")

    plan = [
        (32, "32x32.png"),
        (64, "64x64.png"),
        (128, "128x128.png"),
        (256, "128x128@2x.png"),
        (512, "icon.png"),
    ]
    for sz, name in plan:
        icon = make_circular_icon(logo, sz)
        out = os.path.join(ICONS, name)
        icon.save(out, "PNG", optimize=True)
        print(f"  written {name:18s} {sz}x{sz}  ({os.path.getsize(out)} bytes)")

    # ICO 多分辨率
    ico_master = make_circular_icon(logo, 256)
    ico_path = os.path.join(ICONS, "icon.ico")
    ico_master.save(
        ico_path,
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print(f"  written icon.ico         multi-res  ({os.path.getsize(ico_path)} bytes)")
    print("done.")


if __name__ == "__main__":
    main()
