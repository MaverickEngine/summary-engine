<script>
    import { submissions_left, summaries, summary_text, summary_id, summary_index } from '../stores.js';
    import { apiPost } from '../libs/ajax.js';

    let loading = false;

    const get_content = () => {
        if (jQuery("#titlewrap").length) { // Classic editor
            if (jQuery(".wp-editor-area").is(":visible")) { // The code editor is visible
                // console.log("Code editor is visible");
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
                }
            );
            $summary_id = response.ID;
            $summaries.unshift(response);
            $summary_index = 0;
            $summaries = $summaries;
            $summary_text = response.summary.trim();
            loading = false;
            return;
        } catch (err) {
            alert(err);
            loading = false;
        }
    }
</script>

{#if !loading}
<button id="summaryEngineMetaBlockSummariseButton" type="button" class="button button-primary" on:click={generate_summary} disabled={ ($submissions_left === 0) }>
    Generate Summary
</button>
{:else}
<div id="summaryEngineMetaBlockLoading">
    <div class="screen-reader-text">Loading...</div>
    <div class="summaryengine-spinner">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
    </div>
</div>
{/if}

<style lang="scss">
    .summaryengine-spinner {
        height: 32px;
        width: 32px;
    }

    .summaryengine-spinner div {
        box-sizing: border-box;
        display: block;
        position: absolute;
        width: 32px;
        height: 32px;
        margin: 4px;
        border: 4px solid #444;
        border-radius: 50%;
        animation: summaryengine-spinner 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
        border-color: #444 transparent transparent transparent;
      }
      
      .summaryengine-spinner div:nth-child(1) {
        animation-delay: -0.45s;
      }
      
      .summaryengine-spinner div:nth-child(2) {
        animation-delay: -0.3s;
      }
      
      .summaryengine-spinner div:nth-child(3) {
        animation-delay: -0.15s;
      }
      
      @keyframes summaryengine-spinner {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
</style>
