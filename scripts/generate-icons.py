#!/usr/bin/env python3

from pathlib import Path
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent.parent
ICON_DIR = ROOT / "public" / "icons"
ICON_DIR.mkdir(parents=True, exist_ok=True)


def interpolate(first, second, amount):
    return tuple(
        round(
            first[index] +
            (second[index] - first[index]) * amount
        )
        for index in range(3)
    )


def create_gradient(size):
    image = Image.new(
        "RGBA",
        (size, size),
        (0, 0, 0, 0),
    )

    draw = ImageDraw.Draw(image)

    green = (125, 243, 138)
    cyan = (67, 216, 193)
    violet = (141, 131, 255)

    for x in range(size):
        position = x / max(size - 1, 1)

        if position <= 0.58:
            color = interpolate(
                green,
                cyan,
                position / 0.58,
            )
        else:
            color = interpolate(
                cyan,
                violet,
                (position - 0.58) / 0.42,
            )

        draw.line(
            (x, 0, x, size),
            fill=(*color, 255),
        )

    return image


def draw_logo(size, maskable=False):
    gradient = create_gradient(size)

    if maskable:
        canvas = gradient
        content_scale = 0.72
    else:
        canvas = Image.new(
            "RGBA",
            (size, size),
            (0, 0, 0, 0),
        )

        radius = round(size * 0.27)

        mask = Image.new(
            "L",
            (size, size),
            0,
        )

        mask_draw = ImageDraw.Draw(mask)

        mask_draw.rounded_rectangle(
            (0, 0, size - 1, size - 1),
            radius=radius,
            fill=255,
        )

        canvas.paste(
            gradient,
            (0, 0),
            mask,
        )

        content_scale = 0.82

    draw = ImageDraw.Draw(canvas)

    center_x = size / 2
    center_y = size / 2

    content_size = size * content_scale
    left = center_x - content_size / 2
    top = center_y - content_size / 2

    dark = (7, 17, 10, 225)

    circle_radius = size * 0.19

    draw.ellipse(
        (
            center_x - circle_radius,
            center_y - circle_radius,
            center_x + circle_radius,
            center_y + circle_radius,
        ),
        fill=(7, 17, 10, 35),
    )

    triangle_width = size * 0.19
    triangle_height = size * 0.25

    triangle_left = center_x - triangle_width * 0.38

    draw.polygon(
        (
            (
                triangle_left,
                center_y - triangle_height / 2,
            ),
            (
                triangle_left,
                center_y + triangle_height / 2,
            ),
            (
                triangle_left + triangle_width,
                center_y,
            ),
        ),
        fill=dark,
    )

    line_width = max(3, round(size * 0.046))

    arc_box_1 = (
        left + size * 0.02,
        top + size * 0.16,
        center_x + size * 0.05,
        top + content_size - size * 0.16,
    )

    arc_box_2 = (
        left - size * 0.08,
        top + size * 0.04,
        center_x + size * 0.02,
        top + content_size - size * 0.04,
    )

    draw.arc(
        arc_box_1,
        start=105,
        end=255,
        fill=dark,
        width=line_width,
    )

    draw.arc(
        arc_box_2,
        start=105,
        end=255,
        fill=dark,
        width=line_width,
    )

    shine_radius = size * 0.045

    draw.ellipse(
        (
            size * 0.76 - shine_radius,
            size * 0.22 - shine_radius,
            size * 0.76 + shine_radius,
            size * 0.22 + shine_radius,
        ),
        fill=(255, 255, 255, 225),
    )

    return canvas


def save_icon(size, filename, maskable=False):
    image = draw_logo(
        size,
        maskable=maskable,
    )

    destination = ICON_DIR / filename

    image.save(
        destination,
        format="PNG",
        optimize=True,
    )

    print(f"Created {destination}")


def main():
    save_icon(
        180,
        "icon-180.png",
    )

    save_icon(
        192,
        "icon-192.png",
    )

    save_icon(
        512,
        "icon-512.png",
    )

    save_icon(
        512,
        "icon-maskable-512.png",
        maskable=True,
    )


if __name__ == "__main__":
    main()
