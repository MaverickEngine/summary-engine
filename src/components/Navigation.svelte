<script lang="ts">
    // DEPRECATED!
    
    // Interfaces
    import type {ISettings} from '../types/SettingsInterface';
    import type {IType} from '../types/TypeInterface.js';
    import { apiPost } from 'wp-ajax';

    export let summaries = [];
    export let summary_index = 0;
    export let summary_text = "";
    export let settings: ISettings;
    export let type: IType;

    let current_summary_index = 0;

    const prev = () => {
        if (summary_index > 0) {
            summary_index = summary_index - 1;
        }
        summary_text = summaries[summary_index].summary;
        set_settings();
    }

    const next = () => {
        if (summary_index < summaries.length - 1) {
            summary_index = summary_index + 1;
        }
        summary_text = summaries[summary_index].summary;
        set_settings();
    }

    export const set_settings = () => {
        settings.openai_model = summaries[summary_index].openai_model;
        settings.openai_max_tokens = Number(summaries[summary_index].openai_max_tokens);
        settings.openai_temperature =  Number(summaries[summary_index].openai_temperature);
        settings.openai_frequency_penalty =  Number(summaries[summary_index].openai_frequency_penalty);
        settings.openai_presence_penalty =  Number(summaries[summary_index].openai_presence_penalty);
        settings.openai_top_p =  Number(summaries[summary_index].openai_top_p);
        settings.prompt = summaries[summary_index].prompt || "";
        settings.append_prompt = summaries[summary_index].append_prompt || "";
        settings = settings;
    }

    const saveCurrentSummary = async () => {
        try {
            await apiPost("summaryengine/v1/summary/" + jQuery("#post_ID").val(), {
                summary: summary_text,
                summary_index: summary_index,
                summary_id: summaries[summary_index].ID,
                type_id: type.ID,
            });
            current_summary_index = summary_index;
        } catch (err) {
            console.error(err);
            alert(err);
        }
    }

    // $: set_settings();
</script>

<div id="summaryEngineNavigator">
    <button id="summaryEngineNavigatorPrev" type="button" class="button button-secondary" on:click={prev} disabled={summary_index === 0}>
        Next
    </button>
    <button id="summaryEngineNavigatorNext" type="button" class="button button-secondary" on:click={next} disabled={summary_index === summaries.length - 1}>
        Previous
    </button>
    {#if (summary_index != current_summary_index)}
        <button id="summaryEngineNavigatorUse" type="button" class="button button-secondary" on:click={saveCurrentSummary}>
            Use this summary
        </button>
    {/if}
</div>

<style lang="less">
    #summaryEngineNavigator {
        margin-left: 10px;

        button {
          margin-left: 5px;
        }
    }
</style>