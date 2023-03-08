<script lang="ts">
    import { onMount } from 'svelte';
    import { apiGet, apiPut } from '../libs/ajax.js';

    // Interfaces
    import type {ISettings} from '../types/SettingsInterface';
    import type {IType} from '../types/TypeInterface.js';

    // Components
    import SubmissionsLeft from './SubmissionsLeft.svelte';
    import Navigation from './Navigation.svelte';
    import GenerateSummary from './GenerateSummary.svelte';
    import Settings from './Settings.svelte';
    import Spinner from './Spinner.svelte';

    const post_id = jQuery("#post_ID").val();
    export let type : IType;
    let summaries = [];
    let summary_text = "";
    let summary_id = 0;
    let summary_index = 0;
    let submissions_left;
    let settings : ISettings = {
        openai_model: "",
        prompt: "",
        append_prompt: "",
        openai_frequency_penalty: 0.5,
        openai_max_tokens: 300,
        openai_presence_penalty: 0,
        openai_temperature: 0.6,
        openai_top_p: 1,
        word_limit: 750,
        cut_at_paragraph: true,
    };
    let settings_visible = false;
    let editing = false;
    let saving = false;
    let loading = true;

    function setSummarySettings(summary) {
        settings.openai_model = summary.openai_model;
        settings.prompt = summary.prompt;
        settings.append_prompt = summary.append_prompt;
        settings.openai_frequency_penalty = summary.openai_frequency_penalty;
        settings.openai_max_tokens = summary.openai_max_tokens;
        settings.openai_presence_penalty = summary.openai_presence_penalty;
        settings.openai_temperature = summary.openai_temperature;
        settings.openai_top_p = summary.openai_top_p;
        settings.word_limit = summary.word_limit;
        settings = settings;
    }

    function setDefaultSettings(type) {
        settings.openai_model = type.openai_model;
        settings.prompt = type.prompt;
        settings.append_prompt = type.append_prompt;
        settings.openai_frequency_penalty = type.openai_frequency_penalty;
        settings.openai_max_tokens = type.openai_max_tokens;
        settings.openai_presence_penalty = type.openai_presence_penalty;
        settings.openai_temperature = type.openai_temperature;
        settings.openai_top_p = type.openai_top_p;
        settings.word_limit = type.word_limit;
        settings = settings;
    }

    function calcSubmissionsLeft() {
        // @ts-ignore
        const max_summaries = Number(summaryengine_max_number_of_submissions_per_post || 5);
        submissions_left = (max_summaries - summaries.length) > 0 ? max_summaries -  summaries.length : 0;
    }

    async function save() {
        try {
            saving = true;
            await apiPut(`/summaryengine/v1/summary/${summary_id}`, { summary: summary_text });
            editing = false;
            saving = false;
        } catch(err) {
            console.error(err);
            alert("An error occured: " + err);
            editing = false;
            saving = false;
        }
    }

    onMount(async () => {
        try {
            summaries = await apiGet(`summaryengine/v1/post/${post_id}?type_id=${type.ID}`);
            const current_summary = await apiGet(`summaryengine/v1/summary/${post_id}?type_id=${type.ID}`);
            summary_text = current_summary.summary;
            summary_id = Number(current_summary.summary_id);
            summary_index = summaries.findIndex(summary => Number(summary.ID) === summary_id);
            if (summary_index > -1) {
                setSummarySettings(summaries[summary_index]);
            } else {
                setDefaultSettings(type);
            }
            calcSubmissionsLeft();
            loading = false;
        } catch (e) {
            console.error(e);
            alert("An error occured: " + e);
            loading = false;
        }
    });

    $: calcSubmissionsLeft();
</script>
<div id="summaryEngineMetaBlock">
    <div class="summaryengine-header">
        <h3>{type.name}</h3>
        {#if !loading}
            <button class="button summaryengine-settings-button" on:click|preventDefault="{() => settings_visible = !settings_visible}">Settings</button>
        {/if}
    </div>
    {#if loading}
            <Spinner />
    {:else}
        <Settings bind:settings={settings} visible={settings_visible} />
        <label class="screen-reader-text" for="summary">Summary</label>
        {#if editing}
            <textarea cols="40" class="summaryengine-summarise__summary-textarea" bind:value={summary_text} />
            {#if (!saving)}
                <input class="summaryengine-button button" type="button" name="save" value="Save" on:click={save} />
                <input class="summaryengine-button button" type="button" name="cancel" value="Cancel" on:click={() => editing = false} />
            {:else}
                <input class="summaryengine-button button" type="button" name="save" value="Saving..." disabled />
            {/if}
        {:else if (summary_id)}
            <textarea rows="1" cols="40" id="summaryEngineSummary" class="summaryengine-textarea" value={summary_text} readonly></textarea>
            <div class="summaryengine-nav">
                <input class="summaryengine-button button" type="button" name="edit" value="Edit" on:click={() => editing = true} />
                {#if summaries.length > 1}
                    <Navigation summaries={summaries} type={type} bind:summary_text={summary_text} bind:summary_index={summary_index} bind:settings={settings} />
                {/if}
            </div>
        {/if}
        <div id="summaryEngineMetaBlockSummariseButtonContainer">
            <GenerateSummary type={type} bind:summary_text={summary_text} bind:summary_id={summary_id} bind:summary_index={summary_index} bind:submissions_left={submissions_left} bind:summaries={summaries} settings={settings} />
            <SubmissionsLeft bind:submissions_left={submissions_left} />
            
        </div>
    {/if}
</div>

<style>
    .summaryengine-textarea {
        height: 8em !important;
        width: 100%;
    }

    .summaryengine-header {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
    }

    .summaryengine-nav {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
    }

    #summaryEngineMetaBlockSummariseButtonContainer {
        display: flex;
        flex-direction: row;
        margin-top: 10px;
    }  

    .summaryengine-settings-button {
        height: 20px;
    }

    .summaryengine-summarise__summary-textarea {
        width: 100%;
        height: 8em;
    }
</style>