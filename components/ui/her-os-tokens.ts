export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const text = {
  body: "text-[var(--text-main)]",
  muted: "text-[var(--text-muted)]",
  faint: "text-[var(--text-faint)]",
  eyebrow: "text-[0.62rem] uppercase tracking-[0.16em] text-[var(--text-faint)]",
  input:
    "w-full border-0 bg-transparent px-0 pb-[0.9rem] pt-[0.55rem] text-center text-base text-[var(--text-main)] outline-none placeholder:tracking-[0.06em] placeholder:text-[var(--text-muted)] disabled:cursor-default disabled:opacity-40",
  action: "text-[0.72rem] uppercase tracking-[0.12em]",
};

const surface = {
  shell:
    "overflow-hidden text-[var(--text-main)] backdrop-blur-[22px] [backdrop-filter:saturate(125%)]",
  panel:
    "border border-[rgba(255,250,245,0.16)] bg-[linear-gradient(180deg,rgba(255,247,240,0.14),rgba(154,62,46,0.12))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_14px_36px_rgba(90,25,14,0.08)]",
  card:
    "border border-[rgba(255,247,240,0.18)] bg-[linear-gradient(180deg,rgba(255,244,236,0.18),rgba(255,223,199,0.08))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_16px_36px_rgba(92,22,13,0.09)]",
  fragment:
    "border border-[rgba(255,246,238,0.18)] bg-[rgba(255,232,209,0.14)] shadow-[0_18px_40px_rgba(92,22,13,0.08),inset_0_0_0_1px_rgba(255,246,238,0.18)]",
  fragmentAssistant:
    "border-[rgba(255,246,238,0.24)] bg-[rgba(255,239,227,0.2)] shadow-[0_20px_42px_rgba(92,22,13,0.1),inset_0_0_0_1px_rgba(255,246,238,0.24)]",
  fragmentUser:
    "border-[rgba(255,232,209,0.16)] bg-[rgba(255,208,180,0.12)] shadow-[0_16px_36px_rgba(92,22,13,0.08),inset_0_0_0_1px_rgba(255,232,209,0.16)]",
  fragmentSystem:
    "border-[rgba(255,232,209,0.1)] bg-[rgba(255,232,209,0.08)] shadow-[0_12px_28px_rgba(92,22,13,0.05),inset_0_0_0_1px_rgba(255,232,209,0.1)]",
  control:
    "border border-[rgba(255,248,242,0.2)] bg-[linear-gradient(180deg,rgba(255,248,242,0.18),rgba(255,232,209,0.06))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_30px_rgba(71,17,11,0.08)]",
  controlActive:
    "border-[rgba(255,250,245,0.28)] bg-[linear-gradient(180deg,rgba(255,249,243,0.24),rgba(255,235,214,0.12))] text-[rgba(255,244,232,1)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_14px_36px_rgba(71,17,11,0.12)]",
  chip:
    "rounded-full border-0 bg-[rgba(255,242,229,0.1)] shadow-[inset_0_0_0_1px_rgba(255,246,238,0.12)]",
  chipActive:
    "bg-[rgba(255,232,209,0.96)] text-[#7a271c] shadow-[inset_0_0_0_1px_rgba(255,246,238,0.2),0_10px_22px_rgba(71,17,11,0.12)]",
};

const layout = {
  cluster: "grid gap-2",
  floatingDock:
    "grid items-center gap-4 md:grid-cols-[minmax(0,22rem)_auto_auto] md:gap-[0.9rem]",
  dialogueStack: "grid gap-3",
};

const interaction = {
  control:
    "transition duration-150 ease-out hover:-translate-y-px disabled:cursor-default disabled:opacity-40",
  chip:
    "px-2.5 py-1.5 text-[0.72rem] capitalize tracking-[0.04em] transition duration-150 hover:-translate-y-px",
};

export const herOsTokens = {
  text,
  surface,
  layout,
  interaction,
} as const;

export const herOsRecipes = {
  panel: cn(
    surface.shell,
    surface.panel,
    "rounded-[1.1rem] px-4 py-3",
  ),
  card: cn(
    surface.shell,
    surface.card,
    "rounded-[1.4rem] px-4 py-3",
  ),
  fragment: {
    base: cn(
      surface.shell,
      surface.fragment,
      "rounded-[1.4rem] px-4 py-3",
    ),
    assistant: cn(surface.fragmentAssistant),
    user: cn(surface.fragmentUser),
    system: cn(surface.fragmentSystem),
  },
  control: {
    base: cn(
      surface.shell,
      surface.control,
      interaction.control,
      "grid place-items-center rounded-full text-[var(--text-main)]",
    ),
    active: cn(surface.controlActive),
  },
  chip: {
    base: cn(
      text.body,
      surface.chip,
      interaction.chip,
    ),
    active: cn(surface.chipActive),
  },
  composer: {
    root: cn(layout.floatingDock, "w-full"),
    field: "relative flex items-center",
    input: text.input,
    mic: cn("h-[2.9rem] w-[3.1rem]", "md:h-[2.9rem] md:w-[3.1rem]"),
    send: cn(text.action, "h-[2.9rem] px-4"),
  },
  dialogue: {
    role: text.eyebrow,
    content: "text-[clamp(1rem,3vw,1.35rem)] leading-[1.35] text-[var(--text-main)] text-balance",
  },
  devPanel: {
    root: cn(
      surface.shell,
      surface.panel,
      layout.cluster,
      "min-w-44 rounded-2xl px-4 py-3",
    ),
    eyebrow: text.eyebrow,
    hint: "text-[0.72rem] leading-[1.35] text-[var(--text-muted)]",
    toggle: "flex items-center gap-[0.55rem] text-[0.84rem] text-[var(--text-main)]",
    segmented: "flex flex-wrap gap-[0.38rem]",
    chip: "",
  },
} as const;

export const herOsClassNames = {
  bodyCopy: text.body,
  copyMuted: text.muted,
  copyFaint: text.faint,
  eyebrow: text.eyebrow,
  inputField: text.input,
  panelSurface: herOsRecipes.panel,
  cardSurface: herOsRecipes.card,
  glassButton: herOsRecipes.control.base,
  glassButtonActive: herOsRecipes.control.active,
  chipButton: herOsRecipes.chip.base,
  chipButtonIdle: "",
  chipButtonActive: herOsRecipes.chip.active,
} as const;
