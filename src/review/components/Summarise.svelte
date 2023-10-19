<script>
    import { apiPost, apiPut } from 'wp-ajax';
    import { onMount } from 'svelte';
    export let summary;
    export let type_id;
    export let post;
    export let custom_action;
    
    let hovering = false;
    let editing = false;
    let disapproving = false;
    let approving = false;
    let approved;
    let just_summarised = false;
    let saving = false;
    
    String.prototype.nl2br = function() {
        return this.replace(/([^>])\n/g, '$1<br/>');
    };

    onMount(async () => {
        try {
            summary.summarising = false;
            if (Number(summary.summary_details.rating) === 1) {
                approved = true;
            // } else if (Number(summary.summary_details.rating) === 0) {
            //     unapproved = true;
            // } else if (Number(summary.summary_details.rating) === -1) {
            //     disapproved = true;
            }
            // console.log(summary);
        } catch (e) {
            console.error(e);
        }
    });

    async function summarise() {
        try {
            summary.summarising = true;
            const result = await apiPost(`/summaryengine/v1/summarise`, { type_id, post_id: post.id });
            if (!result?.summary) throw "No summary returned";
            summary.summary = result.summary;
            summary.summary_id = result.ID;
            summary.summary_details = result;
            summary.summary_details.rating = 0;
            summary.summarising = false;
            approved = false;
            just_summarised = true;
        } catch (err) {
            console.error(err);
            alert("An error occured: " + err);
            summary.summarising = false;
        }
    }

    async function approve() {
        try {
            approving = true;
            await apiPost(`/summaryengine/v1/rate/${summary.summary_id}`, { rating: 1 });
            summary.summary_details.rating = 1;
            approving = false;
            approved = true;
            just_summarised = false;
        } catch(err) {
            console.error(err);
            alert("An error occured: " + err);
            approving = false;
        }
    }

    async function disapprove() {
        try {
            disapproving = true;
            await apiPost(`/summaryengine/v1/rate/${summary.summary_id}`, { rating: -1 });
            await summarise();
            disapproving = false;
            summary.summary_details.rating = 0;
            just_summarised = false;
            approved = false;
        } catch(err) {
            console.error(err);
            disapproving = false;
        }
    }

    async function save() {
        try {
            saving = true;
            await apiPut(`/summaryengine/v1/summary/${summary.summary_id}`, { summary: summary.summary });
            editing = false;
            saving = false;
        } catch(err) {
            console.error(err);
            alert("An error occured: " + err);
            editing = false;
            saving = false;
        }
    }
</script>

<div class="summaryengine-summarise" on:mouseenter={() => hovering = true} on:mouseleave={() => hovering = false} class:is_hovering={hovering} class:just_summarised={just_summarised} class:approved={(Number(summary.summary_details.rating) === 1)} class:unapproved={(Number(summary.summary_details.rating) === 0)} class:disapproved={(Number(summary.summary_details.rating) === -1)}>
    {#if summary.summary}
        {#if editing}
            <textarea class="summaryengine-summarise__summary-textarea" bind:value={summary.summary} />
            {#if (!saving)}
                <input class="summaryengine-button button" type="button" name="save" value="Save" on:click={save} />
                <input class="summaryengine-button button" type="button" name="cancel" value="Cancel" on:click={() => editing = false} />
            {:else}
                <input class="summaryengine-button button" type="button" name="save" value="Saving..." disabled />
            {/if}
        {:else}
            <div class="summaryengine-summarise__summary">
                {@html summary.summary?.nl2br()}
            </div>
        {/if}
        {#if (custom_action)}
            {@html custom_action.replace("[post_url]", post.permalink).replace("[summary_encoded]", encodeURIComponent(summary.summary || "")).replace("[summary]", summary.summary)}
        {/if}
    {:else}
        {#if summary.summarising}
            <input class="summaryengine-button button" type="button" name="summarise" value="Summarising..." disabled="disabled" />
        {:else}
            <input class="summaryengine-button button" type="button" name="summarise" value="Summarise" on:click={summarise} />
        {/if}
    {/if}
    {#if hovering || just_summarised}
        <div class="summaryengine-actions">
            {#if summary?.summary && !editing}
                {#if (!approved && !disapproving)}
                    {#if approving}
                        <input class="summaryengine-button button" type="button" name="approve" value="Approving..." disabled="disabled" />
                    {:else}
                        <input class="summaryengine-button button" type="button" name="approve" value="Approve" on:click={approve} />
                    {/if}
                {/if}
                {#if disapproving}
                    <input class="summaryengine-button button" type="button" name="disapprove" value="Rejecting..." disabled="disabled" />
                {:else if !approving}
                    <input class="summaryengine-button button" type="button" name="disapprove" value="Reject" on:click={disapprove} />
                {/if}
                <input class="summaryengine-button button" type="button" name="edit" value="Edit" on:click={() => editing = true} />
            {/if}
        </div>
    {/if}
</div>

<style lang="less">
    .summaryengine-summarise {
        display: flex;
        flex-direction: column;
    }

    .summaryengine-summarise__summary {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
    }

    .is_hovering, .just_summarised {
        .summaryengine-summarise__summary {
            overflow: visible;
            white-space: normal;
            max-height: none;
        }
    }

    .summaryengine-button {
        margin-top: 10px;
    }

    .unapproved {
        .summaryengine-summarise__summary {
            background-color: #f2f8d7;
        }
    }

    .disapproved {
        .summaryengine-summarise__summary {
            background-color: #f8d7da;
        }
    }

    .summaryengine-summarise__summary-textarea {
        width: 100%;
        height: 200px;
        margin-bottom: 10px;
    }
</style>