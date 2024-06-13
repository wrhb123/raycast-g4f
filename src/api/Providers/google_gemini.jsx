import Gemini, { messageToParts } from "gemini-ai";
import { getPreferenceValues } from "@raycast/api";
import fetch from "node-fetch";
import fs from "fs";

export const GeminiProvider = "GeminiProvider";

// By default, we set the most lenient safety settings
const safetySettings = {
  hate: Gemini.SafetyThreshold.BLOCK_NONE,
  sexual: Gemini.SafetyThreshold.BLOCK_NONE,
  harassment: Gemini.SafetyThreshold.BLOCK_NONE,
  dangerous: Gemini.SafetyThreshold.BLOCK_NONE,
};

export const getGoogleGeminiResponse = async (chat, options, stream_update, max_retries = 3) => {
  let APIKeysStr = getPreferenceValues()["GeminiAPIKeys"];
  let APIKeys = APIKeysStr.split(",").map((x) => x.trim());

  try {
    for (const APIKey of APIKeys) {
      const googleGemini = new Gemini(APIKey, { fetch: fetch });
      let [formattedChat, query] = await GeminiFormatChat(chat, googleGemini);

      const geminiChat = googleGemini.createChat({
        model: options.model,
        messages: formattedChat,
        maxOutputTokens: 8192, // accurate as of 2024-05-31, for gemini-1.5-flash-latest
        temperature: options.temperature ?? 0.7,
      });

      // Send message
      try {
        let response = "";
        if (stream_update) {
          const handler = (chunk) => {
            response += chunk;
            stream_update(response);
          };
          await geminiChat.ask(query, { stream: handler, safetySettings: safetySettings });
          return;
        } else {
          response = await geminiChat.ask(query, { safetySettings: safetySettings });
          return response;
        }
      } catch (e) {
        continue;
      }
    }
  } catch (e) {
    // if all API keys fail, we allow a few retries
    if (max_retries > 0) {
      console.log(e, "Retrying...");
      return await getGoogleGeminiResponse(chat, options, stream_update, max_retries - 1);
    } else {
      throw e;
    }
  }
};

// Reformat chat to be in google gemini format
// input: array of Message objects, output: array of gemini-ai Message objects that can be passed
// directly to the messages parameter in createChat. This includes uploading files.
// the googleGemini object is used internally in gemini-ai to upload large files via Google's files API.
export const GeminiFormatChat = async (chat, googleGemini) => {
  let formattedChat = [];

  for (let i = 0; i < chat.length; i++) {
    const message = chat[i]; // Message object
    const role = message.role === "user" ? "user" : "model"; // gemini-ai uses "user" and "model" roles

    // We now convert to a Message type as used in gemini-ai. It essentially just consists of role and parts.
    // (see gemini-g4f, types.ts)
    //
    // to do the conversion, we just call on gemini-ai's pre-existing messageToParts function. (see gemini-g4f, index.ts)
    // messageToParts takes in an array of [String | ArrayBuffer | FileUpload] and returns an array that can be passed to parts param.
    // where FileUpload is just { filePath: string, buffer: Buffer }.
    let geminiMessageParts;
    if (message.files && message.files.length > 0) {
      let arr = [message.content];
      for (const file of message.files) {
        const buffer = fs.readFileSync(file);
        const fileUpload = { filePath: file, buffer: buffer };
        arr.push(fileUpload);
      }
      geminiMessageParts = await messageToParts(arr, googleGemini);
    } else {
      geminiMessageParts = [{ text: message.content }];
    }
    let geminiMessage = { role: role, parts: geminiMessageParts };
    formattedChat.push(geminiMessage);
  }

  // remove last message and return it separately
  const last_message = formattedChat.pop();
  return [formattedChat, last_message];
};
