<?php

class SummaryEnginePost {
    private function wpse_is_gutenberg_editor() { // https://wordpress.stackexchange.com/questions/309862/check-if-gutenberg-is-currently-in-use
        if( function_exists( 'is_gutenberg_page' ) && is_gutenberg_page() ) { 
            return true;
        }   
        
        $current_screen = get_current_screen();
        if ( method_exists( $current_screen, 'is_block_editor' ) && $current_screen->is_block_editor() ) {
            return true;
        }
        return false;
    }

    public function __construct() {
        add_action('admin_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
    }

    public function enqueue_scripts() {
        if (!in_array(get_post_type(), get_option('summaryengine_post_types'))) {
            return false;
        }
        wp_enqueue_script( "summaryengine-post-script", plugin_dir_url(__FILE__) . "../../dist/summaryengine-gutenberg.js", [], HEADLINEENGINE_SCRIPT_VERSION, true );
        wp_enqueue_style( "summaryengine-post-style", plugin_dir_url(__FILE__) . "../../dist/summaryengine-gutenberg.css", [], HEADLINEENGINE_SCRIPT_VERSION );
        $script = "var summaryengine_readability_range_min = " . intval(get_option('summaryengine_readability_range_min', 45)) . ";";
        $script .= "var summaryengine_readability_target = " . intval(get_option('summaryengine_readability_target', 55)) . ";";
        $script .= "var summaryengine_readability_range_max = " . intval(get_option('summaryengine_readability_range_max', 90)) . ";";
        $script .= "var summaryengine_length_range_min = " . intval(get_option('summaryengine_length_range_min', 40)) . ";";
        $script .= "var summaryengine_length_target = " . intval(get_option('summaryengine_length_target', 82)) . ";";
        $script .= "var summaryengine_length_range_max = " . intval(get_option('summaryengine_length_range_max', 90)) . ";";
        $script .= "var summaryengine_powerwords_api = '" . get_rest_url( null, "/summaryengine/v1/powerwords") . "';";
        $script .= "var summaryengine_reading_grade_target = " . intval(get_option('summaryengine_reading_grade_target', 7)) . ";";
        $script .= "var summaryengine_reading_grade_range_min = " . intval(get_option('summaryengine_reading_grade_range_min', 5)) . ";";
        $script .= "var summaryengine_reading_grade_range_max = " . intval(get_option('summaryengine_reading_grade_range_max', 12)) . ";";
        $script .= "var summaryengine_wordcount_target = " . intval(get_option('summaryengine_wordcount_target', 200)) . ";";
        $script .= "var summaryengine_wordcount_range_min = " . intval(get_option('summaryengine_wordcount_range_min', 100)) . ";";
        $script .= "var summaryengine_wordcount_range_max = " . intval(get_option('summaryengine_wordcount_range_max', 300)) . ";";
        $script .= "var summaryengine_readability_enable = " . (get_option('summaryengine_readability_enable') ? 'true' : 'false') . ";";
        $script .= "var summaryengine_length_enable = " . (get_option('summaryengine_length_enable') ? 'true' : 'false') . ";";
        $script .= "var summaryengine_powerwords_enable = " . (get_option('summaryengine_powerwords_enable') ? 'true' : 'false') . ";";
        $script .= "var summaryengine_reading_grade_enable = " . (get_option('summaryengine_reading_grade_enable') ? 'true' : 'false') . ";";
        $script .= "var summaryengine_wordcount_enable = " . (get_option('summaryengine_wordcount_enable') ? 'true' : 'false') . ";";
        wp_add_inline_script('summaryengine-post-script', $script, 'before');
    }

}