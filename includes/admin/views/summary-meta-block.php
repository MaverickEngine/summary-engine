<div id="summaryEngineMetaBlock">
    <label class="screen-reader-text" for="summary">Summary</label>
    <textarea rows="1" cols="40" name="summaryengine_summary" id="summaryEngineSummary" class="summaryengine-textarea"><?php echo get_post_meta( $post->ID, 'summaryengine_summary', true ); ?></textarea>
    <p>
        <div id="summaryEngineMetaBlockSummariseButtonContainer">
            <button id="summaryEngineMetaBlockSummariseButton" type="button" class="button button-primary" id="summaryengine-post-button">
                <?php _e("Generate summary", "summaryengine") ?>
            </button>
            <div id="summaryEngineMetaBlockLoading">
                <div class="screen-reader-text">Loading...</div>
                <div class="summaryengine-spinner">
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                </div>
            </div>
        
            <div id="summaryEngineCounter">
                <span id="summaryEngineSubmissionsLeft">...</span>
                <span id="summaryEngineSubmissionsLeftLabel">submissions left</span>
            </div>
        </div>
    </p>
</div>