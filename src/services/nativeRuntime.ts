// src/services/nativeRuntime.ts — 按平台目录发现原生能力，入口不依赖具体音乐平台。
type NativeEntry = { install: () => void };
const entries = import.meta.glob<NativeEntry>('./onlineMusic/*/native/entry.ts', { eager: true });
export const installNativeRuntimes = (): void => {
    for (const entry of Object.values(entries)) entry.install();
};
