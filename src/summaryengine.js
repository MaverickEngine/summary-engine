import "./summaryengine.scss";
import summarise from "./libs/summarise.ts";

async function main() {
    const get_content = () => {
        if (jQuery("#titlewrap").length) { // Classic editor
            if (jQuery(".wp-editor-area").is(":visible")) { // The code editor is visible
                console.log("Code editor is visible");
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
    let editor_type = "gututenberg";
    jQuery(async () => {
        if (jQuery("#titlewrap").length) {
            editor_type = "classic";
        }
        jQuery("#summaryEngineMetaBlockSummariseButton").on("click", async () => {
            const content = get_content();
            if (!content.length) {
                alert("Nothing to summarise yet...");
                return;
            }
            jQuery("#summaryEngineMetaBlockSummariseButtonContainer").addClass("summaryengine-loading");
            const summarised = await summarise(content);
            jQuery("#summaryEngineSummary").val(summarised);
            jQuery("#summaryEngineMetaBlockSummariseButtonContainer").removeClass("summaryengine-loading");
        });
    });
}

main();