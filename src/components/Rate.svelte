<script>
    import { summaries, summary_id, summary_index } from '../stores.js';
    import { apiPost } from '../libs/ajax.js';

    let rated = false;
    let rating = 0;

    const rate = async (rating) => {
        // console.log("rate", rating);
        try {
            $summaries[$summary_index].rating = rating;
            await apiPost("summaryengine/v1/rate/" + $summary_id, { rating });
        } catch (err) {
            console.error(err);
            alert(err);
        }
    }

    $: rated = $summaries[$summary_index]?.rating && [-1, 1].includes(Number($summaries[$summary_index].rating));
    $: rating = $summaries[$summary_index]?.rating ? Number($summaries[$summary_index].rating) : 0;
</script>

<div id="summaryEngineRate">
    <div id="summaryEngineRateIcons">
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <span id="summaryEngineRateGood" class="summaryengine-rate-icon" on:click={() => rate(1)} class:summaryengine-rate-icon-selected={rating === 1} >&#128077;</span>
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <span id="summaryEngineRateBad" class="summaryengine-rate-icon" on:click={() => rate(-1)} class:summaryengine-rate-icon-selected={rating === -1}>&#128078;</span>
    </div>
    {#if rated}
        <div id="summaryEngineRateThanks">Thanks for your feedback!</div>
    {:else}
        <div id="summaryEngineRateThanks">How do you rate this summary?</div>
    {/if}
</div>

<style lang="scss">
    #summaryEngineRate {
        margin-left: 1em;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
      
        #summaryEngineRateIcons {
            font-size: 1.5em;
            .summaryengine-rate-icon {
                cursor: pointer;
                margin: 0 0.2em;
                border: 1px solid #ccc;
                border-radius: 2px;
                padding: 0.2em;
                opacity: 0.5;
            }
            .summaryengine-rate-icon-selected {
                opacity: 1;
            }
        }
    }
</style>