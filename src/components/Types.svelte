<script>
    import { onMount } from 'svelte';
    import { apiGet, apiPost, apiDelete } from '../libs/ajax.js';
    import { types } from '../stores/types.js';
    import "../libs/slugify.js";

    let tab = 0;
    let saving = false;
    let pending_delete = false;
    let deleting = false;

    const addEmptyType = () => {
        $types.push({
            ID: "",
            name: 'New Type',
            cut_at_paragraph: 1,
            openai_frequency_penalty: 0.5,
            openai_max_tokens: 300,
            openai_presence_penalty: 0,
            openai_temperature: 0.6,
            openai_top_p: 1,
            openai_word_limit: 750,
        });
    }

    onMount(async () => {
        try {
            $types = (await apiGet(`summaryengine/v1/types`)).map(type => {
                type.ID = Number(type.ID);
                type.cut_at_paragraph = Number(type.cut_at_paragraph);
                type.openai_frequency_penalty = Number(type.openai_frequency_penalty);
                type.openai_max_tokens = Number(type.openai_max_tokens);
                type.openai_presence_penalty = Number(type.openai_presence_penalty);
                type.openai_temperature = Number(type.openai_temperature);
                type.openai_top_p = Number(type.openai_top_p);
                type.openai_word_limit = Number(type.openai_word_limit);
                return type;
            });
            addEmptyType();
        } catch (e) {
            console.error(e);
        }
    });

    async function saveType(type) {
        try {
            saving = true;
            if (!(type.name)) throw "Type name is required";
            if (!(type.openai_prompt)) throw "Prompt is required";
            if (type.name === "New Type") throw "Please rename the type before saving";
            const result = await apiPost(`summaryengine/v1/type/${type.ID}`, type);
            if (!type.ID) {
                type.ID = Number(result.id);
                $types = $types.sort((a, b) => (a.name < b.name) ? -1 : 1);
                addEmptyType();
                $types = $types;
            }
            window.scrollTo(0, 0);
            saving = false;
        } catch (e) {
            alert(e);
            saving = false;
        }
    }

    async function deleteType(type) {
        try {
            pending_delete = false;
            deleting = true;
            // if (confirm("Are you sure you want to delete this type?")) {
                await apiDelete(`summaryengine/v1/type/${type.ID}`);
                $types = $types.filter(t => t.ID !== type.ID);
                tab = 0;
                // alert("Type deleted");
            // }
            deleting = false;
            window.scrollTo(0, 0);
        } catch (e) {
            alert(e);
            deleting = false;
        }
    }

    $: $types.forEach(type => {
        type.slug = type.name.slugify();
    });
</script>

<nav class="nav-tab-wrapper">
    {#each $types as type, i}
        <a href="#type-{type.ID}" class="nav-tab" on:click={() => tab = i} class:nav-tab-active={tab === i}>{type.name}</a>
    {/each}
</nav>

{#each $types as type, i}
    {#if tab === i}
        <div class="tab-content">
            <h2>{type.name} Settings</h2>
            <table class="form-table">
                <tbody>
                    <tr>
                        <th scope="row"><label for="name">Name</label></th>
                        <td><input type="text" name="name" id="name" bind:value="{type.name}" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="slug">Slug</label></th>
                        <td><input type="text" name="slug" id="slug" bind:value="{type.slug}" readonly /></td>
                    </tr>
                    <tr>
                        <th scope="row">Prompt</th>
                        <td>
                            <input type="text" name="openai_prompt" class="regular-text" bind:value="{type.openai_prompt}" required>
                            <p>The instruction to the model on what you'd like to generate.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">OpenAPI Model</th>
                        <td>
                            <select name="openai_model" bind:value="{type.openai_model}">
                                <option value="text-davinci-003">Text-Davinci-003</option>
                                <option value="text-davinci-002">Text-Davinci-002</option>
                                <option value="text-curie-001">Text-Curie-001</option>
                                <option value="text-babbage-001">Text-Babbage-001</option>
                                <option value="text-ada-001">Text-Ada-001</option>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">OpenAI submission word limit</th>
                        <td>
                            <input type="number" name="openai_word_limit"  class="regular-text" bind:value="{type.openai_word_limit}">
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Cut at paragraph nearest end</th>
                        <td>
                            <input type="checkbox" name="cut_at_paragraph" bind:checked="{(type.cut_at_paragraph)}"> {type.cut_at_paragraph}
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Max tokens</th>
                        <td>
                            <input type="number" name="openai_max_tokens" class="regular-text" min="0" max="2048" step="1" bind:value="{type.openai_max_tokens}">
                            <p>The maximum number of tokens to generate in the completion.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Temperature</th>
                        <td>
                            <input type="number" name="openai_temperature" class="regular-text" min="0" max="1" step="0.1" bind:value="{type.openai_temperature}">
                            <p>What sampling temperature to use. Higher values means the model will take more risks. Try 0.9 for more creative applications, and 0 (argmax sampling) for ones with a well-defined answer. We generally recommend altering this or top_p but not both.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Top-P</th>
                        <td>
                            <input type="number" name="openai_top_p" class="regular-text" min="0" max="1" step="0.1" bind:value="{type.openai_top_p}">
                            <p>An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered. We generally recommend altering this or temperature but not both.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Presence penalty</th>
                        <td>
                            <input type="number" name="openai_presence_penalty" class="regular-text" min="-2" max="2" step="0.1" bind:value="{type.openai_presence_penalty}">
                            <p>Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Frequency penalty</th>
                        <td>
                            <input type="number" name="openai_frequency_penalty" class="regular-text" min="-2" max="2" step="0.1" bind:value="{type.openai_frequency_penalty}">
                            <p>Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.</p>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        {#if !saving}
            <input type="submit" name="submit" id="submit" class="button button-primary" value="Save Changes" on:click="{ saveType(type) }">
        {:else}
            <input type="submit" name="submit" id="submit" class="button button-primary" value="Saving..." disabled>
        {/if}
        {#if (Number(type.ID) !== 1) && (!deleting)}
        <input type="button" name="delete" id="delete" class="button button-warning" value="Delete" on:click="{() => pending_delete = true }">
        {/if}
        {#if (deleting)} 
            <input type="button" name="delete" id="delete" class="button button-warning" value="Deleting..." disabled>
        {/if}
        {#if pending_delete}
            <p>Are you sure you want to delete this type?</p>
            <input type="button" name="delete" id="delete" class="button button-warning" value="Yes" on:click="{ deleteType(type) }">
            <input type="button" name="delete" id="delete" class="button button-primary" value="No" on:click="{() => pending_delete = false }">
        {/if}
    {/if}
{/each}

<style>
    .button-warning {
        background-color: #dc3232;
        border-color: #dc3232;
        color: #fff;
    }
</style>