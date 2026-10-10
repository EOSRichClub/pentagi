import { ProviderType } from '@/graphql/types';

export interface Provider {
    name: string;
    type: ProviderType;
}

export const getProviderDisplayName = (provider: Provider): string => {
    return provider.name;
};

export const isProviderValid = (provider: Provider, providers: Provider[]): boolean => {
    return providers.some((p) => p.name === provider.name && p.type === provider.type);
};

export const findProvider = (provider: Provider, providers: Provider[]): Provider | undefined => {
    return providers.find((p) => p.name === provider.name && p.type === provider.type);
};

export const findProviderByName = (providerName: string, providers: Provider[]): Provider | undefined => {
    return providers.find((provider) => provider.name === providerName);
};

export const sortProviders = (providers: Provider[]): Provider[] => {
    return [...providers].sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * The backend exposes built-in providers named after their types (for example
 * `openai`, `glm`, or `custom`) alongside the user's saved presets. Those
 * built-ins cannot be managed from the settings table, which makes the picker
 * look inconsistent. As soon as the user has at least one manageable preset,
 * show only manageable presets. Keep built-ins solely as a first-run fallback
 * for accounts that have not created any presets yet.
 */
export const hideShadowedDefaultProviders = (providers: Provider[]): Provider[] => {
    const hasUserDefinedProvider = providers.some((provider) => provider.name !== provider.type);

    return hasUserDefinedProvider ? providers.filter((provider) => provider.name !== provider.type) : providers;
};
