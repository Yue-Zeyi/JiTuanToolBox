// 生产环境建议通过构建脚本注入，不要把带权限的密钥放进小程序包。
module.exports = {
  analyticsEnabled: false,
  cloudEnvId: 'cloud1-d2gzwmpwtfed214d2',
  popularityFunctionName: 'tool-popularity',
  securityFunctionName: 'media-security',
  securityPollIntervalMs: 1500,
  securityTimeoutMs: 120000,
  // 升级隐私授权版本，避免真机继续复用旧版本的同意状态。
  privacyVersion: '2026-09-08-v3'
};
