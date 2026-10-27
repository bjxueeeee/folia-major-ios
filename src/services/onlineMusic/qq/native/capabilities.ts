import { Capacitor } from '@capacitor/core';

// src/services/onlineMusic/qq/native/capabilities.ts — iOS 本地 QQ 后端的运行时能力。
export const NATIVE_QQ_API_BASE = 'https://folia-native.invalid';
export const hasNativeQqBackend = (): boolean => Capacitor.getPlatform() === 'ios';
