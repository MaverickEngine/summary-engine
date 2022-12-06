<script>
    import { onMount } from 'svelte';
    import {writable} from 'svelte/store';
    // import { summaries, summary_text, summary_id, summary_index } from '../stores.js';
    import { apiGet } from '../libs/ajax.js';

    // Components
    import SubmissionsLeft from '../components/SubmissionsLeft.svelte';
    import Navigation from '../components/Navigation.svelte';
    import Rate from '../components/Rate.svelte';
    import GenerateSummary from '../components/GenerateSummary.svelte';

    const post_id = jQuery("#post_ID").val();
    export let type;
    let summaries = [];
    let summary_text = "";
    let summary_id = 0;
    let summary_index = 0;
    let submissions_left = writable(0);
    let custom_settings = {};

    onMount(async () => {
        try {
            console.log(summaryengine_settings);
            summaries = await apiGet(`summaryengine/v1/post/${post_id}?type_id=${type.ID}`);
            const current_summary = await apiGet(`summaryengine/v1/summary/${post_id}?type_id=${type.ID}`);
            summary_text = current_summary.summary;
            summary_id = Number(current_summary.summary_id);
            summary_index = summaries.findIndex(summary => Number(summary.ID) === summary_id);
            console.log({ summaries, summary_text, summary_id, summary_index });
        } catch (e) {
            console.error(e);
        }
    });
</script>
<div id="summaryEngineMetaBlock">
    <h3>{type.name}</h3>
    <label class="screen-reader-text" for="summary">Summary</label>
    <textarea rows="1" cols="40" name="summaryengine_summary" id="summaryEngineSummary" class="summaryengine-textarea" bind:value={summary_text}></textarea>
    <div id="summaryEngineMetaBlockSummariseButtonContainer">
        <GenerateSummary type={type} bind:summary_text={summary_text} bind:summary_id={summary_id} bind:summary_index={summary_index} bind:submissions_left={submissions_left} bind:summaries={summaries} />
        <SubmissionsLeft type={type} summaries={summaries} bind:submissions_left={submissions_left} />
        {#if summaries.length > 1}
            <Navigation summaries={summaries} type={type} bind:summary_text={summary_text} bind:summary_id={summary_id} bind:summary_index={summary_index} />
        {/if}
        {#if summary_id > 0}
            <Rate bind:summaries={summaries} type={type} summary_text={summary_text} summary_id={summary_id} summary_index={summary_index} />
        {/if}
    </div>
</div>

<style>
    .summaryengine-textarea {
        height: 8em !important;
        width: 100%;
    }

    #summaryEngineMetaBlockSummariseButtonContainer {
        display: flex;
        flex-direction: row;
        margin-top: 10px;
    }  
</style>