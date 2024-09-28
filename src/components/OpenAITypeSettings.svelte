<script lang="ts">
    import type { ISettings } from "../types/SettingsInterface";
    // import { FormInput } from "svelte-wordpress-components";
    import FormInput from "./FormInput.svelte";
    export let settings: ISettings;
</script>

<FormInput
    label="Prepend prompt"
    type="textarea"
    description="The instruction to the model on what you'd like to generate, prepended."
    bind:value={settings.prompt}
    required
    cols={40}
    rows={5}
/>
<FormInput
    label="Append prompt"
    type="textarea"
    description="The instruction to the model on what you'd like to generate, appended."
    bind:value={settings.append_prompt}
    required
    cols={40}
    rows={5}
/>
<tr>
    <th scope="row">Method</th>
    <td>
        <select name="openai_method" bind:value={settings.openai_method}>
            <option value="complete">Complete</option>
            <option value="chat">Chat</option>
        </select>
    </td>
</tr>
<tr>
    <th scope="row">OpenAI model</th>
    <td>
        <select name="openai_model" bind:value={settings.openai_model}>
            {#if settings.openai_method === "complete"}
                <option value="text-davinci-003">Text-Davinci-003</option>
                <option value="text-davinci-002">Text-Davinci-002</option>
                <option value="text-curie-001">Text-Curie-001</option>
                <option value="text-babbage-001">Text-Babbage-001</option>
                <option value="text-ada-001">Text-Ada-001</option>
            {:else if settings.openai_method === "chat"}
                <option value="gpt-4o-mini">GPT-4o-mini (Recommended)</option>
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-4-turbo">GPT-4-turbo</option>
                <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
            {/if}
        </select>
    </td>
</tr>
{#if settings.openai_method === "chat"}
    <FormInput
        type="textarea"
        label="User description"
        bind:value={settings.openai_system}
        description="Describe yourself, eg. 'I am a journalist for the Daily Maverick.'"
        cols={40}
        rows={5}
    />
{/if}
<FormInput
    type="number"
    label="Submission word limit"
    bind:value={settings.word_limit}
    min={0}
/>
<tr>
    <th scope="row">Cut at paragraph nearest end?</th>
    <td>
        <input
            type="checkbox"
            name="cut_at_paragraph"
            bind:checked={settings.cut_at_paragraph}
        />
    </td>
</tr>
<FormInput
    type="number"
    label="Max tokens"
    bind:value={settings.openai_max_tokens}
    min={0}
    max={2048}
    step={1}
    description="The maximum number of tokens to generate in the completion."
/>
<FormInput
    type="number"
    label="Temperature"
    bind:value={settings.openai_temperature}
    min={0}
    max={1}
    step={0.1}
    description="What sampling temperature to use. Higher values means the model will take more risks. Try 0.9 for more creative applications, and 0 (argmax sampling) for ones with a well-defined answer. We generally recommend altering this or top_p but not both."
/>
<FormInput
    type="number"
    label="Top-P"
    bind:value={settings.openai_top_p}
    min={0}
    max={1}
    step={0.1}
    description="An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered. We generally recommend altering this or temperature but not both."
/>
<FormInput
    label="Presence penalty"
    type="number"
    min={-2}
    max={2}
    step={0.1}
    bind:value={settings.openai_presence_penalty}
    description="Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics."
/>
<FormInput
    label="Frequency penalty"
    type="number"
    min={-2}
    max={2}
    step={0.1}
    bind:value={settings.openai_frequency_penalty}
    description="Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim."
/>
