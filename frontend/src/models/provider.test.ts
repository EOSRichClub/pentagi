import { describe, expect, it } from 'vitest';

import { ProviderType } from '@/graphql/types';

import { hideShadowedDefaultProviders } from './provider';

describe('hideShadowedDefaultProviders', () => {
    it('shows only manageable presets once the user has created one', () => {
        const result = hideShadowedDefaultProviders([
            { name: 'openai', type: ProviderType.Openai },
            { name: '硅基流动 GLM', type: ProviderType.Openai },
            { name: 'glm', type: ProviderType.Glm },
            { name: 'deepseek', type: ProviderType.Deepseek },
            { name: 'GLM 5.3', type: ProviderType.Glm },
        ]);

        expect(result.map((provider) => provider.name)).toEqual(['硅基流动 GLM', 'GLM 5.3']);
    });

    it('keeps the built-in provider as a fallback when no named preset exists', () => {
        const result = hideShadowedDefaultProviders([
            { name: 'openai', type: ProviderType.Openai },
            { name: 'glm', type: ProviderType.Glm },
        ]);

        expect(result.map((provider) => provider.name)).toEqual(['openai', 'glm']);
    });

    it('does not hide named presets from the same type', () => {
        const result = hideShadowedDefaultProviders([
            { name: 'OpenAI 稳定版', type: ProviderType.Openai },
            { name: 'OpenAI 推理版', type: ProviderType.Openai },
            { name: 'openai', type: ProviderType.Openai },
        ]);

        expect(result.map((provider) => provider.name)).toEqual(['OpenAI 稳定版', 'OpenAI 推理版']);
    });
});
