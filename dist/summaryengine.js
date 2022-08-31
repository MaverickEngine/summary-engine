(function () {
    'use strict';

    async function main() {
        let submission_count = 0;

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

        const get_submissions_count = async () => {
            return new Promise((resolve, reject) => {
                jQuery("#summaryEngineMetaBlockSummariseButtonContainer").addClass("summaryengine-loading");
                wp.apiRequest({
                    path: "summaryengine/v1/post/count/" + jQuery("#post_ID").val(),
                    type: "GET",
                })
                .fail(async (response) => {
                    console.log("Error getting submission count");
                    console.log(response);
                    reject(response);
                })
                .done(async (response) => {
                    if (response.error) {
                        console.log("Error getting submission count");
                        console.log(response);
                        reject(response);
                    }
                    if (response.count) {
                        resolve(response.count);
                    } else {
                        reject("No count returned");
                    }
                }).always(async () => {
                    jQuery("#summaryEngineMetaBlockSummariseButtonContainer").removeClass("summaryengine-loading");
                });
            });
        };

        const use_submission = () => {
            submission_count++;
            jQuery("#summaryEngineSubmissionsLeft").text(Number(summaryengine_max_number_of_submissions_per_post) - submission_count);
            check_submissions();
        };

        const check_submissions = () => {
            if (summaryengine_max_number_of_submissions_per_post < 0) {
                jQuery("#summaryEngineSubmissionsLeft").html("&infin;");
                return;
            }        const submissions_left = Number(summaryengine_max_number_of_submissions_per_post) - submission_count;
            if (submission_count >= summaryengine_max_number_of_submissions_per_post) {
                jQuery("#summaryEngineSubmissionsLeft").text(0);
                jQuery("#summaryEngineMetaBlockSummariseButton").attr("disabled", "disabled");
                jQuery("#summaryEngineMetaBlockSummariseButtonContainer").addClass("summaryengine-disabled");
            }
            if (submissions_left === 1) {
                jQuery("#summaryEngineSubmissionsLeftLabel").text("submission left");
            } else {
                jQuery("#summaryEngineSubmissionsLeftLabel").text("submissions left");
            }
            jQuery("#summaryEngineSubmissionsLeft").text(submissions_left);
        };

        jQuery(async () => {
            submission_count = await get_submissions_count();
            check_submissions();
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
                            post_id: jQuery("#post_ID").val(),
                        },
                        type: "POST",
                    })
                    .done(async (response) => {
                        if (response.error) {
                            alert(response.error.message || response.error);
                            return;
                        }
                        use_submission();
                        jQuery("#summaryEngineSummary").val(response.choices[0].text.trim());
                    })
                    .fail(async (response) => {
                        if (response.responseJSON?.message) {
                            alert(response.responseJSON?.message);
                            return;
                        }
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
