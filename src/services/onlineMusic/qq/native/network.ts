import { registerPlugin } from '@capacitor/core';
import { Buffer } from 'buffer';
import { hasNativeQqBackend } from './capabilities';

// src/services/onlineMusic/qq/native/network.ts — 向源码中的 fetch 接口提供 iOS HTTP、Cookie 和手动重定向能力。
interface NativeResponse { status: number; headers: Record<string, string>; cookies: string[]; body: string; }
interface FoliaNetworkPlugin {
    request(options: { id: string; url: string; method: string; headers: Record<string, string>; body?: string; followRedirects: boolean }): Promise<NativeResponse>;
    cancel(options: { id: string }): Promise<void>;
    sessionSecret(): Promise<{ secret: string }>;
    probeConfig(): Promise<{ enabled: boolean }>;
    probeResult(options: { result: Record<string, unknown> }): Promise<void>;
}
export const FoliaNetwork = registerPlugin<FoliaNetworkPlugin>('FoliaNetwork');
let installed = false;
let counter = 0;
const qqHost = (host: string): boolean => ['qq.com', 'tencentmusic.com', 'gtimg.cn', 'qpic.cn'].some(domain => host === domain || host.endsWith('.' + domain));

export const nativeQqFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    if (request.signal.aborted) throw request.signal.reason;
    const id = 'qq-' + (++counter);
    const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : Buffer.from(await request.arrayBuffer()).toString('base64');
    let onAbort: () => void = () => undefined;
    const abort = new Promise<never>((_, reject) => {
        onAbort = () => {
            void FoliaNetwork.cancel({ id }).catch(() => undefined);
            reject(request.signal.reason ?? new DOMException('Aborted', 'AbortError'));
        };
        request.signal.addEventListener('abort', onAbort, { once: true });
    });
    try {
        if (request.signal.aborted) throw request.signal.reason;
        const data = await Promise.race([abort, FoliaNetwork.request({
            id, url: request.url, method: request.method, headers: Object.fromEntries(request.headers), body,
            followRedirects: request.redirect === 'follow',
        })]);
        const empty = request.method === 'HEAD' || [204, 205, 304].includes(data.status);
        const response = new Response(empty ? null : Uint8Array.from(Buffer.from(data.body, 'base64')), {
            status: data.status, headers: data.headers,
        });
        Object.defineProperty(response.headers, 'getSetCookie', { value: () => [...data.cookies] });
        Object.defineProperty(response, 'url', { value: request.url });
        return response;
    } finally { request.signal.removeEventListener('abort', onAbort); }
};

// 补足早期 WKWebView 的 AbortSignal 标准接口，QQ 源码用它限制每次请求时长。
export const installAbortSignalCompatibility = (): void => {
    if (!AbortSignal.timeout) Object.defineProperty(AbortSignal, 'timeout', { value: (ms: number) => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), ms);
        return controller.signal;
    } });
    if (!AbortSignal.any) Object.defineProperty(AbortSignal, 'any', { value: (signals: AbortSignal[]) => {
        const controller = new AbortController();
        const subscriptions: Array<() => void> = [];
        const abort = (signal: AbortSignal) => { controller.abort(signal.reason); subscriptions.forEach(remove => remove()); };
        for (const signal of signals) {
            if (signal.aborted) { abort(signal); break; }
            const listener = () => abort(signal);
            signal.addEventListener('abort', listener, { once: true });
            subscriptions.push(() => signal.removeEventListener('abort', listener));
        }
        return controller.signal;
    } });
};

export const installNativeQqNetworking = (): void => {
    if (installed || !hasNativeQqBackend()) return;
    installed = true;
    installAbortSignalCompatibility();
    const originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = (input, init) => {
        const raw = input instanceof Request ? input.url : String(input);
        const url = new URL(raw, window.location.href);
        return qqHost(url.hostname) ? nativeQqFetch(input, init) : originalFetch(input, init);
    };
};
