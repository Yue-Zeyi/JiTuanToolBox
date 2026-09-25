const runtime = require('../config/runtime');

const jutuikePubId = String(runtime.jutuikePubId || '').trim();
const encodedJutuikePubId = encodeURIComponent(jutuikePubId);
const movieTicketSid = String(runtime.movieTicketSid || '').replace(/[^a-z0-9]/gi, '').slice(0, 30);
const pluginBridgePage = (packageRoot, target) => `/${packageRoot}/pages/redirect/redirect?target=${encodeURIComponent(target)}`;
const movieTicketPage = pluginBridgePage('package-movie', `plugin://jtkMovie/home?pub_id=${encodedJutuikePubId}${movieTicketSid ? `&sid=${encodeURIComponent(movieTicketSid)}` : ''}`);
const foodGroupDealPage = pluginBridgePage('package-deals', `plugin://meishi/home?pub_id=${encodedJutuikePubId}&sid=groupbuy`);
const meituanCouponPage = pluginBridgePage('package-deals', `plugin://meishi/shop?pub_id=${encodedJutuikePubId}&type=meituan&sid=meituan`);
const taobaoFlashCouponPage = pluginBridgePage('package-deals', `plugin://meishi/shop?pub_id=${encodedJutuikePubId}&type=ele&sid=taobaoflash`);
const rideDiscountPage = pluginBridgePage('package-deals', `plugin://meishi/shop?pub_id=${encodedJutuikePubId}&type=didi&sid=taxi`);
const hotelDiscountPage = pluginBridgePage('package-deals', `plugin://meishi/shop?pub_id=${encodedJutuikePubId}&type=hotel&sid=hotel`);
const shoppingCouponPage = pluginBridgePage('package-deals', `plugin://meishi/dianshang?pub_id=${encodedJutuikePubId}&source=jd,taobao,douyin,pdd`);
const brandDiningPage = pluginBridgePage('package-dining', `plugin://jtkDc/index?pub_id=${encodedJutuikePubId}&sid=branddining`);

const toolCategories = [
  { key: 'all', title: '全部' },
  { key: 'content', title: '图文处理' },
  { key: 'math', title: '数学计算' },
  { key: 'query', title: '信息查询' },
  { key: 'life', title: '生活娱乐' }
];

const catalogTools = [
  { key: 'tax-calculator', title: '个税计算器', desc: '工资个税与年度汇算快速测算', directoryDesc: '工资个税年度汇算', icon: 'tax-calculator', tone: 'blue', page: '/package-calc/pages/tax-calculator/tax-calculator', category: 'math', keywords: '个税 个人所得税 工资 税后收入 累计预扣 年度汇算 五险一金 专项附加扣除' },
  { key: 'json-format', title: 'JSON 格式化', desc: '格式压缩校验，树形查看结构', directoryDesc: '格式压缩结构校验', icon: 'json-format', tone: 'blue', page: '/pages/json-format/json-format', category: 'math', keywords: 'JSON json 格式化 美化 压缩 校验 语法 树形 缩进 大整数 开发' },
  { key: 'mortgage', title: '房贷计算器', desc: '计算房贷月供，提前还款省息', directoryDesc: '月供明细提前还款', icon: 'mortgage', tone: 'blue', page: '/pages/mortgage/mortgage', category: 'math', keywords: '房贷 贷款 计算器 月供 利息 等额本息 等额本金 提前还款 省息' },
  { key: 'bmi', title: 'BMI 计算', desc: '体重体脂估算，每日热量需求', directoryDesc: '体重体脂热量估算', icon: 'bmi', tone: 'green', page: '/pages/bmi/bmi', category: 'math', keywords: 'BMI 身高 体重 体脂率 热量 能量 理想体重 代谢 健康' },
  { key: 'compress', title: '图片压缩', desc: '压缩图片体积，分享更轻松', directoryDesc: '调整体积与清晰度', icon: 'compress', tone: 'blue', page: '/pages/compress/compress', category: 'content', homeFeatured: true, keywords: '压缩 体积 大小 KB MB 清晰度 图片太大 图片超过限制 图片变小 发不出去 降低图片大小' },
  { key: 'resize', title: '尺寸修改', desc: '修改图片尺寸，适配证件照', directoryDesc: '像素比例与证件照', icon: 'resize', tone: 'green', page: '/pages/resize/resize', category: 'content', homeFeatured: true, keywords: '尺寸 缩放 像素 证件照 一寸 二寸 裁剪 图片尺寸不对 修改宽高 改分辨率' },
  { key: 'pdf', title: '图片转 PDF', desc: '多图合并成 PDF 文件', directoryDesc: '多张图片合成文档', icon: 'pdf', tone: 'orange', page: '/pages/pdf/pdf', category: 'content', homeFeatured: true, keywords: 'PDF 文档 转换 图片 图片做成pdf 多张图片转pdf 扫描件合并 文件合并' },
  { key: 'watermark', title: '图片加水印', desc: '添加文字水印保护图片', directoryDesc: '添加专属文字水印', icon: 'watermark', tone: 'purple', page: '/pages/watermark/watermark', category: 'content', homeFeatured: true, keywords: '水印 文字 版权 图片加字 防盗图 商品图 标记图片' },
  { key: 'split', title: '图片拆块', desc: '九宫格拆分，发布更有趣', directoryDesc: '九宫格与自定义拆分', icon: 'split', tone: 'purple', page: '/pages/split/split', category: 'content', homeFeatured: true, keywords: '九宫格 拆分 切图 图片切割 长图分割 发朋友圈 九宫格图片' },
  { key: 'stitch', title: '图片拼接', desc: '长图横图拼接，自定义布局', directoryDesc: '长图横图自由拼接', icon: 'stitch', tone: 'orange', page: '/pages/stitch/stitch', category: 'content', homeFeatured: true, keywords: '长图 横图 合并 拼图 网格 图片合并 多图拼接 聊天记录拼成长图' },
  { key: 'image-format', title: '图片格式转换', desc: 'JPG、PNG 图片格式本地互转', directoryDesc: 'JPG PNG 格式互转', icon: 'image-format', tone: 'blue', page: '/pages/image-format/image-format', category: 'content', keywords: '图片 格式 转换 JPG JPEG PNG WEBP BMP JFIF JPE' },
  { key: 'image-transform', title: '图片旋转翻转', desc: '旋转角度，水平垂直镜像翻转', directoryDesc: '旋转与镜像翻转', icon: 'image-transform', tone: 'green', page: '/pages/image-transform/image-transform', category: 'content', keywords: '图片 旋转 翻转 镜像 左转 右转 水平 垂直' },
  { key: 'base64', title: 'Base64 编解码', desc: '文字与 Base64 内容双向转换', directoryDesc: 'UTF-8 Base64 双向转换', icon: 'base64', tone: 'purple', page: '/pages/base64/base64', category: 'content', keywords: 'Base64 编码 解码 UTF-8 文字 开发' },
  { key: 'url-codec', title: 'URL 编解码', desc: '网址与参数安全编码解码', directoryDesc: '网址参数编码解码', icon: 'url-codec', tone: 'orange', page: '/pages/url-codec/url-codec', category: 'content', keywords: 'URL URI 网址 链接 参数 encode decode 编码 解码' },
  { key: 'image-exif', title: '图片去 EXIF', desc: '清除拍摄设备与位置元数据', directoryDesc: '清除图片隐私元数据', icon: 'image-exif', tone: 'green', page: '/pages/image-exif/image-exif', category: 'content', keywords: '图片 EXIF 元数据 隐私 GPS 位置 拍摄设备 清除' },
  { key: 'image-picker', title: '图片取色器', desc: '点击图片提取像素颜色数值', directoryDesc: '图片取色 HEX RGB HSL', icon: 'image-picker', tone: 'purple', page: '/pages/image-picker/image-picker', category: 'content', keywords: '图片 取色器 吸管 颜色 HEX RGB HSL 像素 从图片提取颜色 色值' },
  { key: 'image-mask', title: '图片隐私遮挡', desc: '遮住截图中的敏感信息', directoryDesc: '马赛克与色块遮挡', icon: 'image-mask', tone: 'gray', page: '/pages/image-mask/image-mask', category: 'content', keywords: '图片 隐私 遮挡 马赛克 打码 敏感信息 订单截图 证件 地址 姓名 手机号 截图打码' },
  { key: 'regex-test', title: '正则表达式测试', desc: '实时验证表达式并查看匹配结果', directoryDesc: '正则匹配捕获组测试', icon: 'regex-test', tone: 'orange', page: '/pages/regex-test/regex-test', category: 'math', keywords: '正则表达式 regex regexp 匹配 捕获组 测试 开发' },
  { key: 'color-query', title: '颜色查询表', desc: '颜色数值互查，浏览常用色表', directoryDesc: 'HEX RGB HSL 颜色查询', icon: 'color-query', tone: 'orange', page: '/pages/color-query/color-query', category: 'query', keywords: '颜色 查询 色表 HEX RGB HSL CMYK 色值 配色' },
  { key: 'user-agent', title: 'User-Agent 解析', desc: '识别浏览器、系统与设备信息', directoryDesc: '浏览器系统设备识别', icon: 'user-agent', tone: 'green', page: '/package-query/pages/user-agent/user-agent', category: 'query', keywords: 'User-Agent UA 浏览器 操作系统 设备 内核 版本 解析' },
  { key: 'http-status', title: 'HTTP 状态码', desc: '查询状态码含义与处理建议', directoryDesc: '状态码含义处理建议', icon: 'http-status', tone: 'blue', page: '/package-query/pages/http-status/http-status', category: 'query', keywords: 'HTTP HTTPS 状态码 200 301 400 401 403 404 500 502 查询' },
  { key: 'unicode-query', title: 'Unicode 查询', desc: '查询字符码点与编码表示', directoryDesc: '字符码点编码查询', icon: 'unicode-query', tone: 'purple', page: '/package-query/pages/unicode-query/unicode-query', category: 'query', keywords: 'Unicode 字符 码点 UTF-8 UTF-16 HTML 实体 编码 Emoji' },
  { key: 'lunar-convert', title: '农历转换', desc: '公历农历双向转换与干支查询', directoryDesc: '公历农历干支互查', icon: 'lunar-convert', tone: 'purple', page: '/package-calendar/pages/lunar-convert/lunar-convert', category: 'query', keywords: '农历 公历 阳历 阴历 转换 闰月 干支 生肖 节气 节日' },
  { key: 'plate-query', title: '车牌号查询', desc: '校验号牌格式与省级归属信息', directoryDesc: '车牌格式归属查询', icon: 'plate-query', tone: 'blue', page: '/pages/plate-query/plate-query', category: 'query', keywords: '车牌 车牌号 查询 校验 新能源 蓝牌 绿牌 省份 归属' },
  { key: 'word-count', title: '字数统计', desc: '统计字符、字母和行数', directoryDesc: '字符字节一目了然', icon: 'word-count', tone: 'blue', page: '/pages/word-count/word-count', category: 'content', keywords: '字数 字符 字节 UTF-8 UTF-16' },
  { key: 'text-clean', title: '文本清洗', desc: '清理格式，整理出干净文本', directoryDesc: '清理格式批量替换', icon: 'text-clean', tone: 'green', page: '/pages/text-clean/text-clean', category: 'content', keywords: '文字 文本 空格 空行 替换 正则 HTML 大小写 去重 重复行 排序 编号 名单整理 列表整理' },
  { key: 'text-compare', title: '文字比对', desc: '对照两段文字，快速找出差异', directoryDesc: '逐字逐行查看差异', icon: 'text-compare', tone: 'orange', page: '/pages/text-compare/text-compare', category: 'content', keywords: '文本 对比 差异 diff' },
  { key: 'fancy-font', title: '花样字体', desc: '一键生成个性化文字样式', directoryDesc: '英文数字个性变换', icon: 'fancy-font', tone: 'purple', page: '/pages/fancy-font/fancy-font', category: 'content', keywords: '字体 英文 数字 文字 样式' },
  { key: 'password', title: '随机密码', desc: '自定义规则，批量生成密码', directoryDesc: '自定规则批量生成', icon: 'password', tone: 'blue', page: '/pages/password/password', category: 'math', keywords: '密码 口令 随机 生成 password 安全密码' },
  { key: 'expense-split', title: 'AA 分账', desc: '多人垫付，自动算清谁补给谁', directoryDesc: '聚餐旅行多人分账', icon: 'expense-split', tone: 'green', page: '/pages/expense-split/expense-split', category: 'math', keywords: 'AA 分账 分摊 聚餐 旅行 合租 垫付 谁给谁 转账 费用均摊' },
  { key: 'zodiac', title: '生肖查询', desc: '查询生肖、干支与五行', directoryDesc: '生肖干支生日查询', icon: 'zodiac', tone: 'orange', page: '/package-calendar/pages/zodiac/zodiac', category: 'query', keywords: '属相 十二生肖 生日 年份 春节 立春 天干地支 五行 年龄 本命年' },
  { key: 'chinese-convert', title: '繁简转换', desc: '简体繁体，双向本地转换', directoryDesc: '简体繁体双向转换', icon: 'chinese-convert', tone: 'green', page: '/package-text/pages/chinese-convert/chinese-convert', category: 'content', keywords: '简体 繁体 繁简 简繁 中文 汉字' },
  { key: 'qrcode', title: '二维码生成', desc: '文本网址，生成专属二维码', directoryDesc: '文本网址生成码图', icon: 'qrcode', tone: 'blue', page: '/pages/qrcode/qrcode', category: 'content', keywords: '二维码 QR code 网址 链接 生成' },
  { key: 'ip-query', title: 'IP 地址查询', desc: '查看公网地址，解析 IP 类型', directoryDesc: '公网地址本地解析', icon: 'ip-query', tone: 'blue', page: '/pages/ip-query/ip-query', category: 'query', keywords: 'IP IPv4 IPv6 网络 公网 地址 查询' },
  { key: 'decision', title: '随机决策', desc: '五种随机方式，帮你做选择', directoryDesc: '五种方式随机选择', icon: 'decision', tone: 'purple', page: '/pages/decision/decision', category: 'life', keywords: '随机 决策 选择 转盘 宫格 抽签 滚动 翻牌' },
  { key: 'coin', title: '抛硬币', desc: '正反随机，保留本次会话', directoryDesc: '正反随机连续抛掷', icon: 'coin', tone: 'orange', page: '/pages/coin/coin', category: 'life', keywords: '随机 硬币 银币 正面 反面 连抛' },
  { key: 'reaction', title: '反应测试', desc: '等待变绿，测测反应速度', directoryDesc: '点击测量反应速度', icon: 'reaction', tone: 'green', page: '/pages/reaction/reaction', category: 'life', keywords: '反应 速度 毫秒 测试 抢跳' },
  { key: 'breathing', title: '呼吸练习', desc: '跟随节律，让呼吸慢下来', directoryDesc: '跟随节律轻柔呼吸', icon: 'breathing', tone: 'green', page: '/pages/breathing/breathing', category: 'life', keywords: '呼吸 4-7-8 箱式 腹式 共振 节律 放松' },
  { key: 'marquee', title: '手持弹幕', desc: '全屏滚动展示醒目文字', directoryDesc: '全屏滚动文字展示', icon: 'marquee', tone: 'orange', page: '/package-life/pages/marquee/marquee', category: 'life', keywords: '手持弹幕 滚动字幕 LED 全屏 应援 接机 演唱会 文字' },
  { key: 'metronome', title: '节拍器', desc: '稳定节拍与重音练习辅助', directoryDesc: 'BPM 节拍重音练习', icon: 'metronome', tone: 'green', page: '/package-life/pages/metronome/metronome', category: 'life', keywords: '节拍器 BPM 拍号 重音 音乐 吉他 钢琴 练习 速度' },
  { key: 'movie-ticket', title: '特惠电影票', desc: '优惠购票，在线选座更省心', directoryDesc: '电影场次优惠选座购票', icon: 'movie-ticket', tone: 'purple', page: movieTicketPage, category: 'life', keywords: '电影票 特惠 特价 优惠 影院 影城 电影 场次 选座 购票' },
  { key: 'food-group-deal', title: '美食团购优惠', desc: '团购套餐优惠，发现附近美食', directoryDesc: '附近美食团购优惠', icon: 'food-group-deal', tone: 'orange', page: foodGroupDealPage, category: 'life', keywords: '美食 团购 优惠 附近 餐饮 套餐 餐厅' },
  { key: 'meituan-coupon', title: '美团外卖领券', desc: '点餐先领券，外卖下单更划算', directoryDesc: '美团外卖优惠领券', icon: 'meituan-coupon', tone: 'blue', page: meituanCouponPage, category: 'life', keywords: '美团 外卖 领券 优惠券 点餐 配送' },
  { key: 'taobao-flash-coupon', title: '淘宝闪购领券', desc: '闪购先领券，日常好物更省钱', directoryDesc: '淘宝闪购优惠领券', icon: 'taobao-flash-coupon', tone: 'orange', page: taobaoFlashCouponPage, category: 'life', keywords: '淘宝 闪购 饿了么 外卖 领券 优惠券' },
  { key: 'ride-discount', title: '优惠打车出行', desc: '出行优惠直达，打车更省心', directoryDesc: '打车出行优惠入口', icon: 'ride-discount', tone: 'blue', page: rideDiscountPage, category: 'life', keywords: '打车 出行 优惠 滴滴 网约车 领券' },
  { key: 'hotel-discount', title: '住酒店有优惠', desc: '住宿优惠直达，预订更轻松', directoryDesc: '酒店住宿优惠预订', icon: 'hotel-discount', tone: 'green', page: hotelDiscountPage, category: 'life', keywords: '酒店 住宿 宾馆 预订 优惠 旅行' },
  { key: 'shopping-coupon', title: '电商购物找券', desc: '多平台购物，先找券再下单', directoryDesc: '电商平台购物找券', icon: 'shopping-coupon', tone: 'purple', page: shoppingCouponPage, category: 'life', keywords: '电商 购物 找券 优惠券 京东 淘宝 抖音 拼多多' },
  { key: 'brand-dining', title: '大牌点餐优惠', desc: '连锁品牌点餐，享受专属优惠', directoryDesc: '大牌餐饮优惠点单', icon: 'brand-dining', tone: 'orange', page: brandDiningPage, category: 'life', keywords: '大牌 点餐 点菜 优惠 肯德基 麦当劳 星巴克 瑞幸 奈雪 必胜客 库迪 堂食 打包' },
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
  { key: 'stopwatch', title: '秒表计时', desc: '精准计时，记录每圈用时', directoryDesc: '毫秒计时分圈记录', icon: 'stopwatch', tone: 'blue', page: '/pages/stopwatch/stopwatch', category: 'math', keywords: '秒表 计时 计次 毫秒 单圈 lap 跑步 实验 暂停' },
  { key: 'countdown', title: '倒计时器', desc: '设定时长，到点响铃提醒', directoryDesc: '设定时长到点提醒', icon: 'countdown', tone: 'blue', page: '/pages/countdown/countdown', category: 'math', keywords: '倒计时 计时器 定时 提醒 响铃 振动 泡面 煮蛋 会议 考试 健身 间歇 时间' }
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
