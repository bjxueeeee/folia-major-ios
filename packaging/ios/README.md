# Folia iOS 0.7.22 / GitHub Actions

复用原项目 React 前端和 @yakult-green-tea/qq-music-api 3.3.3 的 serverless/MQTT 协议源码。

QQ 音乐在 iOS 内运行请求处理器，默认无需另行部署 QQ API。HTTP 请求经 FoliaNetwork 的 URLSession 桥发送，保留原协议需要的 Cookie 和手动重定向；QQ 扫码使用原 MQTT codec，并在应用内持有 WebSocket 连接。微信扫码同样经过原协议。登录加密密钥优先保存在设备 Keychain；侧载签名缺少 Keychain entitlement 时，保存在应用原生私有目录的受保护文件中，不进入 JavaScript 存储或备份。

## GitHub 云构建

Actions → Build iOS IPA → Run workflow。构建成功后下载 Folia-iOS-unsigned artifact，内含 IPA 和 SHA-256。

生成的 IPA 未签名，安装时需要使用侧载工具或自己的 Apple 证书重新签名。

## 当前验证边界

原生代码由 macOS/Xcode 编译；自动化验证覆盖 QQ 入口可用性、Cookie、请求/响应二进制传输和取消。云构建还会启动 iOS 模拟器，通过实际 WKWebView 验证插件注册、QQ/微信二维码生成及 QQ 二维码刷新。
账号实际扫码与播放仍需 iPhone 真机验证，不会在构建时使用个人账号。
网易云、酷狗继续依赖单独接入；Electron 的 ffmpeg、桌面壁纸、Node 模组入口尚未移植。锁屏持续播放及后台切歌尚未做原生音频接入。

## macOS 本地构建

Node 24+、Xcode 26+：npm ci，然后 npm run mobile:build:ipa，输出到 ios/App/output。

## v0.7.22 移植范围

基于上游正式标签 `v0.7.22`（`1f6d0f468f5bc81b23a8b40ad7ca96ccd4b1ecbe`）。合并上游 Web 能力、花火歌词样式、随机样式池及 QQ 播放/会话修复，保留 iOS QQ 网络桥、扫码刷新和侧载密钥存储兼容。汽水音乐等新增桌面专属能力不等同于已移植到 iOS。

原作者仍为 [chthollyphile](https://github.com/chthollyphile)，原项目为 [chthollyphile/folia-major](https://github.com/chthollyphile/folia-major)。本版本在当前账号 [bjxueeeee/folia-major-ios](https://github.com/bjxueeeee/folia-major-ios) 维护，保留原 AGPL-3.0 许可证。
