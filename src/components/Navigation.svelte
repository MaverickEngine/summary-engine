<script>
    import { summaries, summary_index, summary_text } from '../stores.js';
    import { apiPost } from '../libs/ajax.js';

    const prev = () => {
        if ($summary_index > 0) {
            $summary_index = $summary_index - 1;
        }
        $summary_text = $summaries[$summary_index].summary;
        save_current_summary();
    }

    const next = () => {
        if ($summary_index < $summaries.length - 1) {
            $summary_index = $summary_index + 1;
        }
        $summary_text = $summaries[$summary_index].summary;
        save_current_summary();
    }

    const save_current_summary = async () => {
        try {
            await apiPost("summaryengine/v1/summary/" + jQuery("#post_ID").val(), {
                summary: $summary_text,
                summary_index: $summary_index,
                summary_id: $summaries[$summary_index].ID
            });
        } catch (err) {
            console.error(err);
            alert(err);
        }
    }
</script>

<div id="summaryEngineNavigator">
    <button id="summaryEngineNavigatorPrev" type="button" class="button button-secondary" on:click={prev} disabled={$summary_index === 0}>
        Previous
    </button>
    <button id="summaryEngineNavigatorNext" type="button" class="button button-secondary" on:click={next} disabled={$summary_index === $summaries.length - 1}>
        Next
    </button>
</div>

<style lang="scss">
    #summaryEngineNavigator {
        margin-left: 10px;

        button {
          margin-left: 5px;
        }
    }
</style>