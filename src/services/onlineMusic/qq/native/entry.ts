import { installNativeQqNetworking } from './network';
import { hasNativeQqBackend } from './capabilities';

// src/services/onlineMusic/qq/native/entry.ts — iOS QQ 能力的唯一启动注册点。
export const install = (): void => {
    if (!hasNativeQqBackend()) return;
    installNativeQqNetworking();
    void import('./probe').then(({ runNativeQqProbe }) => runNativeQqProbe())
        .catch(error => console.warn('[Native QQ probe]', error));
};
