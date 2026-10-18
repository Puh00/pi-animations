export type RGB = readonly [number, number, number];
/** One printable, single-terminal-column glyph with optional foreground and background RGB colors. */
export interface AnimationCell { glyph: string; fg?: RGB; bg?: RGB; mono?: string }
/** Rectangular frame: every row has `width` cells and there are exactly `height` rows. */
export type AnimationFrame = readonly (readonly AnimationCell[])[];
export interface FrameRequest { width: number; height: number; seconds: number }
export interface Animation { renderFrame(request: FrameRequest): AnimationFrame }
