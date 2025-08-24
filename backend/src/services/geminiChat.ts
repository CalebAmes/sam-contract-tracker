import axios from "axios";

export type GeminiChatModel = "2.0-flash" | "2.5-flash" | "2.5-pro";

function getModelEndpoint(model: GeminiChatModel): string {
  const BASE_API_URL =
    "https://generativelanguage.googleapis.com/v1beta/models";
  const modelMap = {
    "2.0-flash": "gemini-2.0-flash",
    "2.5-flash": "gemini-2.5-flash",
    "2.5-pro": "gemini-2.5-pro",
  } as const;
  return `${BASE_API_URL}/${modelMap[model]}:generateContent`;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export class GeminiChatService {
  static async generateReply(
    messages: ChatMessage[],
    apiKey: string,
    model: GeminiChatModel = "2.0-flash"
  ): Promise<string> {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    // Map chat messages to Gemini contents format
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const generationConfig = {
      temperature: 0.2,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 10000,
    };

    const endpoint = getModelEndpoint(model);

    const response = await axios.post(
      `${endpoint}?key=${apiKey}`,
      {
        contents,
        generationConfig,
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_NONE",
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_NONE",
          },
        ],
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const candidate = response.data?.candidates?.[0];
    if (!candidate?.content?.parts?.[0]?.text) {
      throw new Error("Invalid Gemini chat response");
    }

    const text: string = candidate.content.parts[0].text;
    // Some responses can be fenced; strip if needed
    if (text.includes("```")) {
      const match = text.match(/```[a-zA-Z]*\n([\s\S]*?)\n```/);
      return match?.[1] || text;
    }
    return text;
  }
}

export default GeminiChatService;
