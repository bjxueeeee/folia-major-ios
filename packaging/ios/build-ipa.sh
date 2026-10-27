#!/usr/bin/env bash
# 使用 macOS/Xcode 编译真机 arm64 应用，打包待重新签名的 IPA。
set -euo pipefail
cd "$(dirname "$0")/../.."
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "IPA compilation requires macOS with Xcode." >&2
  exit 1
fi
command -v xcodebuild >/dev/null
output_dir="$PWD/ios/App/output"
mkdir -p "$output_dir"
archive_path="$output_dir/Folia.xcarchive"
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$archive_path" -derivedDataPath ios/DerivedData \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY= \
  archive
app_path="$archive_path/Products/Applications/App.app"
test -f "$app_path/Info.plist"
test -f "$app_path/App"
lipo -info "$app_path/App"
# 临时目录避免把上一次的打包内容混入当前 IPA。
staging_dir="$(mktemp -d "$output_dir/payload.XXXXXX")"
trap 'rm -rf "$staging_dir"' EXIT
mkdir -p "$staging_dir/Payload"
ditto "$app_path" "$staging_dir/Payload/Folia.app"
version="$(node -p "require('./package.json').version")"
ipa_path="$output_dir/Folia-$version-ios-unsigned.ipa"
ditto -c -k --sequesterRsrc --keepParent "$staging_dir/Payload" "$ipa_path"
unzip -t "$ipa_path"
shasum -a 256 "$ipa_path" > "$ipa_path.sha256"
echo "Created $ipa_path"
