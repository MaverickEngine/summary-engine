import { apiPost } from "wp-ajax";

function get_content() {
    if (jQuery("#titlewrap").length) { // Classic editor
        console.log("Classic editor")
        if (jQuery(".wp-editor-area").is(":visible")) { // The code editor is visible
            console.log("Code editor");
            return jQuery(".wp-editor-area").val();
        } else if (window.tinymce) { // The visual editor is visible
            console.log("TinyMCE editor");
            let content = tinymce.editors.content.getContent();
            if (content.length > 0) {
                return content;
            }
        }
        return jQuery("#content").val(); // Last try...
    } else { // Gutenberg editor
        return wp.data.select( "core/editor" ).getEditedPostContent();
    }
}

function strip_tags(html) {
    let tmp = document.createElement("div");
    tmp.innerHTML = html
        .replace(/(<(br[^>]*)>)/ig, '\n')
        .replace(/(<(p[^>]*)>)/ig, '\n')
        .replace(/(<(div[^>]*)>)/ig, '\n')
        .replace(/(<(h[1-6][^>]*)>)/ig, '\n')
        .replace(/(<(li[^>]*)>)/ig, '\n')
        .replace(/(<(ul[^>]*)>)/ig, '\n')
        .replace(/(<(ol[^>]*)>)/ig, '\n')
        .replace(/(<(blockquote[^>]*)>)/ig, '\n')
        .replace(/(<(pre[^>]*)>)/ig, '\n')
        .replace(/(<(hr[^>]*)>)/ig, '\n')
        .replace(/(<(table[^>]*)>)/ig, '\n')
        .replace(/(<(tr[^>]*)>)/ig, '\n')
        .replace(/(<(td[^>]*)>)/ig, '\n')
        .replace(/(<(th[^>]*)>)/ig, '\n')
        .replace(/(<(caption[^>]*)>)/ig, '\n')
        .replace(/(<(dl[^>]*)>)/ig, '\n')
        .replace(/(<(dt[^>]*)>)/ig, '\n')
        .replace(/(<(dd[^>]*)>)/ig, '\n')
        .replace(/(<(address[^>]*)>)/ig, '\n')
        .replace(/(<(section[^>]*)>)/ig, '\n')
        .replace(/(<(article[^>]*)>)/ig, '\n')
        .replace(/(<(aside[^>]*)>)/ig, '\n');
    return tmp.textContent || tmp.innerText || "";
}

export async function generate_summary(type) {
    console.log("Getting content...")
    const content = strip_tags(get_content());
    if (!content.length) {
        alert("Nothing to summarise yet...");
        return;
    }
    console.log({ content });
    try {
        const data = {
            content: content,
            post_id: jQuery("#post_ID").val(),
            // settings: JSON.stringify(settings),
            type_id: type.ID,
        };
        console.log(data);
        const response = (await apiPost("summaryengine/v1/summarise", data)).result;
        return response;
        // console.log(response);
        // summary_id = response.ID;
        // summaries.unshift(response);
        // summary_index = 0;
        // summaries = summaries;
        // summary_text = response.summary.trim();
        // loading = false;
        // submissions_left--;
        // console.log({ summary_id, summaries, summary_index, summary_text, submissions_left });
        return;
    } catch (err) {
        if (err.message) throw err.message;
        throw err;
    }
}