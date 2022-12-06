<script lang="ts">
    import { onMount } from 'svelte';
    import { apiGet } from '../libs/ajax.js';

    // Interfaces
    import type {ISettings} from '../types/SettingsInterface';
    import type {IType} from '../types/TypeInterface.js';

    // Components
    import SubmissionsLeft from '../components/SubmissionsLeft.svelte';
    import Navigation from '../components/Navigation.svelte';
    import Rate from '../components/Rate.svelte';
    import GenerateSummary from '../components/GenerateSummary.svelte';
    import Settings from '../components/Settings.svelte';

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
        openai_frequency_penalty: 0.5,
        openai_max_tokens: 300,
        openai_presence_penalty: 0,
        openai_temperature: 0.6,
        openai_top_p: 1,
    };
    let settings_visible = false;

    function setSummarySettings(summary) {
        console.log(summary);
        settings.openai_model = summary.openai_model;
        settings.openai_prompt = summary.prompt;
        settings.openai_frequency_penalty = summary.frequency_penalty;
        settings.openai_max_tokens = summary.max_tokens;
        settings.openai_presence_penalty = summary.presence_penalty;
        settings.openai_temperature = summary.temperature;
        settings.openai_top_p = summary.top_p;
    }

    function setDefaultSettings(type) {
        settings.openai_model = type.openai_model;
        settings.openai_prompt = type.openai_prompt;
        settings.openai_frequency_penalty = type.openai_frequency_penalty;
        settings.openai_max_tokens = type.openai_max_tokens;
        settings.openai_presence_penalty = type.openai_presence_penalty;
        settings.openai_temperature = type.openai_temperature;
        settings.openai_top_p = type.openai_top_p;
    }

    function calcSubmissionsLeft() {
        const max_summaries = Number(summaryengine_max_number_of_submissions_per_post);
        submissions_left = (max_summaries - summaries.length) > 0 ? max_summaries -  summaries.length : 0;
    }

    onMount(async () => {
        try {
            // console.log(summaryengine_settings);
            // settings = summaryengine_settings;
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
        } catch (e) {
            console.error(e);
        }
    });

    $: calcSubmissionsLeft();
</script>
<div id="summaryEngineMetaBlock">
    <div class="summaryengine-header">
        <h3>{type.name}</h3>
        <button class="button summaryengine-settings-button" on:click|preventDefault="{() => settings_visible = !settings_visible}">Settings</button>
    </div>
    <Settings bind:settings={settings} visible={settings_visible} />
    <label class="screen-reader-text" for="summary">Summary</label>
    <textarea rows="1" cols="40" name="summaryengine_summary" id="summaryEngineSummary" class="summaryengine-textarea" bind:value={summary_text}></textarea>
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
</style>