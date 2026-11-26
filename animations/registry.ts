import type { Animation } from "./types.ts";
import { aurora } from "./aurora.ts";
import { ocean } from "./ocean.ts";
import { galaxy } from "./galaxy.ts";

export const animations = { aurora, ocean, galaxy } as const satisfies Record<string, Animation>;
