import type { Animation } from "./types.ts";
import { aurora } from "./aurora.ts";
import { ocean } from "./ocean.ts";

export const animations = { aurora, ocean } as const satisfies Record<string, Animation>;
