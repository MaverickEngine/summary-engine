<script lang="ts">
    import type {ISettings} from '../types/SettingsInterface';
    import { slide } from 'svelte/transition';

    export let settings : ISettings;
    export let visible = false;
</script>

<div class="summaryengine-settings-container">
    {#if visible}
    <div class="summaryengine-settings" transition:slide={{ duration: 1000 }}>
        <table class="form-table" >
            <tr>
                <th scope="row">Prompt</th>
                <td>
                    <input type="text" class="regular-text" bind:value="{settings.openai_prompt}" required>
                    <p>The instruction to the model on what you'd like to generate.</p>
                </td>
            </tr>
            <tr>
                <th scope="row">OpenAPI Model</th>
                <td>
                    <select bind:value="{settings.openai_model}">
                        <option value="text-davinci-003">Text-Davinci-003</option>
                        <option value="text-davinci-002">Text-Davinci-002</option>
                        <option value="text-curie-001">Text-Curie-001</option>
                        <option value="text-babbage-001">Text-Babbage-001</option>
                        <option value="text-ada-001">Text-Ada-001</option>
                    </select>
                </td>
            </tr>
            <tr>
                <th scope="row">Max tokens</th>
                <td>
                    <input type="number" class="regular-text" min="0" max="2048" step="1" bind:value="{settings.openai_max_tokens}">
                    <p>The maximum number of tokens to generate in the completion.</p>
                </td>
            </tr>
            <tr>
                <th scope="row">Temperature</th>
                <td>
                    <input type="number" class="regular-text" min="0" max="1" step="0.1" bind:value="{settings.openai_temperature}">
                    <p>What sampling temperature to use. Higher values means the model will take more risks. Try 0.9 for more creative applications, and 0 (argmax sampling) for ones with a well-defined answer. We generally recommend altering this or top_p but not both.</p>
                </td>
            </tr>
            <tr>
                <th scope="row">Top-P</th>
                <td>
                    <input type="number" class="regular-text" min="0" max="1" step="0.1" bind:value="{settings.openai_top_p}">
                    <p>An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered. We generally recommend altering this or temperature but not both.</p>
                </td>
            </tr>
            <tr>
                <th scope="row">Presence penalty</th>
                <td>
                    <input type="number" class="regular-text" min="-2" max="2" step="0.1" bind:value="{settings.openai_presence_penalty}">
                    <p>Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.</p>
                </td>
            </tr>
            <tr>
                <th scope="row">Frequency penalty</th>
                <td>
                    <input type="number" class="regular-text" min="-2" max="2" step="0.1" bind:value="{settings.openai_frequency_penalty}">
                    <p>Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.</p>
                </td>
            </tr>
        </table>
    </div>
    {/if}
</div>