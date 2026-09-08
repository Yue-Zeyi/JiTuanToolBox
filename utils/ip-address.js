const ipaddr = require('./vendor/ipaddr');
const LABELS = {
  unicast: '普通单播地址', private: '私有地址', loopback: '回环地址', linkLocal: '链路本地地址',
  carrierGradeNat: '运营商共享地址', multicast: '组播地址', broadcast: '广播地址',
  unspecified: '未指定 / 本网络地址', reserved: '保留地址', documentation: '文档示例地址',
  uniqueLocal: 'IPv6 唯一本地地址', ipv4Mapped: 'IPv4 映射地址', benchmarking: '基准测试地址',
  as112: 'AS112 服务地址', amt: '自动组播隧道地址', rfc6052: 'IPv4/IPv6 转换地址',
  rfc6145: 'IPv4/IPv6 转换地址', rfc7954: 'IPv6 协议分配地址', rfc4193: 'IPv6 本地地址',
  '6to4': '6to4 过渡地址', teredo: 'Teredo 过渡地址', orchid2: 'ORCHIDv2 标识地址',
  discard: '丢弃专用地址'
};

function addressRange(address) {
  if (address.kind() === 'ipv4' && ['192.0.2.0/24', '198.51.100.0/24', '203.0.113.0/24'].some(cidr => address.match(ipaddr.parseCIDR(cidr)))) return 'documentation';
  if (address.kind() === 'ipv6' && address.match(ipaddr.parseCIDR('2001:db8::/32'))) return 'documentation';
  return address.range();
}

function analyzeAddress(value) {
  const input = typeof value === 'string' ? value.trim() : '';
  if (!input || input.length > 45 || /[\s/%\[\]]/.test(input)) throw new Error('请输入有效的 IPv4 或 IPv6 地址，不含端口、网址或网段');
  const isV6 = input.includes(':');
  const dotted = isV6 ? input.slice(input.lastIndexOf(':') + 1) : input;
  if ((!isV6 || input.includes('.')) && (!ipaddr.IPv4.isValidFourPartDecimal(dotted) || dotted.split('.').some(part => part.length > 1 && part[0] === '0'))) throw new Error('IPv4 须为四段十进制数字，每段 0–255');
  if (!ipaddr.isValid(input)) throw new Error('IP 地址格式不正确');
  const address = ipaddr.parse(input);
  if (isV6 && address.kind() !== 'ipv6') throw new Error('IPv6 地址格式不正确');
  const range = addressRange(address);
  const bytes = address.toByteArray();
  const mapped = address.kind() === 'ipv6' && address.isIPv4MappedAddress() ? address.toIPv4Address() : null;
  return {
    normalized: address.toString(), version: address.kind() === 'ipv4' ? 'IPv4' : 'IPv6',
    expanded: address.kind() === 'ipv6' ? address.parts.map(part => part.toString(16).padStart(4, '0')).join(':') : address.toString(),
    range, rangeLabel: LABELS[range] || '特殊用途地址',
    hex: bytes.map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(' '),
    bits: bytes.length * 8,
    mappedIPv4: mapped ? mapped.toString() : '', mappedRange: mapped ? addressRange(mapped) : '',
    mappedRangeLabel: mapped ? LABELS[addressRange(mapped)] || '特殊用途地址' : ''
  };
}

module.exports = { analyzeAddress };
