import { FoliaNetwork, installNativeQqNetworking } from './network';
import { createNativeQqRelay } from './mqttRelay';

// src/services/onlineMusic/qq/native/runtime.ts — 将原项目依赖的 QQ 协议作为应用内请求处理器运行。
let runtime: Promise<{ handleRequest: typeof import('@yakult-green-tea/qq-music-api/serverless').handleRequest; secret: string }> | null = null;
const relay = createNativeQqRelay();
const load = () => {
    runtime ??= (async () => {
        installNativeQqNetworking();
        const [protocol, { secret }] = await Promise.all([
            import('@yakult-green-tea/qq-music-api/serverless'), FoliaNetwork.sessionSecret(),
        ]);
        return { handleRequest: protocol.handleRequest, secret };
    })().catch(error => { runtime = null; throw error; });
    return runtime;
};
export const handleNativeQqRequest = async (request: Request): Promise<Response> => {
    const { handleRequest, secret } = await load();
    return handleRequest(request, { QQ_SESSION_SECRET: secret }, { qqRelay: relay });
};
