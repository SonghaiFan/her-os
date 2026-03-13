"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn, herOsRecipes } from "@/components/ui/her-os-tokens";

export function HerOsPanel({
  className,
  ...props
}: ComponentPropsWithoutRef<"section">) {
  return <section className={cn(herOsRecipes.panel, className)} {...props} />;
}

export function HerOsCard({
  className,
  ...props
}: ComponentPropsWithoutRef<"article">) {
  return <article className={cn(herOsRecipes.card, className)} {...props} />;
}

export function HerOsEyebrow({ className, ...props }: ComponentPropsWithoutRef<"span">) {
  return <span className={cn(herOsRecipes.devPanel.eyebrow, className)} {...props} />;
}

export function HerOsControl({
  active = false,
  className,
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  active?: boolean;
}) {
  return (
    <button
      className={cn(
        herOsRecipes.control.base,
        active && herOsRecipes.control.active,
        className,
      )}
      type="button"
      {...props}
    />
  );
}

export function HerOsChip({
  active = false,
  className,
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  active?: boolean;
}) {
  return (
    <button
      className={cn(
        herOsRecipes.chip.base,
        active && herOsRecipes.chip.active,
        className,
      )}
      type="button"
      {...props}
    />
  );
}

export function HerOsComposerField({
  className,
  ...props
}: ComponentPropsWithoutRef<"label">) {
  return <label className={cn(herOsRecipes.composer.field, className)} {...props} />;
}

export function HerOsComposerInput({
  className,
  ...props
}: ComponentPropsWithoutRef<"input">) {
  return <input className={cn(herOsRecipes.composer.input, className)} {...props} />;
}

export function HerOsDialogueFragment({
  tone = "assistant",
  className,
  role,
  children,
  ...props
}: ComponentPropsWithoutRef<"article"> & {
  children: ReactNode;
  role?: ReactNode;
  tone?: "assistant" | "user" | "system";
}) {
  const toneClass =
    tone === "user"
      ? herOsRecipes.fragment.user
      : tone === "system"
        ? herOsRecipes.fragment.system
        : herOsRecipes.fragment.assistant;

  return (
    <article className={cn(herOsRecipes.fragment.base, toneClass, className)} {...props}>
      {role ? <span className={herOsRecipes.dialogue.role}>{role}</span> : null}
      <div className={herOsRecipes.dialogue.content}>{children}</div>
    </article>
  );
}
