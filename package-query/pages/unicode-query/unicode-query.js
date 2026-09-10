const { analyzeUnicode } = require('../../utils/unicode-query');
const { getShareAppMessage, getShareTimeline } = require('../../../utils/share');
Page({
 data:{input:'',characterCount:0,rows:[],error:''},onShow(){const t=this.getTabBar&&this.getTabBar();if(t)t.setData({visible:false});},
 onShareAppMessage(){return getShareAppMessage({path:'/package-query/pages/unicode-query/unicode-query'});},onShareTimeline(){return getShareTimeline();},
 onInput(e){const input=e.detail.value;this.setData({input,characterCount:Array.from(input).length,rows:[],error:''});},
 analyze(){try{this.setData({rows:analyzeUnicode(this.data.input),error:''});}catch(error){const message=error.message||'查询失败';this.setData({rows:[],error:message});wx.showToast({title:message,icon:'none'});}},
 copyItem(e){const row=this.data.rows[Number(e.currentTarget.dataset.index)];if(!row)return;wx.setClipboardData({data:`${row.character}\n${row.codePoint}\n十进制：${row.decimal}\nUTF-8：${row.utf8}\nUTF-16：${row.utf16}\nHTML：${row.html}\n转义：${row.escape}`,success:()=>wx.showToast({title:'字符信息已复制'})});},
 copyAll(){if(!this.data.rows.length)return;wx.setClipboardData({data:this.data.rows.map(row=>`${row.display}\t${row.codePoint}\tUTF-8 ${row.utf8}\tUTF-16 ${row.utf16}`).join('\n'),success:()=>wx.showToast({title:'全部结果已复制'})});},
 clearAll(){this.setData({input:'',characterCount:0,rows:[],error:''});}
});
