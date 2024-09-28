<script lang="ts">
    import { onMount } from "svelte";
    import { apiGet, apiPut } from "wp-ajax";
    import { generate_summary } from "../libs/generate.js";
    // import { Button } from "svelte-wordpress-components";
    import Button from "./Button.svelte";

    // Interfaces
    import type { IType } from "../types/TypeInterface.js";
    import type { ISummary } from "../types/SummaryInterface.js";
    import type { ISimpleSummary } from "../types/SimpleSummaryInterface.js";

    import Spinner from "./Spinner.svelte";

    const post_id = jQuery("#post_ID").val();
    export let type: IType;
    let summary: ISimpleSummary | null = null;
    let editing = false;
    let saving = false;
    let loading = true;
    let approved = false;
    let history: Array<ISimpleSummary> = [];

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
                },
            ];
            for (let meta_field of meta_fields) {
                const el_name = document.querySelector(
                    `input[value='${meta_field.key}']`,
                );
                if (!el_name) continue;
                const meta_id = el_name
                    ?.getAttribute("id")
                    ?.replace("meta-", "")
                    ?.replace("-key", "");
                const valueElement = document.getElementById(
                    `meta-${meta_id}-value`,
                );
                if (valueElement) {
                    valueElement.innerHTML = meta_field.value.toString();
                }
            }
            saving = false;
        } catch (err) {
            console.error(err);
            alert("An error occured: " + err);
            saving = false;
        }
    }

    function _parse_summary(s: Record<string, any>): ISimpleSummary {
        return {
            summary: s.summary,
            summary_id: Number(s.summary_id),
            summary_rating: Number(s.summary_rating),
        };
    }

    onMount(async () => {
        try {
            summary = _parse_summary(
                await apiGet(
                    `summaryengine/v1/summary/${post_id}?type_id=${type.ID}`,
                ),
            );
            approved = Number(summary.summary_rating) === 1;
            loading = false;
            if (summary?.summary) {
                history.push(summary);
            }
            history = history;
        } catch (e) {
            console.error(e);
            alert("An error occured: " + e);
            loading = false;
        }
    });

    async function saveCurrent() {
        console.log("Save current");
        try {
            saving = true;
            if (summary) {
                await apiPut(
                    `/summaryengine/v1/summary/${summary.summary_id}`,
                    summary,
                );
                updateMetadata();
            }
        } catch (err) {
            console.error(err);
            alert("An error occured: " + err);
        } finally {
            saving = false;
        }
    }

    async function generate() {
        try {
            saving = true;
            const response: ISummary = await generate_summary(type);
            if (!response) return;
            summary = _parse_summary({
                summary: response.summary,
                summary_id: response.ID,
                summary_rating: 0,
            });
            updateMetadata();
            history.push(summary);
            history = history;
        } catch (err) {
            console.error(err);
            alert("An error occured: " + err);
        } finally {
            saving = false;
        }
    }

    async function doApprove() {
        console.log("Approve");
        if (!summary) return;
        summary.summary_rating = 1;
        await saveCurrent();
    }

    async function doReject() {
        console.log("Reject");
        if (!summary) return;
        summary.summary_rating = -1;
        await saveCurrent();
        await generate();
    }

    async function doGenerate(e: Event) {
        e.preventDefault();
        console.log("Generate");
        await generate();
    }

    async function doUnapprove() {
        console.log("Unapprove");
        if (!summary) return;
        summary.summary_rating = 0;
        await saveCurrent();
    }

    async function doSave() {
        console.log("Save");
        editing = false;
        await saveCurrent();
    }

    async function doBack() {
        console.log("Back");
        editing = false;
        if (history.length <= 1) return;

        const lastItem = history.pop();
        if (!lastItem) return;

        history.unshift(lastItem);
        summary = history[history.length - 1];
        await saveCurrent();
    }

    async function doForward() {
        console.log("Forward");
        editing = false;
        if (history.length <= 1) return;

        const firstItem = history.shift();
        if (!firstItem) return;

        history.push(firstItem);
        summary = history[history.length - 1];
        await saveCurrent();
    }

    $: updateMetadata();
</script>

<div id="summaryEngineMetaBlock">
    {#if loading || saving}
        <div class="summaryengine-overlay">
            <Spinner />
        </div>
    {/if}
    <div class="summaryengine-header">
        <h4>{type.name}</h4>
        {#if history.length > 1 && summary && summary.summary_rating !== 1}
            <div
                on:click={doBack}
                on:keypress={doBack}
                class="dashicons dashicons-arrow-left-alt"
                role="button"
                tabindex="0"
            ></div>
            {#if history.length > 2}
                <div
                    on:click={doForward}
                    on:keypress={doForward}
                    class="dashicons dashicons-arrow-right-alt"
                    role="button"
                    tabindex="0"
                ></div>
            {/if}
        {/if}
    </div>
    {#if loading}
        <Spinner />
    {:else}
        <label class="screen-reader-text" for="summary">Summary</label>
        <!-- Approved -->
        {#if summary && summary.summary_rating === 1 && !editing}
            <textarea
                rows="1"
                cols="40"
                id="summaryEngineSummary"
                class="summaryengine-textarea"
                value={summary.summary}
                readonly
            ></textarea>
            <div class="summaryengine-nav">
                <Button on:click={() => (editing = true)}>Edit</Button>
                <Button type="button" on:click={doUnapprove} warning={true}
                    >Unapprove</Button
                >
            </div>
            <!-- Approved, Editing -->
        {:else if summary && summary.summary_rating === 1 && editing}
            <textarea
                rows="1"
                cols="40"
                id="summaryEngineSummary"
                class="summaryengine-textarea"
                bind:value={summary.summary}
            ></textarea>
            <div class="summaryengine-nav">
                <Button on:click={doSave}>Save</Button>
            </div>
            <!-- Unapproved -->
        {:else if summary && summary.summary}
            <textarea
                rows="1"
                cols="40"
                id="summaryEngineSummary"
                class="summaryengine-textarea"
                bind:value={summary.summary}
            ></textarea>
            <div class="summaryengine-nav">
                <Button on:click={doApprove}>Approve</Button>
                <Button on:click={doReject} warning={true}>Reject</Button>
            </div>
        {:else}
            <!-- Starting State -->
            <div class="summaryengine-nav">
                <Button type="button" on:click={doGenerate} primary={true}
                    >Generate</Button
                >
            </div>
        {/if}
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

    .summaryengine-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        opacity: 0.6;
        background-color: #fff;
        z-index: 100;
        display: flex;
        justify-content: center;
        align-items: center;
    }
</style>
