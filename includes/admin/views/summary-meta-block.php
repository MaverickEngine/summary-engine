<div id="summaryEngineMetaBlock">
    <input type="hidden" name="summaryengine_summary_id" id="summaryEngineSummaryId" value="<?php echo esc_attr(get_post_meta($post->ID, 'summaryengine_summary_id', -1)); ?>" />
    <label class="screen-reader-text" for="summary">Summary</label>
    <textarea rows="1" cols="40" name="summaryengine_summary" id="summaryEngineSummary" class="summaryengine-textarea"><?php echo esc_textarea(get_post_meta( $post->ID, 'summaryengine_summary', true )); ?></textarea>
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
            <div id="summaryEngineRate" class="summaryengine-hidden">
                <div id="summaryEngineRateIcons">
                    <span id="summaryEngineRateGood" data-rating="1" class="summaryengine-rate-icon">&#128077;</span>
                    <span id="summaryEngineRateBad" class="summaryengine-rate-icon" data-rating="-1">&#128078;</span>
                </div>
                <span id="summaryEngineRateLabel">How do you rate this summary?</span>
                <span id="summaryEngineFeedback" class="summaryengine-hidden">Thanks for the feedback!</span>
            </div>
        </div>
    </p>
</div>