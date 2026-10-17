import type { Animation } from "./types.ts";
import { aurora } from "./aurora.ts";

export const animations = { aurora } as const satisfies Record<string, Animation>;
