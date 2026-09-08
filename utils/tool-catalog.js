const toolCategories = [
  { key: 'all', title: '全部' },
  { key: 'content', title: '图文处理' },
  { key: 'math', title: '数学计算' },
  { key: 'query', title: '信息查询' },
  { key: 'life', title: '生活娱乐' }
];

const catalogTools = [
  { key: 'compress', title: '图片压缩', desc: '压缩图片体积，分享更轻松', directoryDesc: '调整体积与清晰度', icon: 'compress', tone: 'blue', page: '/pages/compress/compress', category: 'content', homeFeatured: true, keywords: '压缩 体积 大小 KB MB 清晰度' },
  { key: 'resize', title: '尺寸修改', desc: '修改图片尺寸，适配证件照', directoryDesc: '像素比例与证件照', icon: 'resize', tone: 'green', page: '/pages/resize/resize', category: 'content', homeFeatured: true, keywords: '尺寸 缩放 像素 证件照 一寸 二寸 裁剪' },
  { key: 'pdf', title: '图片转 PDF', desc: '多图合并成 PDF 文件', directoryDesc: '多张图片合成文档', icon: 'pdf', tone: 'orange', page: '/pages/pdf/pdf', category: 'content', homeFeatured: true, keywords: 'PDF 文档 转换 图片' },
  { key: 'watermark', title: '图片加水印', desc: '添加文字水印保护图片', directoryDesc: '添加专属文字水印', icon: 'watermark', tone: 'purple', page: '/pages/watermark/watermark', category: 'content', homeFeatured: true, keywords: '水印 文字 版权' },
  { key: 'split', title: '图片拆块', desc: '九宫格拆分，发布更有趣', directoryDesc: '九宫格与自定义拆分', icon: 'split', tone: 'purple', page: '/pages/split/split', category: 'content', homeFeatured: true, keywords: '九宫格 拆分 切图' },
  { key: 'stitch', title: '图片拼接', desc: '长图横图拼接，自定义布局', directoryDesc: '长图横图自由拼接', icon: 'stitch', tone: 'orange', page: '/pages/stitch/stitch', category: 'content', homeFeatured: true, keywords: '长图 横图 合并 拼图 网格' },
  { key: 'word-count', title: '字数统计', desc: '统计字符、字母和行数', directoryDesc: '字符字节一目了然', icon: 'word-count', tone: 'blue', page: '/pages/word-count/word-count', category: 'content', keywords: '字数 字符 字节 UTF-8 UTF-16' },
  { key: 'text-clean', title: '文本清洗', desc: '清理格式，整理出干净文本', directoryDesc: '清理格式批量替换', icon: 'text-clean', tone: 'green', page: '/pages/text-clean/text-clean', category: 'content', keywords: '文字 空格 空行 替换 正则 HTML 大小写' },
  { key: 'text-compare', title: '文字比对', desc: '对照两段文字，快速找出差异', directoryDesc: '逐字逐行查看差异', icon: 'text-compare', tone: 'orange', page: '/pages/text-compare/text-compare', category: 'content', keywords: '文本 对比 差异 diff' },
  { key: 'fancy-font', title: '花样字体', desc: '一键生成个性化文字样式', directoryDesc: '英文数字个性变换', icon: 'fancy-font', tone: 'purple', page: '/pages/fancy-font/fancy-font', category: 'content', keywords: '字体 英文 数字 文字 样式' },
  { key: 'password', title: '随机密码', desc: '自定义规则，批量生成密码', directoryDesc: '自定规则批量生成', icon: 'password', tone: 'blue', page: '/pages/password/password', category: 'life', keywords: '密码 口令 随机 生成 password' },
  { key: 'zodiac', title: '生肖查询', desc: '查询生肖、干支与五行', directoryDesc: '生肖干支生日查询', icon: 'zodiac', tone: 'orange', page: '/pages/zodiac/zodiac', category: 'query', keywords: '属相 十二生肖 生日 年份 春节 立春 天干地支 五行 年龄 本命年' },
  { key: 'chinese-convert', title: '繁简转换', desc: '简体繁体，双向本地转换', directoryDesc: '简体繁体双向转换', icon: 'chinese-convert', tone: 'green', page: '/package-text/pages/chinese-convert/chinese-convert', category: 'content', keywords: '简体 繁体 繁简 简繁 中文 汉字' },
  { key: 'qrcode', title: '二维码生成', desc: '文本网址，生成专属二维码', directoryDesc: '文本网址生成码图', icon: 'qrcode', tone: 'blue', page: '/pages/qrcode/qrcode', category: 'content', keywords: '二维码 QR code 网址 链接 生成' },
  { key: 'ip-query', title: 'IP 地址查询', desc: '查看公网地址，解析 IP 类型', directoryDesc: '公网地址本地解析', icon: 'ip-query', tone: 'blue', page: '/pages/ip-query/ip-query', category: 'query', keywords: 'IP IPv4 IPv6 网络 公网 地址 查询' },
  { key: 'decision', title: '随机决策', desc: '五种随机方式，帮你做选择', directoryDesc: '五种方式随机选择', icon: 'decision', tone: 'purple', page: '/pages/decision/decision', category: 'life', keywords: '随机 决策 选择 转盘 宫格 抽签 滚动 翻牌' },
  { key: 'coin', title: '抛硬币', desc: '正反随机，保留本次会话', directoryDesc: '正反随机连续抛掷', icon: 'coin', tone: 'orange', page: '/pages/coin/coin', category: 'life', keywords: '随机 硬币 银币 正面 反面 连抛' },
  { key: 'reaction', title: '反应测试', desc: '等待变绿，测测反应速度', directoryDesc: '点击测量反应速度', icon: 'reaction', tone: 'green', page: '/pages/reaction/reaction', category: 'life', keywords: '反应 速度 毫秒 测试 抢跳' },
  { key: 'breathing', title: '呼吸练习', desc: '跟随节律，让呼吸慢下来', directoryDesc: '跟随节律轻柔呼吸', icon: 'breathing', tone: 'green', page: '/pages/breathing/breathing', category: 'life', keywords: '呼吸 4-7-8 箱式 腹式 共振 节律 放松' },
  { key: 'timestamp', title: '时间戳转换', desc: '时间日期，秒毫秒双向换算', directoryDesc: '时间日期双向换算', icon: 'timestamp', tone: 'blue', page: '/pages/timestamp/timestamp', category: 'math', keywords: '时间戳 Unix 日期 UTC ISO 秒 毫秒 时区' },
  { key: 'radix', title: '进制转换', desc: '精确换算，查看循环与补码', directoryDesc: '精确换算循环补码', icon: 'radix', tone: 'orange', page: '/pages/radix/radix', category: 'math', keywords: '进制 二进制 八进制 十进制 十六进制 BigInt 小数 循环 补码 大小端' },
  { key: 'unit-converter', title: '单位换算', desc: '公制英制，多类单位互转', directoryDesc: '常用单位精确互转', icon: 'unit-converter', tone: 'blue', page: '/pages/unit-converter/unit-converter', category: 'math', keywords: '单位 换算 长度 面积 体积 质量 温度 时间 速度 压力 数据 能量 功率 厘米 英寸 华氏 摄氏' },
  { key: 'scientific-calculator', title: '科学计算器', desc: '函数常量，角度弧度精确算', directoryDesc: '函数常量科学计算', icon: 'scientific-calculator', tone: 'purple', page: '/pages/scientific-calculator/scientific-calculator', category: 'math', keywords: '科学 计算器 函数 三角函数 sin cos tan sqrt log ln π pi DEG RAD' },
  { key: 'percentage', title: '百分比计算', desc: '占比涨跌，五种场景快速算', directoryDesc: '占比涨跌折扣计算', icon: 'percentage', tone: 'blue', page: '/pages/percentage/percentage', category: 'math', keywords: '百分比 占比 部分 总数 涨跌幅 折扣 优惠 percent' },
  { key: 'date-calculator', title: '日期计算', desc: '日期相差，加减天数工作日', directoryDesc: '日期差加减工作日', icon: 'date-calculator', tone: 'green', page: '/pages/date-calculator/date-calculator', category: 'math', keywords: '日期 计算 相差 天数 加减 工作日 周一 周五' },
  { key: 'world-clock', title: '世界时钟', desc: '对照城市时间，轻松约会议', directoryDesc: '城市时间时差对照', icon: 'world-clock', tone: 'blue', page: '/pages/world-clock/world-clock', category: 'query', keywords: '世界 时钟 城市 时区 时差 夏令时 北京 东京 伦敦 纽约 会议 IANA' },
  { key: 'constellation', title: '星座查询', desc: '输入公历生日，快速查星座', directoryDesc: '生日查询星座元素', icon: 'constellation', tone: 'purple', page: '/pages/constellation/constellation', category: 'query', keywords: '星座 公历 生日 白羊 金牛 双子 巨蟹 狮子 处女 天秤 天蝎 射手 摩羯 水瓶 双鱼' },
  { key: 'age-query', title: '年龄查询', desc: '生日算年龄，距下次生日天数', directoryDesc: '年龄生日天数查询', icon: 'age-query', tone: 'orange', page: '/pages/age-query/age-query', category: 'query', keywords: '年龄 生日 周岁 已生活天数 下次生日 闰年 2月29日' },
  { key: 'date-info', title: '日期信息', desc: '星期周数季度，一次查清日期', directoryDesc: '星期周数季度查询', icon: 'date-info', tone: 'blue', page: '/pages/date-info/date-info', category: 'query', keywords: '日期 星期 年内序号 ISO 周 周数 季度 闰年 距今天' },
  { key: 'stopwatch', title: '秒表计时', desc: '精准计时，记录每圈用时', directoryDesc: '毫秒计时分圈记录', icon: 'stopwatch', tone: 'blue', page: '/pages/stopwatch/stopwatch', category: 'life', keywords: '秒表 计时 计次 毫秒 单圈 lap 跑步 实验 暂停' }
];

function getTool(key) {
  return catalogTools.find(tool => tool.key === key);
}

function getToolGroups(category = 'all', query = '') {
  const search = query.trim().toLowerCase();
  if (search) {
    return [{ key: 'search', title: '搜索结果', tools: catalogTools.filter(tool =>
      `${tool.title} ${tool.directoryDesc} ${tool.keywords}`.toLowerCase().includes(search)
    ) }];
  }
  return toolCategories.filter(item => item.key !== 'all' && (category === 'all' || item.key === category))
    .map(item => ({ key: item.key, title: `${item.title}工具`, tools: catalogTools.filter(tool => tool.category === item.key) }))
    .filter(group => category !== 'all' || group.tools.length);
}

module.exports = { catalogTools, toolCategories, getTool, getToolGroups };
