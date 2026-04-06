module.exports = function parseDuration(input) {
  if (!input || typeof input !== "string") return null;

  const match = input.trim().toLowerCase().match(/^(\d+)(s|m|h|d|w)$/);
  if (!match) return null;

  const value = Number.parseInt(match[1], 10);
  const unit = match[2];

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
};