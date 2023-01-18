<script>
    // import { summaries, summary_id, summary_index } from '../stores.js';
    import { apiPost } from '../libs/ajax.js';
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();

    export let summary_id = 0;
    export let summary_index = 0;
    export let summaries = [];
    export let type = {};
    export let loading = false;
    let rated = false;
    let rating = 0;

    const rate = async (rating) => {
        loading = true;
        try {
            summaries[summary_index].rating = rating;
            await apiPost("summaryengine/v1/rate/" + summary_id, { rating, type_id: type.ID });
            loading = false;
        } catch (err) {
            console.error(err);
            alert("An error occurded. Please try again.");
            loading = false;
        }
    }

    const reject = async () => {
        loading = true;
        try {
            summaries[summary_index].rating = -1;
            await apiPost("summaryengine/v1/rate/" + summary_id, { rating: -1, type_id: type.ID });
            loading = false;
            dispatch("reject");
        } catch (err) {
            console.error(err);
            alert("An error occurded. Please try again.");
            loading = false;
        }
    }

    $: rated = summaries[summary_index]?.rating && [-1, 1].includes(Number(summaries[summary_index].rating));
    $: rating = summaries[summary_index]?.rating ? Number(summaries[summary_index].rating) : 0;
</script>

<div id="summaryEngineRate">
    <div id="summaryEngineRateIcons" class:summaryengine-working={loading}>
        {#if rating === 0}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <input class="summaryengine-button button" type="button" name="approve" value="Approve" on:click={() => rate(1)} disabled={loading} />
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <input class="summaryengine-button button" type="button" name="reject" value="Reject" on:click={reject} disabled={loading} />
        {/if}
        {#if rating === 1}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <input class="summaryengine-button button" type="button" name="approved" value="Approved" on:click={() => rate(0)} disabled={loading} />
        {/if}
        {#if rating === -1}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <input class="summaryengine-button button" type="button" name="rejected" value="Rejected" on:click={() => rate(0)} disabled={loading} />
        {/if}
    </div>
</div>

<style lang="less">
    #summaryEngineRate {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
    }

    // .summaryengine-working {
    //     opacity: 0.5;
    // }
</style>