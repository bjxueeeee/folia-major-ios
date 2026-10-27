import { FoliaNetwork } from './network';
import { requestQq } from '../qqTransport';
import { hasNativeQqBackend } from './capabilities';

// src/services/onlineMusic/qq/native/probe.ts — 仅 CI 启动参数启用；不扫描二维码、不使用个人账号。
export const runNativeQqProbe = async (): Promise<void> => {
    if (!hasNativeQqBackend()) return;
    if (!(await FoliaNetwork.probeConfig()).enabled) return;
    const stages: Array<Record<string, unknown>> = [];
    try {
        const response = await requestQq<{ data: { channels: string[] } }>('login_channels');
        stages.push({ stage: 'channels', channels: response.data.channels });
        for (const [index, channel] of ['qq', 'wechat', 'qq'].entries()) {
            const label = index === 2 ? 'qq-refresh' : channel;
            const result = await requestQq<{ data: { unikey: string } }>('login_qr_key', { channel });
            const key = result.data.unikey;
            if (!key) throw new Error(label + ': no QR key');
            stages.push({ stage: label + '-key', ok: true });
            try {
                const image = await requestQq<{ data: { qrimg: string } }>('login_qr_create', { key });
                if (!image.data.qrimg) throw new Error(label + ': no QR image');
                stages.push({ stage: label + '-image', length: image.data.qrimg.length });
            } finally { await requestQq('login_qr_cancel', { key }); }
        }
        await FoliaNetwork.probeResult({ result: { done: true, success: true, stages } });
    } catch (error) {
        // 不记录二维码 key、图片、设备密钥或 Cookie，只输出阶段与错误说明。
        await FoliaNetwork.probeResult({ result: { done: true, success: false, stages,
            error: error instanceof Error ? error.message : String(error) } });
    }
};
