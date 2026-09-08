const PRESETS = [
  { key: '478', title: '4-7-8 呼吸', detail: '吸气 4 · 屏息 7 · 呼气 8', inhale: 4, holdIn: 7, exhale: 8, holdOut: 0 },
  { key: 'box', title: '箱式呼吸', detail: '吸气、屏息、呼气、屏息各 4 秒', inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 },
  { key: 'abdominal', title: '腹式深呼吸', detail: '吸气 4 · 呼气 6 · 不屏息', inhale: 4, holdIn: 0, exhale: 6, holdOut: 0 },
  { key: 'resonance', title: '共振呼吸', detail: '吸气 5 · 呼气 5 · 每分钟 6 轮', inhale: 5, holdIn: 0, exhale: 5, holdOut: 0 }
];
const PHASES = [
  { key: 'inhale', title: '吸气', from: 0.58, to: 1 },
  { key: 'holdIn', title: '屏息', from: 1, to: 1 },
  { key: 'exhale', title: '呼气', from: 1, to: 0.58 },
  { key: 'holdOut', title: '屏息', from: 0.58, to: 0.58 }
];

function createPractice(settings) {
  let cycleMs = 0;
  const stages = PHASES.map(phase => {
    const seconds = Number(settings[phase.key]);
    const min = phase.key === 'inhale' || phase.key === 'exhale' ? 1 : 0;
    if (String(settings[phase.key]).trim() === '' || !Number.isInteger(seconds) || seconds < min || seconds > 30) throw new Error(`${phase.title}须为 ${min}–30 秒的整数`);
    const stage = { ...phase, seconds, start: cycleMs, end: cycleMs + seconds * 1000 };
    cycleMs = stage.end;
    return stage;
  }).filter(stage => stage.seconds > 0);
  const durationMode = settings.targetMode === 'duration';
  if (!durationMode && settings.targetMode !== 'rounds') throw new Error('请选择按时长或按轮数练习');
  const target = Number(durationMode ? settings.minutes : settings.rounds);
  const max = durationMode ? 30 : 100;
  if (!Number.isInteger(target) || target < 1 || target > max) throw new Error(durationMode ? '练习时长须为 1–30 分钟' : '练习轮数须为 1–100 轮');
  const totalMs = durationMode ? target * 60000 : target * cycleMs;
  return { stages, cycleMs, totalMs, rounds: Math.ceil(totalMs / cycleMs) };
}

function getPracticeState(plan, elapsed) {
  const elapsedMs = Math.max(0, Math.min(plan.totalMs, elapsed));
  const finished = elapsedMs >= plan.totalMs;
  const inRound = elapsedMs % plan.cycleMs;
  const stage = plan.stages.find(item => inRound >= item.start && inRound < item.end) || plan.stages[0];
  const fraction = (inRound - stage.start) / (stage.end - stage.start);
  return {
    elapsedMs, finished,
    phase: finished ? 'done' : stage.key,
    label: finished ? '练习完成' : stage.title,
    countdown: finished ? 0 : Math.ceil(Math.min(stage.end - inRound, plan.totalMs - elapsedMs) / 1000),
    scale: finished ? 0.58 : Math.round((stage.from + (stage.to - stage.from) * fraction) * 1000) / 1000,
    round: Math.min(plan.rounds, Math.floor(elapsedMs / plan.cycleMs) + 1),
    progress: Math.round(elapsedMs / plan.totalMs * 1000) / 10,
    remainingSeconds: Math.ceil((plan.totalMs - elapsedMs) / 1000)
  };
}

module.exports = { PRESETS, createPractice, getPracticeState };
