<script>
    import { apiPost } from '../libs/ajax.js';
    import Spinner from './Spinner.svelte';

    export let type;
    export let loading = false;
    export let submissions_left;
    export let summaries = [];
    export let summary_text = "";
    export let summary_id = 0;
    export let summary_index = 0;
    export let settings = {};

    const get_content = () => {
        if (jQuery("#titlewrap").length) { // Classic editor
            if (jQuery(".wp-editor-area").is(":visible")) { // The code editor is visible
                return jQuery(".wp-editor-area").val();
            } else { // The visual editor is visible
                let content = tinymce.editors.content.getContent();
                if (content.length > 0) {
                    return content;
                }
            }
            return jQuery("#content").val(); // Last try...
        } else {
            return wp.data.select( "core/editor" ).getEditedPostContent();
        }
    }

    const strip_tags = (html) => {
        let tmp = document.createElement("div");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    }

    const generate_summary = async (e) => {
        const content = strip_tags(get_content());
        if (!content.length) {
            alert("Nothing to summarise yet...");
            return;
        }
        try {
            loading = true;
            const response = await apiPost("summaryengine/v1/summarise",
                {
                    content: content,
                    post_id: jQuery("#post_ID").val(),
                    settings: JSON.stringify(settings),
                    type_id: type.ID,
                }
            );
            summary_id = response.ID;
            summaries.unshift(response);
            summary_index = 0;
            summaries = summaries;
            summary_text = response.summary.trim();
            loading = false;
            submissions_left--;
            console.log({ summary_id, summaries, summary_index, summary_text, submissions_left });
            return;
        } catch (err) {
            alert(err);
            loading = false;
        }
    }
</script>
{#if !loading}
    <button id="summaryEngineMetaBlockSummariseButton" type="button" class="button button-primary" on:click={generate_summary} disabled={ (submissions_left === 0) }>
        Generate Summary
    </button>
{:else}
    <div id="summaryEngineMetaBlockLoading">
        <div class="screen-reader-text">Loading...</div>
        <Spinner />
    </div>
{/if}