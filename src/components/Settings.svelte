<script>
    import { slide } from 'svelte/transition';
    import { custom_settings } from '../stores.js';

    let show_settings = false;
</script>

<div id="summaryEngineSettingsHeaderContainer">
    {#if (show_settings)}
    <div id="summaryEngineSettings" transition:slide>
        <div class="summaryEngineSettings__header">
            <h2>Summary Engine Settings</h2>
        </div>
    </div>
    {/if}
    <span class="dashicons dashicons-admin-settings summaryengine-settings-icon" on:click={() => show_settings = !show_settings} on:keypress={() => show_settings = !show_settings}></span>
</div>
{#if (show_settings)}
<div id="summaryEngineSettingsContainer" transition:slide>
    <div class="summaryengine-settings-section">
        <label for="summaryengine_openai_prompt">Custom Prompt</label>
        <input type="text" name="summaryengine_openai_prompt" id="summaryengine_openai_prompt" bind:value={$custom_settings.openai_prompt} />
    </div>
    <div class="summaryengine-settings-section">
        <label for="summaryengine_openai_model">OpenAI Model</label>
        <select name="summaryengine_openai_model" bind:value={$custom_settings.openai_model}>
            <option value="text-davinci-002">Text-Davinci-002</option>
            <option value="text-curie-001">Text-Curie-001</option>
            <option value="text-babbage-001">Text-Babbage-001</option>
            <option value="text-ada-001">Text-Ada-001</option>
        </select>
    </div>
    <div class="summaryengine-settings-section">
        <label for="summaryengine_openai_max_tokens">Max Tokens</label>
        <input type="number" max="1000" min="0" name="summaryengine_openai_max_tokens" id="summaryengine_openai_max_tokens" bind:value={$custom_settings.openai_max_tokens} />
    </div>
    <div class="summaryengine-settings-section">
        <label for="summaryengine_openai_temperature">Temperature</label>
        <input type="number" max="1" min="0" step="0.1" name="summaryengine_openai_temperature" id="summaryengine_openai_temperature" bind:value={$custom_settings.openai_temperature} />
    </div>
    <div class="summaryengine-settings-section">
        <label for="summaryengine_openai_top_p">Top-P</label>
        <input type="number" max="1" min="0" step="0.1" name="summaryengine_openai_top_p" id="summaryengine_openai_top_p" bind:value={$custom_settings.openai_top_p} />
    </div>
    <div class="summaryengine-settings-section">
        <label for="summaryengine_openai_frequency_penalty">Frequency Penalty</label>
        <input type="number" max="1" min="0" step="0.1" name="summaryengine_openai_frequency_penalty" id="summaryengine_openai_frequency_penalty" bind:value={$custom_settings.openai_frequency_penalty} />
    </div>
    <div class="summaryengine-settings-section">
        <label for="summaryengine_openai_presence_penalty">Presence Penalty</label>
        <input type="number" max="1" min="0" step="0.1" name="summaryengine_openai_presence_penalty" id="summaryengine_openai_presence_penalty" bind:value={$custom_settings.openai_presence_penalty} />
    </div>
</div>
{/if}
<style lang="scss">
    #summaryEngineSettingsHeaderContainer {
        width: 100%;
        display: flex;
        justify-content: flex-end;
        align-items: left;

        #summaryEngineSettings {
            flex-grow: 4;
            display: flex;
            flex-direction: column;
            justify-content: left;
        }

        .summaryengine-settings-icon {
            cursor: pointer;
        }
    }

    #summaryEngineSettingsContainer {
        display: flex;
        justify-content: flex-start;
        align-items: left;
        border: 1px solid #ddd;
        border-radius: 5px;
        padding: 10px;
        flex-direction: row;
        margin-bottom: 10px;
        flex-wrap: wrap;
    }

    .summaryengine-settings-section {
        display: flex;
        flex-direction: column;
        width: 33%;
        margin-bottom: 5px;
    }
</style>