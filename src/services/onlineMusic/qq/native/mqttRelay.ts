import { createMqttListenOver, type MqttConnect, type QrEvent, type QrEventListener } from '@yakult-green-tea/qq-music-api/mqtt';
import type { QqQrRelay } from '@yakult-green-tea/qq-music-api/serverless';

// src/services/onlineMusic/qq/native/mqttRelay.ts — 复用源码 MQTT codec，在应用内持有扫码订阅。
export const nativeMqttConnect: MqttConnect = (url, protocol, handlers) => new Promise((resolve, reject) => {
    const socket = new WebSocket(url, protocol);
    socket.binaryType = 'arraybuffer';
    let opened = false;
    const timer = setTimeout(() => { socket.close(); reject(new Error('MQTT handshake timeout')); }, 20_000);
    socket.addEventListener('open', () => {
        opened = true;
        clearTimeout(timer);
        resolve({ send: data => socket.send(Uint8Array.from(data).buffer), close: () => socket.close() });
    }, { once: true });
    socket.addEventListener('message', event => handlers.message(event.data));
    socket.addEventListener('close', () => {
        clearTimeout(timer);
        if (opened) handlers.close();
        else reject(new Error('MQTT closed before opening'));
    });
    socket.addEventListener('error', () => {
        clearTimeout(timer);
        const error = new Error('MQTT WebSocket error');
        if (opened) handlers.error(error); else reject(error);
    });
});

type Channel = { image: string; events: QrEvent[]; listener: QrEventListener; ready: Promise<void>; waiters: Set<() => void>; };
export const createNativeQqRelay = (connect: MqttConnect = nativeMqttConnect): QqQrRelay => {
    const channels = new Map<string, Channel>();
    const close = async (id: string) => {
        const channel = channels.get(id);
        if (!channel) return;
        channels.delete(id);
        channel.listener.close();
        for (const wake of channel.waiters) wake();
    };
    return {
        open: async (id, image, ttlMs) => {
            const existing = channels.get(id);
            if (existing) return existing.ready;
            // 登录界面只需要一个扫码连接；换码时关闭上一个。
            for (const previousId of [...channels.keys()]) await close(previousId);
            const events: QrEvent[] = [];
            const waiters = new Set<() => void>();
            const listener = createMqttListenOver(connect)(id, event => {
                events.push(event);
                if (event.type !== 'waiting') for (const wake of waiters) wake();
            }, Math.min(Math.max(ttlMs, 1), 180_000));
            const channel = { image, events, listener, ready: listener.ready, waiters };
            channels.set(id, channel);
            void listener.done.catch(() => {
                events.push({ type: 'loginFailed', payload: null });
                for (const wake of waiters) wake();
            });
            try { await channel.ready; } catch (error) { await close(id); throw error; }
        },
        image: async id => channels.get(id)?.image ?? '',
        // 每次返回完整事件序列：原协议在每次轮询时会重建 waiting 状态。
        poll: async (id, budgetMs) => {
            const channel = channels.get(id);
            if (!channel) return [{ type: 'timeout', payload: null }];
            if (!channel.events.some(event => event.type !== 'waiting')) await new Promise<void>(resolve => {
                const done = () => { clearTimeout(timer); channel.waiters.delete(done); resolve(); };
                const timer = setTimeout(done, Math.min(Math.max(budgetMs, 0), 20_000));
                channel.waiters.add(done);
            });
            return [...channel.events];
        },
        close,
    };
};
