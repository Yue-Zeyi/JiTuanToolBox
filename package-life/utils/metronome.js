function normalizeBpm(value) { const bpm = Math.round(Number(value)); return Number.isFinite(bpm) ? Math.max(30, Math.min(240, bpm)) : 120; }
function intervalForBpm(value) { return 60000 / normalizeBpm(value); }
function bpmFromTaps(taps) {
  const values = (Array.isArray(taps) ? taps : []).map(Number).filter(Number.isFinite);
  if (values.length < 2) return null;
  const intervals = values.slice(1).map((value, index) => value - values[index]).filter(value => value >= 250 && value <= 2000);
  if (!intervals.length) return null;
  return normalizeBpm(60000 / (intervals.reduce((sum, value) => sum + value, 0) / intervals.length));
}
module.exports = { normalizeBpm, intervalForBpm, bpmFromTaps };
