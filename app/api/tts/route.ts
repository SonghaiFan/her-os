import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

type TtsRequest = {
  autoEmotion?: boolean;
  emo?: Record<string, number>;
  outputFormat?: "mp3" | "wav";
  speed?: number;
  targetLang?: string;
  text?: string;
  trimSilence?: boolean;
};

const NOIZ_API_BASE_URL = process.env.NOIZ_API_BASE_URL ?? "https://noiz.ai/v1";
const DEFAULT_OUTPUT_FORMAT =
  process.env.NOIZ_OUTPUT_FORMAT === "wav" ? "wav" : "mp3";
const DEFAULT_QUALITY_PRESET = Number.parseInt(
  process.env.NOIZ_QUALITY_PRESET ?? "3",
  10,
);
const DEFAULT_SPEED = Number.parseFloat(process.env.NOIZ_SPEED ?? "1");
const DEV_TTS_OUTPUT_DIR = path.join(process.cwd(), "src", "data", "tts");

function slugifyText(value: string, maxLength = 48) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");

  return slug || "voice";
}

function getAudioExtension(contentType: string | null, fallback: "mp3" | "wav") {
  if (contentType?.includes("audio/wav")) {
    return "wav";
  }

  if (contentType?.includes("audio/mpeg")) {
    return "mp3";
  }

  return fallback;
}

async function saveDevTtsArtifact(options: {
  audio: ArrayBuffer;
  contentType: string | null;
  duration: string | null;
  outputFormat: "mp3" | "wav";
  text: string;
  timestamp: string | null;
  voiceId: string;
}) {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const extension = getAudioExtension(options.contentType, options.outputFormat);
  const fileTimestamp = options.timestamp ?? String(Date.now());
  const basename = `${fileTimestamp}-${slugifyText(options.text)}`;
  const audioFilename = `${basename}.${extension}`;
  const metaFilename = `${basename}.json`;

  await mkdir(DEV_TTS_OUTPUT_DIR, { recursive: true });
  await writeFile(
    path.join(DEV_TTS_OUTPUT_DIR, audioFilename),
    Buffer.from(options.audio),
  );
  await writeFile(
    path.join(DEV_TTS_OUTPUT_DIR, metaFilename),
    JSON.stringify(
      {
        savedAt: new Date().toISOString(),
        timestamp: options.timestamp,
        duration: options.duration,
        voiceId: options.voiceId,
        contentType: options.contentType,
        outputFormat: extension,
        text: options.text,
      },
      null,
      2,
    ),
  );

  return audioFilename;
}

function normalizeNoizApiKey(value: string) {
  const key = value.trim();

  if (!key) {
    return key;
  }

  try {
    const decoded = Buffer.from(key, "base64");
    const canonical = decoded.toString("base64").replace(/=+$/g, "");

    if (decoded.length > 0 && canonical === key.replace(/=+$/g, "")) {
      return key;
    }
  } catch {}

  return Buffer.from(key, "utf8").toString("base64");
}

function parseBoolean(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) {
    return defaultValue;
  }

  return /^(1|true|yes|on)$/i.test(value);
}

function buildNoizUrl(pathname: string) {
  return new URL(pathname, `${NOIZ_API_BASE_URL}/`).toString();
}

async function maybeEnhanceEmotion(
  text: string,
  apiKey: string,
  enabled: boolean,
) {
  if (!enabled) {
    return text;
  }

  const response = await fetch(buildNoizUrl("emotion-enhance"), {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Emotion enhancement failed with ${response.status}.`);
  }

  const payload = (await response.json()) as {
    data?: {
      emotion_enhance?: string;
    };
  };

  return payload.data?.emotion_enhance?.trim() || text;
}

export async function POST(request: Request) {
  let payload: TtsRequest;

  try {
    payload = (await request.json()) as TtsRequest;
  } catch {
    return new Response("Invalid request body.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const text = payload.text?.trim();

  if (!text) {
    return new Response("Missing text.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const apiKey = process.env.NOIZ_API_KEY?.trim();
  const voiceId = process.env.NOIZ_VOICE_ID?.trim();

  if (!apiKey || !voiceId) {
    return new Response("Missing NOIZ_API_KEY or NOIZ_VOICE_ID.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  try {
    const normalizedApiKey = normalizeNoizApiKey(apiKey);
    const shouldAutoEmotion =
      payload.autoEmotion ??
      parseBoolean(process.env.NOIZ_AUTO_EMOTION, false);
    const enhancedText = await maybeEnhanceEmotion(
      text,
      normalizedApiKey,
      shouldAutoEmotion,
    );
    const formData = new FormData();

    formData.append("text", enhancedText);
    formData.append("voice_id", voiceId);
    formData.append("quality_preset", String(DEFAULT_QUALITY_PRESET));
    formData.append(
      "output_format",
      payload.outputFormat === "wav" ? "wav" : DEFAULT_OUTPUT_FORMAT,
    );
    formData.append(
      "speed",
      String(
        Number.isFinite(payload.speed) ? payload.speed : DEFAULT_SPEED,
      ),
    );
    formData.append(
      "trim_silence",
      String(
        payload.trimSilence ??
          parseBoolean(process.env.NOIZ_TRIM_SILENCE, true),
      ),
    );

    const targetLang = payload.targetLang ?? process.env.NOIZ_TARGET_LANG;

    if (targetLang) {
      formData.append("target_lang", targetLang);
    }

    const similarityEnh =
      parseBoolean(process.env.NOIZ_SIMILARITY_ENH, false);
    formData.append("similarity_enh", String(similarityEnh));

    if (payload.emo && Object.keys(payload.emo).length > 0) {
      formData.append("emo", JSON.stringify(payload.emo));
    } else if (process.env.NOIZ_EMO_JSON?.trim()) {
      formData.append("emo", process.env.NOIZ_EMO_JSON.trim());
    }

    const response = await fetch(buildNoizUrl("text-to-speech"), {
      method: "POST",
      headers: {
        Authorization: normalizedApiKey,
      },
      body: formData,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Noiz TTS failed with ${response.status}.`);
    }

    const audio = await response.arrayBuffer();
    const headers = new Headers();
    const contentType = response.headers.get("Content-Type");
    headers.set(
      "Content-Type",
      contentType || "audio/mpeg",
    );
    headers.set("Cache-Control", "no-store");
    headers.set("X-TTS-Provider", "noiz");

    const timestamp = response.headers.get("X-Timestamp");
    const duration = response.headers.get("X-Audio-Duration");
    const savedFilename = await saveDevTtsArtifact({
      audio,
      contentType,
      duration,
      outputFormat: payload.outputFormat === "wav" ? "wav" : DEFAULT_OUTPUT_FORMAT,
      text: enhancedText,
      timestamp,
      voiceId,
    });

    if (timestamp) {
      headers.set("X-Timestamp", timestamp);
    }

    if (duration) {
      headers.set("X-Audio-Duration", duration);
    }

    if (savedFilename) {
      headers.set("X-TTS-Saved-File", savedFilename);
    }

    return new Response(audio, {
      status: 200,
      headers,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Noiz TTS request failed.";

    return new Response(message, {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
