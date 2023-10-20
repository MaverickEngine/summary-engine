<script lang="ts">
    import { onMount } from 'svelte';
    import { slide } from 'svelte/transition';
    import { apiGet, apiPost, apiDelete } from 'wp-ajax';
    import { types } from '../stores/types.js';
    import "../libs/slugify.js";
    import OpenAiTypeSettings from './OpenAITypeSettings.svelte';
    import type {IType} from '../types/TypeInterface.js';

    let tab = 0;
    let saving = false;
    let saved = false;
    let pending_delete = false;
    let deleting = false;
    let models = [];
    let has_error = false;
    let error_message = "";

    const addEmptyType = () => {
        $types.push({
            ID: "",
            name: 'New Type',
            cut_at_paragraph: 1,
            word_limit: 750,
            openai_method: 'complete',
            openai_model: 'text-davinci-003',
            openai_frequency_penalty: 0.5,
            openai_max_tokens: 300,
            openai_presence_penalty: 0,
            openai_temperature: 0.6,
            openai_top_p: 1,
            prompt: "Summarise the following text:",
        });
    }

    onMount(async () => {
        try {
            models = await apiGet(`summaryengine/v1/models`);
        } catch (e) {
            has_error = true;
            error_message = "Unable to connect to OpenAI API. Please check your API key and try again.";
        }
        try {
            // console.log(models);
            $types = (await apiGet(`summaryengine/v1/types`)).map((type: IType) => {
                type.ID = Number(type.ID);
                type.openai_method = String(type.openai_method) || "complete";
                type.cut_at_paragraph = !!(type.cut_at_paragraph);
                type.openai_frequency_penalty = Number(type.openai_frequency_penalty);
                type.openai_max_tokens = Number(type.openai_max_tokens);
                type.openai_presence_penalty = Number(type.openai_presence_penalty);
                type.openai_temperature = Number(type.openai_temperature);
                type.openai_top_p = Number(type.openai_top_p);
                type.word_limit = Number(type.word_limit);
                type.prompt = String(type.prompt) || "";
                type.append_prompt = String(type.append_prompt) || "";
                return type;
            });
            console.log($types);
            addEmptyType();
        } catch (e) {
            console.error(e);
        }
    });

    async function saveType(type: IType): Promise<void> {
        try {
            saving = true;
            if (!(type.name)) throw "Type name is required";
            if (!(type.prompt)) throw "Prompt is required";
            if (type.name === "New Type") throw "Please rename the type before saving";
            type.append_prompt = type.append_prompt || "";
            type.custom_action = type.custom_action || "";
            const result = await apiPost(`summaryengine/v1/type/${type.ID}`, type);
            if (!type.ID) {
                type.ID = Number(result.id);
                $types = $types.sort((a, b) => (a.name < b.name) ? -1 : 1);
                addEmptyType();
                $types = $types;
            }
            window.scrollTo(0, 0);
            saving = false;
            saved = true;
            setTimeout(() => {
                saved = false;
            }, 3000);
        } catch (e) {
            alert(e);
            saving = false;
        }
    }

    async function deleteType(type): Promise<void> {
        try {
            pending_delete = false;
            deleting = true;
            await apiDelete(`summaryengine/v1/type/${type.ID}`);
            $types = $types.filter(t => t.ID !== type.ID);
            tab = 0;
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

{#if has_error}
    <div class="notice notice-error is-dismissible">
        <p>{error_message}</p>
    </div>
{/if}

<nav class="nav-tab-wrapper">
    {#each $types as type, i}
        <a href="#type-{type.ID}" class="nav-tab" on:click={() => tab = i} class:nav-tab-active={tab === i}>{type.name}</a>
    {/each}
</nav>

{#each $types as type, i}
    {#if tab === i}
        <div class="tab-content">
            <h2>{type.name} Settings</h2>
            {#if (saved)}
                <div transition:slide class="notice notice-success is-dismissible">
                    <p>{type.name} saved.</p>
                </div>
            {/if}
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
                    <OpenAiTypeSettings bind:settings="{type}" />
                    <tr>
                        <th scope="row">Custom action</th>
                        <td>
                            <textarea name="custom_action" class="regular-text" bind:value="{type.custom_action}"></textarea>
                            <p>Call a custom action based on the summary and post, eg. post to Twitter. Use [post_url] and [summary], and [summary_encoded] as variables.</p>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        {#if !saving}
            <input type="submit" name="submit" id="submit" class="button button-primary" value="Save Changes" on:click="{() => saveType(type) }">
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
            <input type="button" name="delete" id="delete" class="button button-warning" value="Yes" on:click="{() => deleteType(type) }">
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