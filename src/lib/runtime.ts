const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;

export const IS_STANDALONE = viteEnv?.VITE_STANDALONE === 'true';

export const LOCAL_DATA_EVENT = 'slopromet:local-data';
