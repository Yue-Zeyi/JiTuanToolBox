const { normalizeBpm, intervalForBpm, bpmFromTaps } = require('../../utils/metronome');
const { getShareAppMessage, getShareTimeline } = require('../../../utils/share');
const { createLocalAudioPlayer } = require('../../../utils/local-audio');

const SIGNATURES = [2, 3, 4, 6];

Page({
  data: { bpm: 120, swingDuration: 1, signatures: SIGNATURES, beats: 4, beatMarkers: [1, 2, 3, 4], currentBeat: 0, running: false, sound: true, vibration: false, tapCount: 0, tapHint: '跟着节奏连续点击', audioNote: '' },
  onLoad() { this._tapTimes = []; this.prepareSounds(); },
  onShow() { const tabBar=this.getTabBar&&this.getTabBar();if(tabBar)tabBar.setData({visible:false}); },
  onHide() { this.stop(); }, onUnload() { this.stop(); this.destroySounds(); },
  onShareAppMessage(){return getShareAppMessage({path:'/package-life/pages/metronome/metronome'});},onShareTimeline(){return getShareTimeline();},
  prepareSounds() {
    const onError = () => this.setData({ audioNote: '当前设备未能播放节拍音，请检查媒体音量后重试。' });
    this._regularAudio = createLocalAudioPlayer({ src: '/assets/audio/metronome-beat.mp3', volume: 0.9, onError });
    this._accentAudio = createLocalAudioPlayer({ src: '/assets/audio/metronome-accent.mp3', volume: 1, onError });
  },
  destroySounds(){['_regularAudio','_accentAudio'].forEach(key=>{if(this[key]){this[key].destroy();this[key]=null;}});},
  changeBpm(e){this.setBpm(e.detail.value);},
  setBpm(value){const bpm=normalizeBpm(value);this.setData({bpm,swingDuration:120/bpm});if(this.data.running)this.restartSchedule();},
  adjustBpm(e){this.setBpm(this.data.bpm+Number(e.currentTarget.dataset.delta));},
  selectSignature(e){const beats=Number(e.currentTarget.dataset.beats);if(!SIGNATURES.includes(beats))return;this.setData({beats,beatMarkers:Array.from({length:beats},(_,index)=>index+1),currentBeat:0});if(this.data.running)this.restartSchedule();},
  toggleSound(e){this.setData({sound:Boolean(e.detail.value)});},toggleVibration(e){this.setData({vibration:Boolean(e.detail.value)});},
  tapTempo(){const now=Date.now();if(this._tapTimes.length&&now-this._tapTimes[this._tapTimes.length-1]>2000)this._tapTimes=[];this._tapTimes.push(now);this._tapTimes=this._tapTimes.slice(-8);const bpm=bpmFromTaps(this._tapTimes);const tapCount=this._tapTimes.length;this.setData({tapCount,tapHint:`已点击 ${tapCount} 次`});if(bpm)this.setBpm(bpm);},
  toggle(){this.data.running?this.stop():this.start();},
  start(){if(this.data.running)return;this._beatIndex=0;this._nextAt=Date.now();this.setData({running:true,currentBeat:1,audioNote:''});this.tick();if(wx.setKeepScreenOn)wx.setKeepScreenOn({keepScreenOn:true});},
  stop(){if(this._timer){clearTimeout(this._timer);this._timer=null;}if(this.data.running)this.setData({running:false,currentBeat:0});if(wx.setKeepScreenOn)wx.setKeepScreenOn({keepScreenOn:false});},
  restartSchedule(){if(!this.data.running)return;if(this._timer)clearTimeout(this._timer);this._beatIndex=0;this._nextAt=Date.now();this.tick();},
  tick(){if(!this.data.running)return;const beat=this._beatIndex%this.data.beats+1;this.setData({currentBeat:beat});this.playBeat(beat===1);this._beatIndex+=1;this._nextAt+=intervalForBpm(this.data.bpm);const delay=Math.max(0,this._nextAt-Date.now());this._timer=setTimeout(()=>this.tick(),delay);},
  playBeat(accent){if(this.data.sound){const audio=accent?this._accentAudio:this._regularAudio;if(!audio||!audio.play())this.setData({audioNote:'当前设备未能播放节拍音，请检查媒体音量后重试。'});}if(this.data.vibration&&wx.vibrateShort)wx.vibrateShort({type:accent?'medium':'light'});}
});
