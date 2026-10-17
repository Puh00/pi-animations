import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { AssistantMessage } from "@earendil-works/pi-ai";

const cost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
export default function (pi: any) {
  pi.registerProvider("animation-test", {
    name: "Animation test fixture",
    api: "animation-test-api",
    apiKey: "fixture-key",
    models: [{ id: "fixture", name: "Fixture", api: "animation-test-api", provider: "animation-test", baseUrl: "http://local.invalid", reasoning: false, input: ["text"], cost, contextWindow: 4096, maxTokens: 256 }],
    streamSimple(model: any, context: any, options: any = {}) {
      const stream = createAssistantMessageEventStream();
      const signal = options.signal;
      const message: AssistantMessage = { role: "assistant", content: [], api: model.api, provider: model.provider, model: model.id, usage: { input: 1, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 1, cost: { ...cost } }, stopReason: "pending", timestamp: Date.now() };
      void (async () => {
        stream.push({ type: "start", partial: message });
        const final = context.messages.filter((m: any) => m.role === "user").at(-1)?.content;
        const prompt = typeof final === "string" ? final : Array.isArray(final) ? final.map((part: any) => part.text ?? "").join("") : "";
        if (prompt.includes("tool-test") && !context.messages.some((m: any) => m.role === "toolResult")) {
          const tool = { type: "toolCall" as const, id: "fixture-call", name: "bash", arguments: { command: "sleep 1; printf tool-ok" } };
          message.content = [tool]; message.stopReason = "toolUse";
          stream.push({ type: "toolcall_start", contentIndex: 0, partial: message });
          stream.push({ type: "toolcall_end", contentIndex: 0, toolCall: tool, partial: message });
          stream.push({ type: "done", reason: "toolUse", message });
          stream.end(message);
          return;
        }
        const text = prompt.includes("long-test") ? "A deliberately slow local fixture response for animation verification. ".repeat(12) : "fixture-ok";
        message.content = [{ type: "text", text: "" }];
        stream.push({ type: "text_start", contentIndex: 0, partial: message });
        for (const part of text.match(/.{1,8}/g) ?? []) {
          if (signal?.aborted) {
            message.stopReason = "aborted"; message.errorMessage = "Request aborted";
            stream.push({ type: "error", reason: "aborted", error: message }); stream.end(message); return;
          }
          await new Promise(resolve => setTimeout(resolve, 180));
          message.content[0].text += part; message.usage.output += 1; message.usage.totalTokens += 1;
          stream.push({ type: "text_delta", contentIndex: 0, delta: part, partial: message });
        }
        message.stopReason = "stop";
        stream.push({ type: "text_end", contentIndex: 0, content: message.content[0].text, partial: message });
        stream.push({ type: "done", reason: "stop", message }); stream.end(message);
      })().catch(error => { message.stopReason = "error"; message.errorMessage = String(error); stream.push({ type: "error", reason: "error", error: message }); stream.end(message); });
      return stream;
    },
  });
}
