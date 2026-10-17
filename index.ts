import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import { createAnimationComponent } from "./animations/player.ts";
import { animations } from "./animations/registry.ts";

export type Mode = "aurora" | "aurora-still" | "off";

export function parseMode(value: string): Mode | undefined {
  switch (value.trim().toLowerCase()) {
    case "on": case "default": case "aurora": return "aurora";
    case "still": case "static": case "aurora-still": return "aurora-still";
    case "off": case "reset": return "off";
    default: return undefined;
  }
}

export function createAuroraComponent(tui: TUI, theme: Theme, mode: Exclude<Mode, "off">, preview = false) {
  return createAnimationComponent(tui, theme, animations.aurora, mode === "aurora-still", preview);
}

const WIDGET_KEY = "pi-loading-animation-scene";

function canUseWidget(ctx: ExtensionContext): boolean {
  return ctx.mode === "tui" && ctx.hasUI && typeof ctx.ui.setWidget === "function";
}

export default function (pi: ExtensionAPI) {
  let mode: Mode = "aurora";
  let busy = false;

  const syncUi = (ctx: ExtensionContext) => {
    if (!canUseWidget(ctx)) return;
    const activeMode = mode;
    if (busy && activeMode !== "off") {
      ctx.ui.setWorkingIndicator({ frames: [""] });
      ctx.ui.setWidget(WIDGET_KEY, (tui, theme) => createAuroraComponent(tui, theme, activeMode), { placement: "aboveEditor" });
    } else {
      ctx.ui.setWidget(WIDGET_KEY, undefined);
      ctx.ui.setWorkingIndicator(undefined);
    }
  };

  pi.on("session_start", (_event, ctx) => {
    busy = false;
    mode = "aurora";
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type !== "custom" || entry.customType !== "nap-animation") continue;
      const data = entry.data as { mode?: unknown } | undefined;
      if (typeof data?.mode === "string") mode = parseMode(data.mode) ?? "aurora";
    }
    syncUi(ctx);
  });
  pi.on("agent_start", (_event, ctx) => {
    busy = true;
    syncUi(ctx);
  });
  pi.on("agent_settled", (_event, ctx) => {
    busy = false;
    syncUi(ctx);
  });
  pi.on("session_shutdown", (_event, ctx) => {
    busy = false;
    syncUi(ctx);
  });

  for (const command of ["aurora", "animation", "nap"]) {
    pi.registerCommand(command, {
      description: "Control Aurora: on, preview, still, or off.",
      handler: async (args, ctx) => {
        const selection = args.trim().toLowerCase() || "on";
        if (selection === "preview") {
          if (!ctx.hasUI || ctx.mode !== "tui") return;
          await ctx.ui.custom<void>((tui, theme, _keybindings, done) => {
            const component = createAuroraComponent(tui, theme, mode === "off" ? "aurora" : mode, true);
            return { ...component, handleInput: () => done() };
          });
          return;
        }
        const next = parseMode(selection);
        if (!next) {
          if (ctx.hasUI) ctx.ui.notify(`Usage: /${command} [on|preview|still|off]`, "error");
          return;
        }
        mode = next;
        syncUi(ctx);
        pi.appendEntry("nap-animation", { mode });
        if (ctx.hasUI) ctx.ui.notify(`Working animation: ${mode}`, "info");
      },
    });
  }
}
