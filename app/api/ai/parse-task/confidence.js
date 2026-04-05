const WEIGHTS = { title: 0.4, dateTime: 0.3, tags: 0.15, priority: 0.15 };

export function computeOverallConfidence(confidence) {
  const overall =
    (confidence.title || 0) * WEIGHTS.title +
    (confidence.dateTime || 0.5) * WEIGHTS.dateTime +
    (confidence.tags || 0.5) * WEIGHTS.tags +
    (confidence.priority || 0.5) * WEIGHTS.priority;
  return Math.round(overall * 100) / 100;
}
