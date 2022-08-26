(function () {
    'use strict';

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
        };
        jQuery(async () => {
            jQuery("#summaryEngineMetaBlockSummariseButton").on("click", async () => {
                const content = get_content();
                if (!content.length) {
                    alert("Nothing to summarise yet...");
                    return;
                }
                try {
                    jQuery("#summaryEngineMetaBlockSummariseButtonContainer").addClass("summaryengine-loading");
                    wp.apiRequest({
                        path: "summaryengine/v1/summarise",
                        data: {
                            content: content,
                        },
                        type: "POST",
                    })
                    .done(async (response) => {
                        if (response.error) {
                            alert(response.error.message || response.error);
                            return;
                        }
                        jQuery("#summaryEngineSummary").val(response.choices[0].text.trim());
                    })
                    .fail(async (response) => {
                        throw response.error.message || response.error;
                    }).always(async () => {
                        jQuery("#summaryEngineMetaBlockSummariseButtonContainer").removeClass("summaryengine-loading");
                    });
                    return;
                } catch (err) {
                    console.error(err);
                    alert(err);
                }
            });
        });
    }

    main();

})();
//# sourceMappingURL=summaryengine.js.map
