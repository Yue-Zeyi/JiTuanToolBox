const { normalizeBpm, intervalForBpm, bpmFromTaps } = require('../../utils/metronome');
const { getShareAppMessage, getShareTimeline } = require('../../../utils/share');

const SIGNATURES = [2, 3, 4, 6];

function createToneBuffer(frequency, duration = 0.055) {
  const rate = 8000; const samples = Math.floor(rate * duration); const size = 44 + samples * 2;
  const buffer = new ArrayBuffer(size); const view = new DataView(buffer);
  const write = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  write(0, 'RIFF'); view.setUint32(4, size - 8, true); write(8, 'WAVE'); write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) { const fade = Math.max(0, 1 - i / samples); const sample = Math.sin(2 * Math.PI * frequency * i / rate) * fade * 0.62; view.setInt16(44 + i * 2, Math.round(sample * 32767), true); }
  return buffer;
}

Page({
  data: { bpm: 120, swingDuration: 1, signatures: SIGNATURES, beats: 4, beatMarkers: [1, 2, 3, 4], currentBeat: 0, running: false, sound: true, vibration: false, tapCount: 0, tapHint: '跟着节奏连续点击' },
  onLoad() { this._tapTimes = []; this.prepareSounds(); },
  onShow() { const tabBar=this.getTabBar&&this.getTabBar();if(tabBar)tabBar.setData({visible:false}); },
  onHide() { this.stop(); }, onUnload() { this.stop(); this.destroySounds(); },
  onShareAppMessage(){return getShareAppMessage({path:'/package-life/pages/metronome/metronome'});},onShareTimeline(){return getShareTimeline();},
  prepareSounds() {
    if (!wx.env || !wx.env.USER_DATA_PATH || !wx.getFileSystemManager || !wx.createInnerAudioContext) return;
    const fs = wx.getFileSystemManager(); const base = wx.env.USER_DATA_PATH;
    const create = (name, frequency) => { const path = `${base}/${name}.wav`; try { fs.writeFileSync(path, createToneBuffer(frequency)); } catch (_) {} const audio = wx.createInnerAudioContext(); audio.src = path; audio.volume = 0.8; audio.obeyMuteSwitch = true; return audio; };
    this._regularAudio = create('jituan-metronome-regular', 880); this._accentAudio = create('jituan-metronome-accent', 1320);
  },
  destroySounds(){['_regularAudio','_accentAudio'].forEach(key=>{if(this[key]){this[key].destroy();this[key]=null;}});},
  changeBpm(e){this.setBpm(e.detail.value);},
  setBpm(value){const bpm=normalizeBpm(value);this.setData({bpm,swingDuration:120/bpm});if(this.data.running)this.restartSchedule();},
  adjustBpm(e){this.setBpm(this.data.bpm+Number(e.currentTarget.dataset.delta));},
  selectSignature(e){const beats=Number(e.currentTarget.dataset.beats);if(!SIGNATURES.includes(beats))return;this.setData({beats,beatMarkers:Array.from({length:beats},(_,index)=>index+1),currentBeat:0});if(this.data.running)this.restartSchedule();},
  toggleSound(e){this.setData({sound:Boolean(e.detail.value)});},toggleVibration(e){this.setData({vibration:Boolean(e.detail.value)});},
  tapTempo(){const now=Date.now();if(this._tapTimes.length&&now-this._tapTimes[this._tapTimes.length-1]>2000)this._tapTimes=[];this._tapTimes.push(now);this._tapTimes=this._tapTimes.slice(-8);const bpm=bpmFromTaps(this._tapTimes);const tapCount=this._tapTimes.length;this.setData({tapCount,tapHint:`已点击 ${tapCount} 次`});if(bpm)this.setBpm(bpm);},
  toggle(){this.data.running?this.stop():this.start();},
  start(){if(this.data.running)return;this._beatIndex=0;this._nextAt=Date.now();this.setData({running:true,currentBeat:1});this.tick();if(wx.setKeepScreenOn)wx.setKeepScreenOn({keepScreenOn:true});},
  stop(){if(this._timer){clearTimeout(this._timer);this._timer=null;}if(this.data.running)this.setData({running:false,currentBeat:0});if(wx.setKeepScreenOn)wx.setKeepScreenOn({keepScreenOn:false});},
  restartSchedule(){if(!this.data.running)return;if(this._timer)clearTimeout(this._timer);this._beatIndex=0;this._nextAt=Date.now();this.tick();},
  tick(){if(!this.data.running)return;const beat=this._beatIndex%this.data.beats+1;this.setData({currentBeat:beat});this.playBeat(beat===1);this._beatIndex+=1;this._nextAt+=intervalForBpm(this.data.bpm);const delay=Math.max(0,this._nextAt-Date.now());this._timer=setTimeout(()=>this.tick(),delay);},
  playBeat(accent){if(this.data.sound){const audio=accent?this._accentAudio:this._regularAudio;if(audio){try{audio.stop();audio.seek(0);audio.play();}catch(_){}}}if(this.data.vibration&&wx.vibrateShort)wx.vibrateShort({type:accent?'medium':'light'});}
});
