"use client";

import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import { Streamdown } from "streamdown";
import { TopologyRing } from "@/components/topology-ring";

type QaEntry = {
  q: string;
  a: string;
  f: string;
};

type Message = {
  id: string;
  role: "system" | "user" | "samantha";
  text: string;
};

type ConversationTurn = {
  role: "user" | "samantha";
  text: string;
};

function MessageBubbleContent({ message }: { message: Message }) {
  if (message.role !== "samantha") {
    return <p>{message.text}</p>;
  }

  return (
    <Streamdown className="dialogue-fragment__markdown" mode="streaming">
      {message.text}
    </Streamdown>
  );
}

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: {
    transcript: string;
  };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    AudioContext?: typeof AudioContext;
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitAudioContext?: typeof AudioContext;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const THINKING_DELAY_MS = 320;
const SESSION_HISTORY_LIMIT = 24;
const RING_UNTWIST_THRESHOLD = 0.8;
const RING_MAX_SPIN_SPEED = 0.2;
const ENTRANCE_EASE = [0.22, 1, 0.36, 1] as const;
const EXIT_EASE = [0.4, 0, 1, 1] as const;

function createMessage(role: Message["role"], text: string): Message {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${role}-${Date.now()}-${Math.random()}`;

  return { id, role, text };
}

function toBigrams(input: string) {
  const normalized = input.toLowerCase();
  const pairs: string[] = [];

  for (let index = 0; index < normalized.length - 1; index += 1) {
    const pair = normalized.slice(index, index + 2);

    if (!/\s/.test(pair)) {
      pairs.push(pair);
    }
  }

  return pairs;
}

function scoreSimilarity(source: string, target: string) {
  if (source.length <= 1 || target.length <= 1) {
    return Number(source.toLowerCase() === target.toLowerCase());
  }

  const left = toBigrams(source);
  const targetPairs = toBigrams(target);
  const right = [...targetPairs];

  if (!left.length || !right.length) {
    return 0;
  }

  let hits = 0;

  for (const pair of left) {
    const matchIndex = right.indexOf(pair);

    if (matchIndex !== -1) {
      hits += 1;
      right.splice(matchIndex, 1);
    }
  }

  return (2 * hits) / (left.length + targetPairs.length);
}

function findBestQa(question: string, qas: QaEntry[]) {
  let bestMatch: QaEntry | null = null;
  let bestScore = 0.3;

  for (const qa of qas) {
    const score = scoreSimilarity(question, qa.q);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = qa;
    }
  }

  return bestMatch;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function logTiming(label: string, startedAt?: number) {
  const timestamp = new Date().toISOString();
  const elapsed =
    startedAt === undefined ? "" : ` (+${Math.round(performance.now() - startedAt)}ms)`;

  console.info(`[her-os] ${timestamp} ${label}${elapsed}`);
}

function pickSamanthaVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();

  return (
    voices.find((voice) => /samantha/i.test(voice.name)) ??
    voices.find((voice) =>
      /google uk english female|female|zira|aria|ava|serena/i.test(voice.name),
    ) ??
    voices.find((voice) => /^en/i.test(voice.lang)) ??
    null
  );
}

async function fetchTtsAudio(
  text: string,
  options?: {
    outputFormat?: "mp3" | "wav";
  },
) {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      outputFormat: options?.outputFormat ?? "mp3",
    }),
  });

  if (!response.ok) {
    throw new Error((await response.text()) || "TTS request failed.");
  }

  return response.blob();
}

export function HerOsExperience({ qas }: { qas: QaEntry[] }) {
  const [phase, setPhase] = useState<"idle" | "booting" | "ready">("idle");
  const [isCollapsing, setIsCollapsing] = useState(false);
  const [isHelloPlaying, setIsHelloPlaying] = useState(false);
  const [bootProgress, setBootProgress] = useState(0);
  const [messages, setMessages] = useState<Message[]>([
    createMessage("system", "System initialized."),
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion() ?? false;

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const voiceFrameRef = useRef<number | null>(null);
  const voiceLevelRef = useRef(0);
  const shouldResumeRecognitionRef = useRef(false);
  const queuedResponsesRef = useRef(Promise.resolve());
  const hasShownSpeechFallbackRef = useRef(false);
  const isListeningRef = useRef(false);
  const conversationTurnsRef = useRef<ConversationTurn[]>([]);
  const queueResponseRef = useRef<(question: string) => void>(() => {});

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const appendMessage = (role: Message["role"], text: string) => {
    const message = createMessage(role, text);

    startTransition(() => {
      setMessages((current) => [...current.slice(-4), message]);
    });

    return message;
  };

  const appendConversationTurn = (turn: ConversationTurn) => {
    const nextHistory = [...conversationTurnsRef.current, turn].slice(
      -SESSION_HISTORY_LIMIT,
    );

    conversationTurnsRef.current = nextHistory;
    return nextHistory;
  };

  const updateMessage = (id: string, text: string) => {
    startTransition(() => {
      setMessages((current) =>
        current.map((message) =>
          message.id === id ? { ...message, text } : message,
        ),
      );
    });
  };

  const resumeRecognition = () => {
    if (!shouldResumeRecognitionRef.current || !recognitionRef.current) {
      return;
    }

    shouldResumeRecognitionRef.current = false;

    try {
      recognitionRef.current.start();
    } catch {
      setIsListening(false);
    }
  };

  const stopVoiceTracking = () => {
    if (voiceFrameRef.current !== null) {
      window.cancelAnimationFrame(voiceFrameRef.current);
      voiceFrameRef.current = null;
    }

    if (mediaSourceRef.current) {
      mediaSourceRef.current.disconnect();
      mediaSourceRef.current = null;
    }

    voiceLevelRef.current = 0;
  };

  const startVoiceTracking = async (audio: HTMLAudioElement) => {
    const AudioContextCtor =
      window.AudioContext ??
      ("webkitAudioContext" in window
        ? (window.webkitAudioContext as typeof AudioContext | undefined)
        : undefined);

    if (!AudioContextCtor) {
      voiceLevelRef.current = 0;
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }

    const context = audioContextRef.current;

    if (context.state === "suspended") {
      await context.resume();
    }

    if (!analyserRef.current) {
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      analyser.connect(context.destination);
      analyserRef.current = analyser;
    }

    stopVoiceTracking();

    const analyser = analyserRef.current;

    if (!analyser) {
      return;
    }

    const source = context.createMediaElementSource(audio);
    source.connect(analyser);
    mediaSourceRef.current = source;

    const samples = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteTimeDomainData(samples);

      let total = 0;

      for (const sample of samples) {
        const normalized = (sample - 128) / 128;
        total += normalized * normalized;
      }

      const rms = Math.sqrt(total / samples.length);
      voiceLevelRef.current = voiceLevelRef.current * 0.7 + rms * 0.3;
      voiceFrameRef.current = window.requestAnimationFrame(tick);
    };

    tick();
  };

  const playAudio = async (
    src: string,
    options?: {
      onProgress?: (progress: number) => void;
    },
  ) => {
    if (recognitionRef.current && isListeningRef.current) {
      shouldResumeRecognitionRef.current = true;
      recognitionRef.current.stop();
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(src);
    audio.preload = "auto";
    audioRef.current = audio;
    setIsSpeaking(true);
    await startVoiceTracking(audio);

    await new Promise<void>((resolve) => {
      let settled = false;

      const updateProgress = () => {
        if (!options?.onProgress) {
          return;
        }

        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          options.onProgress(Math.min(audio.currentTime / audio.duration, 1));
        }
      };

      const finish = () => {
        if (settled) {
          return;
        }

        settled = true;
        audio.removeEventListener("loadedmetadata", updateProgress);
        audio.removeEventListener("timeupdate", updateProgress);
        stopVoiceTracking();
        options?.onProgress?.(1);
        setIsSpeaking(false);
        resumeRecognition();
        resolve();
      };

      audio.addEventListener("loadedmetadata", updateProgress);
      audio.addEventListener("timeupdate", updateProgress);
      audio.addEventListener("ended", finish, { once: true });
      audio.addEventListener("error", finish, { once: true });

      void audio.play().catch(finish);
    });
  };

  const speakTextWithBrowser = async (text: string) => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      !text.trim()
    ) {
      return;
    }

    if (recognitionRef.current && isListeningRef.current) {
      shouldResumeRecognitionRef.current = true;
      recognitionRef.current.stop();
    }

    window.speechSynthesis.cancel();

    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      const preferredVoice = pickSamanthaVoice();

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.rate = 1;
      utterance.pitch = 1;

      const finish = () => {
        setIsSpeaking(false);
        resumeRecognition();
        resolve();
      };

      utterance.onstart = () => {
        setIsSpeaking(true);
      };
      utterance.onend = finish;
      utterance.onerror = finish;

      window.speechSynthesis.speak(utterance);
    });
  };

  const speakText = async (text: string) => {
    if (!text.trim()) {
      return;
    }

    try {
      const audioBlob = await fetchTtsAudio(text);
      const audioUrl = URL.createObjectURL(audioBlob);

      try {
        await playAudio(audioUrl);
        return;
      } finally {
        URL.revokeObjectURL(audioUrl);
      }
    } catch {
      await speakTextWithBrowser(text);
    }
  };

  const streamGeminiReply = async (
    question: string,
    history: ConversationTurn[],
    onText: (text: string) => void,
  ) => {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question, history }),
    });

    if (!response.ok) {
      throw new Error((await response.text()) || "Gemini request failed.");
    }

    if (!response.body) {
      throw new Error("Missing response stream.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let output = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        output += decoder.decode();
        break;
      }

      output += decoder.decode(value, { stream: true });
      onText(output);
    }

    return output.trim();
  };

  const queueResponse = (question: string) => {
    const trimmed = question.trim();

    if (!trimmed || phase !== "ready") {
      return;
    }

    appendMessage("user", trimmed);
    setInputValue("");

    queuedResponsesRef.current = queuedResponsesRef.current.then(async () => {
      const history = appendConversationTurn({ role: "user", text: trimmed });

      await delay(THINKING_DELAY_MS);
      const assistantMessage = appendMessage("samantha", "");
      let receivedFirstToken = false;
      const requestStartedAt = performance.now();

      try {
        logTiming("request:start");
        setIsThinking(true);
        logTiming("thinking:on", requestStartedAt);

        const reply = await streamGeminiReply(trimmed, history, (partialText) => {
          if (!receivedFirstToken && partialText.trim()) {
            receivedFirstToken = true;
            logTiming("response:first-token", requestStartedAt);
            setIsThinking(false);
            logTiming("thinking:off", requestStartedAt);
          }

          updateMessage(assistantMessage.id, partialText);
        });

        setIsThinking(false);
        logTiming("response:complete", requestStartedAt);

        if (!reply) {
          throw new Error("Empty model response.");
        }

        updateMessage(assistantMessage.id, reply);
        appendConversationTurn({ role: "samantha", text: reply });
        logTiming("speech:start", requestStartedAt);
        await speakText(reply);
        return;
      } catch {
        setIsThinking(false);
        logTiming("request:error", requestStartedAt);

        const bestMatch = findBestQa(trimmed, qas);

        if (bestMatch) {
          updateMessage(assistantMessage.id, bestMatch.a);
          appendConversationTurn({ role: "samantha", text: bestMatch.a });
          await playAudio(`/audio/samantha/${bestMatch.f}.ogg`);
          return;
        }

        updateMessage(assistantMessage.id, "I don't know.");
        appendConversationTurn({ role: "samantha", text: "I don't know." });
        await speakText("I don't know.");
      }
    });
  };

  queueResponseRef.current = queueResponse;

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechAvailable(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      let finalTranscript = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];

        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        }
      }

      if (finalTranscript.trim()) {
        queueResponseRef.current(finalTranscript);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;

      try {
        recognition.stop();
      } catch {}

      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }

      stopVoiceTracking();
    };
  }, []);

  useEffect(() => {
    if (
      phase === "ready" &&
      !speechAvailable &&
      !hasShownSpeechFallbackRef.current
    ) {
      hasShownSpeechFallbackRef.current = true;
      startTransition(() => {
        setMessages((current) => [
          ...current.slice(-4),
          createMessage("system", "Voice input requires a Chromium-based browser."),
        ]);
      });
    }
  }, [phase, speechAvailable]);

  const handleInitialize = async () => {
    if (phase !== "idle") {
      return;
    }

    setPhase("booting");
    setBootError(null);
    setBootProgress(0);
    setIsHelloPlaying(true);

    try {
      await playAudio("/audio/hello.ogg", {
        onProgress: (progress) => {
          setBootProgress(progress);
        },
      });
    } catch {
      setBootError("Audio playback was blocked, but Samantha is still available.");
    }

    setIsHelloPlaying(false);
    setIsCollapsing(true);
    await delay(shouldReduceMotion ? 160 : 960);
    setPhase("ready");
  };

  const handleToggleMic = () => {
    if (!speechAvailable || !recognitionRef.current || phase !== "ready") {
      return;
    }

    try {
      if (isListening) {
        recognitionRef.current.stop();
      } else {
        recognitionRef.current.start();
      }
    } catch {}
  };

  const mode = isSpeaking
    ? "speaking"
    : isThinking
      ? "thinking"
      : isListening
        ? "listening"
        : "idle";
  const visibleMessages = messages.slice(-3);
  const showBootLoader = phase === "booting" && isHelloPlaying;
  const ringActivationProgress =
    phase === "booting" ? bootProgress : phase === "ready" || isCollapsing ? 1 : null;

  return (
    <MotionConfig reducedMotion="user">
      <main className={`immersive-shell immersive-shell--${phase}`}>
        <TopologyRing
          active={phase !== "idle"}
          activationProgress={ringActivationProgress}
          activationUntwistThreshold={RING_UNTWIST_THRESHOLD}
          activationMaxSpinSpeed={RING_MAX_SPIN_SPEED}
          mode={mode}
          voiceLevelRef={voiceLevelRef}
          reducedMotion={shouldReduceMotion}
        />
        <div className="immersive-frame" aria-hidden="true" />

        <AnimatePresence initial={false}>
          {showBootLoader ? (
            <motion.section
              key="boot-loader"
              className="boot-loader is-visible"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0.14 : 0.24 }}
            >
              <div className="boot-loader__track" aria-hidden="true">
                <span
                  className="boot-loader__fill"
                  style={{ transform: `scaleX(${Math.max(bootProgress, 0.06)})` }}
                />
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {phase === "idle" ? (
            <motion.section
              key="brand-stack"
              className="brand-stack is-visible"
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                transition: {
                  duration: shouldReduceMotion ? 0.12 : 0.42,
                  ease: ENTRANCE_EASE,
                  delayChildren: shouldReduceMotion ? 0 : 0.04,
                  staggerChildren: shouldReduceMotion ? 0 : 0.05,
                },
              }}
              exit={{
                opacity: 0,
                transition: {
                  duration: shouldReduceMotion ? 0.12 : 0.28,
                  ease: EXIT_EASE,
                },
              }}
            >
              <motion.p
                className="brand-stack__welcome"
                initial={{ opacity: 0, filter: "blur(8px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, filter: "blur(8px)" }}
                transition={{ duration: shouldReduceMotion ? 0.1 : 0.3 }}
              >
                Welcome to Element Software&apos;s
              </motion.p>
              <motion.h1
                className="brand-stack__title"
                initial={{ opacity: 0, filter: "blur(12px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, filter: "blur(10px)" }}
                transition={{ duration: shouldReduceMotion ? 0.1 : 0.36 }}
              >
                OS<span>1</span>
              </motion.h1>
              <motion.p
                className="brand-stack__subtitle"
                initial={{ opacity: 0, filter: "blur(8px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, filter: "blur(8px)" }}
                transition={{ duration: shouldReduceMotion ? 0.1 : 0.28 }}
              >
                OPERATING SYSTEM
              </motion.p>
              {bootError ? (
                <motion.p
                  className="brand-stack__error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: shouldReduceMotion ? 0.1 : 0.22 }}
                >
                  {bootError}
                </motion.p>
              ) : null}
            </motion.section>
          ) : null}
        </AnimatePresence>

        <section
          className={`dialogue-space ${phase === "ready" && messages.length > 1 ? "is-live" : ""}`}
          aria-live="polite"
        >
          <AnimatePresence initial={false}>
            {visibleMessages.map((message, index) => {
              const depth = visibleMessages.length - index;

              return (
                <motion.article
                  key={message.id}
                  className={`dialogue-fragment dialogue-fragment--${message.role}`}
                  style={
                    {
                      "--depth": depth,
                    } as CSSProperties
                  }
                  initial={{
                    opacity: 0,
                    filter: shouldReduceMotion ? "none" : "blur(14px)",
                  }}
                  animate={{
                    opacity: 1,
                    filter: "blur(0px)",
                  }}
                  exit={{
                    opacity: 0,
                    filter: shouldReduceMotion ? "none" : "blur(10px)",
                  }}
                  transition={{
                    duration: shouldReduceMotion ? 0.12 : 0.3,
                    ease: ENTRANCE_EASE,
                  }}
                >
                  <span className="dialogue-fragment__role">
                    {message.role === "samantha"
                      ? "Samantha"
                      : message.role === "user"
                        ? "You"
                        : "System"}
                  </span>
                  <div className="dialogue-fragment__content">
                    <MessageBubbleContent message={message} />
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </section>

        <form
          className={`floating-composer ${phase === "ready" ? "is-live" : ""}`}
          onSubmit={(event) => {
            event.preventDefault();
            queueResponse(inputValue);
          }}
        >
          <label className="floating-composer__field">
            <input
              className="floating-composer__input"
              type="text"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder={phase === "ready" ? "Say something..." : "Tap anywhere to initialize"}
              autoComplete="off"
              disabled={phase !== "ready"}
            />
          </label>

          <button
            type="button"
            className={`floating-composer__mic ${isListening ? "is-active" : ""}`}
            onClick={handleToggleMic}
            disabled={phase !== "ready" || !speechAvailable}
            aria-label="Toggle microphone"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
              <path d="M19 11a7 7 0 0 1-14 0" />
              <path d="M12 18v3" />
            </svg>
          </button>

          <button
            type="submit"
            className="floating-composer__send"
            disabled={phase !== "ready" || !inputValue.trim()}
          >
            Send
          </button>
        </form>

        <button
          type="button"
          className={`immersive-trigger ${phase === "idle" ? "" : "is-hidden"}`}
          onClick={handleInitialize}
          aria-label="Initialize OS1"
        >
          <span className="immersive-trigger__label">Tap anywhere to initialize</span>
        </button>
      </main>
    </MotionConfig>
  );
}
