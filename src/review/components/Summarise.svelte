<script>
    import { apiPost } from '../../libs/ajax.js';
    import { onMount } from 'svelte';
    import { fade, blur, fly, slide, scale } from "svelte/transition";
    export let summary;
    export let type_id;
    export let post_id;
    
    let hovering = false;
    let summarising = false;
    let disapproving = false;
    let approving = false;
    let approved;
    let unapproved;
    let disapproved;
    
    String.prototype.nl2br = function() {
        return this.replace(/([^>])\n/g, '$1<br/>');
    };

    onMount(async () => {
        try {
            if (Number(summary.summary_details.rating) === 1) {
                approved = true;
            } else if (Number(summary.summary_details.rating) === 0) {
                unapproved = true;
            } else if (Number(summary.summary_details.rating) === -1) {
                disapproved = true;
            }
            // console.log(summary);
        } catch (e) {
            console.error(e);
        }
    });

    async function summarise() {
        try {
            summarising = true;
            const result = await apiPost(`/summaryengine/v1/summarise`, { type_id, post_id });
            // console.log(result);
            if (!result?.summary) throw "No summary returned";
            summary.summary = result.summary;
            summary.summary_id = result.ID;
            summary.summary_details = result;
            summarising = false;
            approved = false;
            disapproved = false;
            unapproved = true;
        } catch (err) {
            console.error(err);
            alert("An error occured: " + err);
            summarising = false;
        }
    }

    async function approve() {
        try {
            approving = true;
            await apiPost(`/summaryengine/v1/rate/${summary.summary_id}`, { rating: 1 });
            summary.summary_details.rating = 1;
            approving = false;
            approved = true;
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
        } catch(err) {
            console.error(err);
            disapproving = false;
        }
    }
</script>

<div class="summaryengine-summarise" on:mouseenter={() => hovering = true} on:mouseleave={() => hovering = false} class:is_hovering={hovering} class:approved={(Number(summary.summary_details.rating) === 1)} class:unapproved={(Number(summary.summary_details.rating) === 0)} class:disapproved={(Number(summary.summary_details.rating) === -1)}>
    {#if summary.summary}
        <div class="summaryengine-summarise__summary">
            {@html summary.summary?.nl2br()}
        </div>
    {:else}
        {#if summarising}
            <input class="summaryengine-button" type="button" name="summarise" value="Summarising..." disabled="disabled" />
        {:else}
            <input class="summaryengine-button" type="button" name="summarise" value="Summarise" on:click={summarise} />
        {/if}
    {/if}
    {#if hovering}
        <div class="summaryengine-actions">
            
            {#if summary?.summary}
                {#if (!approved && !disapproving)}
                    {#if approving}
                        <input class="summaryengine-button" type="button" name="approve" value="Approving..." disabled="disabled" />
                    {:else}
                        <input class="summaryengine-button" type="button" name="approve" value="Approve" on:click={approve} />
                    {/if}
                {/if}
                {#if disapproving}
                    <input class="summaryengine-button" type="button" name="disapprove" value="Disapproving..." disabled="disabled" />
                {:else}
                    <input class="summaryengine-button" type="button" name="disapprove" value="Disapprove" on:click={disapprove} />
                {/if}
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

    
    .is_hovering {
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
</style>