<script>
    import { onMount } from 'svelte';
    import { summaries, summary_text, summary_id, summary_index } from './stores.js';
    import { apiGet } from './libs/ajax.js';

    // Components
    import SubmissionsLeft from './components/SubmissionsLeft.svelte';
    import Navigation from './components/Navigation.svelte';
    import Generate from './components/Generate.svelte';
    import Rate from './components/Rate.svelte';

    const post_id = jQuery("#post_ID").val();

    onMount(async () => {
        try {
            // $summary_text = summaryengine_summary || '';
            $summaries = await apiGet(`summaryengine/v1/post/${post_id}`);
            const current_summary = await apiGet(`summaryengine/v1/summary/${post_id}`);
            $summary_text = current_summary.summary;
            $summary_id = Number(current_summary.summary_id);
            $summary_index = $summaries.findIndex(summary => Number(summary.ID) === $summary_id);
            // console.log({ $summary_id, $summary_index });
            // console.log($summaries);
        } catch (e) {
            console.error(e);
        }
    });
</script>

<div id="summaryEngineMetaBlock">
    <input type="hidden" name="summaryengine_summary_id" id="summaryEngineSummaryId" value="<?php echo esc_attr(get_post_meta($post->ID, 'summaryengine_summary_id', -1)); ?>" />
    <label class="screen-reader-text" for="summary">Summary</label>
    <textarea rows="1" cols="40" name="summaryengine_summary" id="summaryEngineSummary" class="summaryengine-textarea" bind:value={$summary_text}></textarea>
    <div id="summaryEngineMetaBlockSummariseButtonContainer">
        <Generate />
        <SubmissionsLeft />
        <Navigation />
        <Rate />
    </div>
</div>

<style lang="scss">
    .summaryengine-textarea {
        height: 8em !important;
        width: 100%;
    }

    #summaryEngineMetaBlockSummariseButtonContainer {
        display: flex;
        flex-direction: row;
    }

    
    
    
</style>