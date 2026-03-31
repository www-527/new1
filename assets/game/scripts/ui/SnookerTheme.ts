import { Color } from 'cc';

function clampChannel(value: number): number {
    return Math.max(0, Math.min(255, Math.round(value)));
}

export function shiftColor(color: Color, offset: number): Color {
    return new Color(
        clampChannel(color.r + offset),
        clampChannel(color.g + offset),
        clampChannel(color.b + offset),
        color.a,
    );
}

export function withAlpha(color: Color, alpha: number): Color {
    return new Color(color.r, color.g, color.b, clampChannel(alpha));
}

export const SnookerTheme = {
    background: {
        base: new Color(10, 14, 12, 255),
        vignette: new Color(4, 6, 5, 228),
        stageGlow: new Color(38, 88, 58, 134),
        strip: new Color(18, 22, 20, 176),
        stripEdge: new Color(160, 132, 66, 180),
    },
    metal: {
        frame: new Color(118, 98, 54, 255),
        frameBright: new Color(224, 192, 106, 255),
        dark: new Color(18, 22, 22, 244),
        darkSoft: new Color(28, 34, 33, 220),
        glass: new Color(255, 249, 221, 18),
        shadow: new Color(0, 0, 0, 132),
    },
    table: {
        woodDark: new Color(74, 30, 18, 255),
        woodMid: new Color(126, 60, 32, 255),
        woodHighlight: new Color(180, 96, 50, 255),
        brass: new Color(214, 178, 96, 255),
        brassShadow: new Color(124, 88, 40, 255),
        felt: new Color(34, 126, 70, 255),
        feltShade: new Color(22, 92, 52, 255),
        feltLight: new Color(104, 198, 126, 116),
        pocket: new Color(10, 10, 12, 255),
        pocketLip: new Color(204, 164, 88, 255),
        guideLine: new Color(255, 255, 255, 40),
    },
    text: {
        primary: new Color(248, 242, 230, 255),
        secondary: new Color(180, 191, 185, 255),
        accent: new Color(244, 203, 104, 255),
        danger: new Color(243, 110, 93, 255),
        success: new Color(124, 228, 150, 255),
        info: new Color(110, 182, 255, 255),
    },
    button: {
        green: new Color(36, 160, 74, 255),
        blue: new Color(52, 118, 206, 255),
        bronze: new Color(110, 72, 34, 255),
        neutral: new Color(58, 66, 68, 255),
        danger: new Color(165, 60, 56, 255),
    },
    ball: {
        shadow: new Color(0, 0, 0, 110),
        highlight: new Color(255, 255, 255, 188),
        sparkle: new Color(255, 245, 214, 228),
    },
};
