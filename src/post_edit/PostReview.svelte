<script lang="ts">
    import { onMount } from 'svelte';
    import { apiGet, apiPut } from '../libs/ajax.js';

    // Interfaces
    import type {ISettings} from '../types/SettingsInterface';
    import type {IType} from '../types/TypeInterface.js';

    // Components
    import SubmissionsLeft from '../components/SubmissionsLeft.svelte';
    import Navigation from '../components/Navigation.svelte';
    import Rate from '../components/Rate.svelte';
    import GenerateSummary from '../components/GenerateSummary.svelte';
    import Settings from '../components/Settings.svelte';
    import Spinner from '../components/Spinner.svelte';

    const post_id = jQuery("#post_ID").val();
    export let type : IType;
    let summaries = [];
    let summary_text = "";
    let summary_id = 0;
    let summary_index = 0;
    let submissions_left;
    let settings : ISettings = {
        openai_model: "",
        openai_prompt: "",
        openai_append_prompt: "",
        openai_frequency_penalty: 0.5,
        openai_max_tokens: 300,
        openai_presence_penalty: 0,
        openai_temperature: 0.6,
        openai_top_p: 1,
    };
    let settings_visible = false;
    let editing = false;
    let saving = false;
    let loading = true;

    function setSummarySettings(summary) {
        settings.openai_model = summary.openai_model;
        settings.openai_prompt = summary.prompt;
        settings.openai_append_prompt = summary.append_prompt;
        settings.openai_frequency_penalty = summary.frequency_penalty;
        settings.openai_max_tokens = summary.max_tokens;
        settings.openai_presence_penalty = summary.presence_penalty;
        settings.openai_temperature = summary.temperature;
        settings.openai_top_p = summary.top_p;
    }

    function setDefaultSettings(type) {
        settings.openai_model = type.openai_model;
        settings.openai_prompt = type.openai_prompt;
        settings.openai_append_prompt = type.openai_append_prompt;
        settings.openai_frequency_penalty = type.openai_frequency_penalty;
        settings.openai_max_tokens = type.openai_max_tokens;
        settings.openai_presence_penalty = type.openai_presence_penalty;
        settings.openai_temperature = type.openai_temperature;
        settings.openai_top_p = type.openai_top_p;
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
            <input class="summaryengine-button button" type="button" name="edit" value="Edit" on:click={() => editing = true} />
        {/if}
        <div id="summaryEngineMetaBlockSummariseButtonContainer">
            <GenerateSummary type={type} bind:summary_text={summary_text} bind:summary_id={summary_id} bind:summary_index={summary_index} bind:submissions_left={submissions_left} bind:summaries={summaries} settings={settings} />
            <SubmissionsLeft summaries={summaries} bind:submissions_left={submissions_left} />
            {#if summaries.length > 1}
                <Navigation summaries={summaries} type={type} bind:summary_text={summary_text} bind:summary_index={summary_index} bind:settings={settings} />
            {/if}
            {#if summary_id > 0}
                <Rate bind:summaries={summaries} type={type} summary_id={summary_id} summary_index={summary_index} />
            {/if}
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