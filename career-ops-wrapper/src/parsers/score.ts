const SCORE_PATTERN = /^\s*(\d+(?:\.\d+)?)\s*\/\s*5\s*$/;

/** Maps a Career Ops `x/5` score to the contract's 0–100 range, rounded to one decimal. */
export function parseScoreToPercent(text: string | undefined): number | null {
  const match = text?.replace(/\*/g, "").match(SCORE_PATTERN);
  if (!match?.[1]) {
    return null;
  }

  const score = Number(match[1]);
  if (!Number.isFinite(score) || score < 0 || score > 5) {
    return null;
  }

  return Math.round(score * 20 * 10) / 10;
}
