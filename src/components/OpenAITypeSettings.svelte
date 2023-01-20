<script lang="ts">
    import type {ISettings} from '../types/SettingsInterface';

    export let settings: ISettings;
</script>

<tr>
    <th scope="row">Prepend Prompt</th>
    <td>
        <input type="text" name="openai_prompt" class="regular-text" bind:value="{settings.openai_prompt}" required>
        <p>The instruction to the model on what you'd like to generate, prepended.</p>
    </td>
</tr>
<tr>
    <th scope="row">Append Prompt</th>
    <td>
        <input type="text" name="openai_append_prompt" class="regular-text" bind:value="{settings.openai_append_prompt}" required>
        <p>The instruction to the model on what you'd like to generate, appended.</p>
    </td>
</tr>
<tr>
    <th scope="row">OpenAPI Model</th>
    <td>
        <select name="openai_model" bind:value="{settings.openai_model}">
            <option value="text-davinci-003">Text-Davinci-003</option>
            <option value="text-davinci-002">Text-Davinci-002</option>
            <option value="text-curie-001">Text-Curie-001</option>
            <option value="text-babbage-001">Text-Babbage-001</option>
            <option value="text-ada-001">Text-Ada-001</option>
        </select>
    </td>
</tr>
<tr>
    <th scope="row">Submission word limit</th>
    <td>
        <input type="number" name="word_limit"  class="regular-text" bind:value="{settings.word_limit}" min="0">
    </td>
</tr>
<tr>
    <th scope="row">Cut at paragraph nearest end?</th>
    <td>
        <input type="checkbox" name="cut_at_paragraph" bind:checked="{(settings.cut_at_paragraph)}">
    </td>
</tr>
<tr>
    <th scope="row">Max tokens</th>
    <td>
        <input type="number" name="openai_max_tokens" class="regular-text" min="0" max="2048" step="1" bind:value="{settings.openai_max_tokens}">
        <p>The maximum number of tokens to generate in the completion.</p>
    </td>
</tr>
<tr>
    <th scope="row">Temperature</th>
    <td>
        <input type="number" name="openai_temperature" class="regular-text" min="0" max="1" step="0.1" bind:value="{settings.openai_temperature}">
        <p>What sampling temperature to use. Higher values means the model will take more risks. Try 0.9 for more creative applications, and 0 (argmax sampling) for ones with a well-defined answer. We generally recommend altering this or top_p but not both.</p>
    </td>
</tr>
<tr>
    <th scope="row">Top-P</th>
    <td>
        <input type="number" name="openai_top_p" class="regular-text" min="0" max="1" step="0.1" bind:value="{settings.openai_top_p}">
        <p>An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered. We generally recommend altering this or temperature but not both.</p>
    </td>
</tr>
<tr>
    <th scope="row">Presence penalty</th>
    <td>
        <input type="number" name="openai_presence_penalty" class="regular-text" min="-2" max="2" step="0.1" bind:value="{settings.openai_presence_penalty}">
        <p>Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.</p>
    </td>
</tr>
<tr>
    <th scope="row">Frequency penalty</th>
    <td>
        <input type="number" name="openai_frequency_penalty" class="regular-text" min="-2" max="2" step="0.1" bind:value="{settings.openai_frequency_penalty}">
        <p>Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.</p>
    </td>
</tr>