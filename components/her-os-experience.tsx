"use client";

import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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

const BOOT_DURATION_MS = 2300;
const THINKING_DELAY_MS = 320;

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
  const [speechAvailable, setSpeechAvailable] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

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
  const queueResponseRef = useRef<(question: string) => void>(() => {});

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const appendMessage = (role: Message["role"], text: string) => {
    startTransition(() => {
      setMessages((current) => [...current.slice(-4), createMessage(role, text)]);
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

  const queueResponse = (question: string) => {
    const trimmed = question.trim();

    if (!trimmed || phase !== "ready") {
      return;
    }

    appendMessage("user", trimmed);
    setInputValue("");

    queuedResponsesRef.current = queuedResponsesRef.current.then(async () => {
      await delay(THINKING_DELAY_MS);

      const bestMatch = findBestQa(trimmed, qas);

      if (bestMatch) {
        appendMessage("samantha", bestMatch.a);
        await playAudio(`/audio/samantha/${bestMatch.f}.ogg`);
        return;
      }

      appendMessage("samantha", "I don't know.");
      const fallbackIndex = Math.floor(Math.random() * 3) + 1;
      await playAudio(`/audio/samantha/e${fallbackIndex}.ogg`);
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
    await delay(BOOT_DURATION_MS);
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

  const mode = isSpeaking ? "speaking" : isListening ? "listening" : "idle";
  const visibleMessages = messages.slice(-3);

  return (
    <main className={`immersive-shell immersive-shell--${phase}`}>
      <TopologyRing
        active={isCollapsing}
        mode={mode}
        voiceLevelRef={voiceLevelRef}
      />
      <div className="immersive-frame" aria-hidden="true" />

      <section
        className={`boot-loader ${phase === "booting" && isHelloPlaying ? "is-visible" : ""}`}
      >
        <div className="boot-loader__track" aria-hidden="true">
          <span
            className="boot-loader__fill"
            style={{ transform: `scaleX(${Math.max(bootProgress, 0.06)})` }}
          />
        </div>
      </section>

      <section className={`brand-stack ${phase === "idle" ? "is-visible" : ""}`}>
        <p className="brand-stack__welcome">Welcome to Element Software&apos;s</p>
        <h1 className="brand-stack__title">
          OS<span>1</span>
        </h1>
        <p className="brand-stack__subtitle">OPERATING SYSTEM</p>
        {bootError ? <p className="brand-stack__error">{bootError}</p> : null}
      </section>

      <section
        className={`dialogue-space ${phase === "ready" && messages.length > 1 ? "is-live" : ""}`}
        aria-live="polite"
      >
        {visibleMessages.map((message, index) => {
          const depth = visibleMessages.length - index;

          return (
            <article
              key={message.id}
              className={`dialogue-fragment dialogue-fragment--${message.role}`}
              style={
                {
                  "--depth": depth,
                } as CSSProperties
              }
            >
              <span className="dialogue-fragment__role">
                {message.role === "samantha"
                  ? "Samantha"
                  : message.role === "user"
                    ? "You"
                    : "System"}
              </span>
              <p>{message.text}</p>
            </article>
          );
        })}
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
  );
}
