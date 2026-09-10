const { parseUserAgent } = require('../../utils/user-agent');
const { getShareAppMessage, getShareTimeline } = require('../../../utils/share');
const DEFAULT_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
Page({
  data: { input: '', result: null, resultText: '', error: '' },
  onShow() { const tabBar=this.getTabBar&&this.getTabBar(); if(tabBar)tabBar.setData({visible:false}); },
  onShareAppMessage(){return getShareAppMessage({path:'/package-query/pages/user-agent/user-agent'});}, onShareTimeline(){return getShareTimeline();},
  onInput(e){this.setData({input:e.detail.value,result:null,resultText:'',error:''});},
  useCurrent(){this.setData({input:DEFAULT_UA,result:null,resultText:'',error:''});},
  analyze(){try{const result=parseUserAgent(this.data.input);const rows=[`浏览器：${result.browser} ${result.browserVersion}`,`操作系统：${result.os} ${result.osVersion}`,`设备：${result.device}`,`设备类型：${result.deviceType}`,`渲染引擎：${result.engine}`,`架构：${result.architecture}`];if(result.isBot)rows.push('识别：自动化程序或爬虫特征');this.setData({result,resultText:rows.join('\n'),error:''});}catch(error){const message=error.message||'解析失败';this.setData({result:null,resultText:'',error:message});wx.showToast({title:message,icon:'none'});}},
  copyResult(){if(!this.data.resultText)return;wx.setClipboardData({data:this.data.resultText,success:()=>wx.showToast({title:'结果已复制'})});},
  clearAll(){this.setData({input:'',result:null,resultText:'',error:''});}
});
