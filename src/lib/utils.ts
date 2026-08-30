import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUsd(n: number) {
  return `$${n.toFixed(4)}`;
}

export function formatTokens(n: number) {
  return n.toLocaleString();
}

export function shortId(id: string) {
  return id.slice(0, 8);
}
