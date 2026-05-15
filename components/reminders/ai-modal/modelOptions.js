import { DEFAULT_REMINDER_MODEL_ID } from "@/lib/ai/modelIds";

export const modelOptions = [
  {
    value: DEFAULT_REMINDER_MODEL_ID,
    label: "Grok 4.1 Fast",
    desc: "Fast, great at tool use",
  },
  {
    value: "deepseek/deepseek-v3.2",
    label: "DeepSeek V3.2",
    desc: "Open-weight, good at Chinese",
  },
];
