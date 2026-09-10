const { STATUSES, searchStatuses } = require('../../utils/http-status');
const { getShareAppMessage, getShareTimeline } = require('../../../utils/share');
const GROUPS=[{key:0,title:'全部'},{key:1,title:'1xx'},{key:2,title:'2xx'},{key:3,title:'3xx'},{key:4,title:'4xx'},{key:5,title:'5xx'}];
Page({
 data:{groups:GROUPS,group:0,query:'',statuses:STATUSES,expandedCode:null},
 onShow(){const tabBar=this.getTabBar&&this.getTabBar();if(tabBar)tabBar.setData({visible:false});},
 onShareAppMessage(){return getShareAppMessage({path:'/package-query/pages/http-status/http-status'});},onShareTimeline(){return getShareTimeline();},
 update(patch={}){const query=patch.query===undefined?this.data.query:patch.query;const group=patch.group===undefined?this.data.group:patch.group;this.setData({...patch,statuses:searchStatuses(query,group),expandedCode:null});},
 onSearch(e){this.update({query:e.detail.value});},clearSearch(){this.update({query:''});},selectGroup(e){this.update({group:Number(e.currentTarget.dataset.group)});},
 toggle(e){const code=Number(e.currentTarget.dataset.code);this.setData({expandedCode:this.data.expandedCode===code?null:code});},
 copy(e){const item=STATUSES.find(value=>value.code===Number(e.currentTarget.dataset.code));if(!item)return;wx.setClipboardData({data:`HTTP ${item.code} ${item.title}\n${item.description}\n处理建议：${item.advice}`,success:()=>wx.showToast({title:'状态码说明已复制'})});}
});
