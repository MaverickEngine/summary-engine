<script lang="ts">
    import { onMount } from 'svelte';
    import { apiGet, apiPut } from 'wp-ajax';
    import { generate_summary } from '../libs/generate.js';
    import { Button } from "svelte-wordpress-components";

    // Interfaces
    import type {IType} from '../types/TypeInterface.js';
    import type { ISummary } from '../types/SummaryInterface.js';
    import type { ISimpleSummary } from '../types/SimpleSummaryInterface.js';

    import Spinner from './Spinner.svelte';

    const post_id = jQuery("#post_ID").val();
    export let type : IType;
    let summary: ISimpleSummary | null = null;
    let editing = false;
    let saving = false;
    let loading = true;
    let approved = false;

    async function updateMetadata() {
        try {
            if (!summary) return;
            saving = true;
            const slug = type.slug;
            const meta_fields = [
                {
                    key: `summaryengine_${slug}`,
                    value: summary.summary,
                },
                {
                    key: `summaryengine_${slug}_id`,
                    value: summary.summary_id,
                },
                {
                    key: `summaryengine_${slug}_rating`,
                    value: summary.summary_rating,
                }
            ]
            for (let meta_field of meta_fields) {
                const el_name = document.querySelector(`input[value='${meta_field.key}']`);
                if (!el_name) continue;
                const meta_id = el_name.getAttribute("id").replace("meta-", "").replace("-key", "");
                document.getElementById(`meta-${meta_id}-value`).innerHTML = meta_field.value.toString();
            }
            saving = false;
        } catch(err) {
            console.error(err);
            alert("An error occured: " + err);
            saving = false;
        }
    }

    function _parse_summary(s): ISimpleSummary {
        return {
            summary: s.summary,
            summary_id: Number(s.summary_id),
            summary_rating: Number(s.summary_rating),
        }
    }

    onMount(async () => {
        try {
            summary = _parse_summary(await apiGet(`summaryengine/v1/summary/${post_id}?type_id=${type.ID}`));
            approved = Number(summary.summary_rating) === 1;
            loading = false;
        } catch (e) {
            console.error(e);
            alert("An error occured: " + e);
            loading = false;
        }
    });

    async function doApprove() {
        console.log("Approve");
        summary.summary_rating = 1;
        try {
            saving = true;
            await apiPut(`/summaryengine/v1/summary/${summary.summary_id}`, summary);
            updateMetadata();
        } catch(err) {
            console.error(err);
            alert("An error occured: " + err);
        } finally {
            saving = false;
        }
    }

    async function doReject() {
        console.log("Reject");
        try {
            saving = true;
            await apiPut(`/summaryengine/v1/summary/${summary.summary_id}`, { summary_rating: -1 });
            const response: ISummary = await generate_summary(type);
            summary = _parse_summary({
                summary: response.summary,
                summary_id: response.ID,
                summary_rating: 0
            });
            updateMetadata();
        } catch(err) {
            console.error(err);
            alert("An error occured: " + err);
        } finally {
            saving = false;
        }
    }

    async function doGenerate() {
        console.log("Generate");
        try {
            saving = true;
            const response: ISummary = await generate_summary(type);
            summary = _parse_summary({
                summary: response.summary,
                summary_id: response.ID,
                summary_rating: 0
            });
            updateMetadata();
        } catch(err) {
            console.error(err);
            alert("An error occured: " + err);
        } finally {
            saving = false;
        }
    }

    function doUnapprove() {
        console.log("Unapprove");
        summary.summary_rating = 0;
        updateMetadata();
    }

    function doSave() {
        console.log("Save");
        editing = false;
        updateMetadata();
    }

    $: updateMetadata();
</script>
<div id="summaryEngineMetaBlock">
    <div class="summaryengine-header">
        <h4>{type.name}</h4>
    </div>
    {#if loading || saving}
            <Spinner />
    {:else}
        <label class="screen-reader-text" for="summary">Summary</label>
        
        {#if summary.summary_rating === 1 && !editing}
            <textarea rows="1" cols="40" id="summaryEngineSummary" class="summaryengine-textarea" value={summary.summary} readonly></textarea>
            <div class="summaryengine-nav">
                <Button on:click={() => editing = true}>Edit</Button>
                <Button type="link" on:click={doUnapprove} warning={true}>Unapprove</Button>
            </div>
        {:else if summary.summary_rating === 1 && editing}
            <textarea rows="1" cols="40" id="summaryEngineSummary" class="summaryengine-textarea" bind:value={summary.summary}></textarea>
            <div class="summaryengine-nav">
                <Button on:click={doSave}>Save</Button>
            </div>
        {:else if (summary.summary)}
            <textarea rows="1" cols="40" id="summaryEngineSummary" class="summaryengine-textarea" bind:value={summary.summary}></textarea>
            <div class="summaryengine-nav">
                <Button on:click={doApprove}>Approve</Button>
                <Button on:click={doReject} warning={true}>Reject</Button>
            </div>
        {:else}
        <div class="summaryengine-nav">
            <Button type="link" on:click={doGenerate} primary={true}>Generate</Button>
        </div>
        {/if}
        <!-- {#if editing}
            <textarea cols="40" class="summaryengine-summarise__summary-textarea" bind:value={summary_text} />
            {#if (!saving)}
                <input class="summaryengine-button button" type="button" name="save" value="Save" on:click={save} />
                <input class="summaryengine-button button" type="button" name="cancel" value="Cancel" on:click={() => editing = false} />
            {:else}
                <input class="summaryengine-button button" type="button" name="save" value="Saving..." disabled />
            {/if}
        {:else if (summary_id)}
            <textarea rows="1" cols="40" id="summaryEngineSummary" class="summaryengine-textarea" value={summary_text} readonly></textarea>
            <div class="summaryengine-nav">
                <input class="summaryengine-button button" type="button" name="edit" value="Edit" on:click={() => editing = true} />
                {#if !approved && summaries.length > 1}
                    <Navigation summaries={summaries} type={type} bind:summary_text={summary_text} bind:summary_index={summary_index} bind:settings={settings} />
                {/if}
            </div>
        {/if}
        <div id="summaryEngineMetaBlockSummariseButtonContainer">
            <GenerateSummary type={type} bind:summary_text={summary_text} bind:summary_id={summary_id} bind:summary_index={summary_index} bind:submissions_left={submissions_left} bind:summaries={summaries} settings={settings} />
            <SubmissionsLeft bind:submissions_left={submissions_left} />
            
        </div> -->
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

    .summaryengine-nav {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
    }

    /* #summaryEngineMetaBlockSummariseButtonContainer {
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
    } */
</style>