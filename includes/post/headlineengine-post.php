<?php

class HeadlineEnginePost {
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
        if (!in_array(get_post_type(), get_option('headlineengine_post_types'))) {
            return false;
        }
        wp_enqueue_script( "headlineengine-post-script", plugin_dir_url(__FILE__) . "../../dist/headlineengine-gutenberg.js", [], HEADLINEENGINE_SCRIPT_VERSION, true );
        wp_enqueue_style( "headlineengine-post-style", plugin_dir_url(__FILE__) . "../../dist/headlineengine-gutenberg.css", [], HEADLINEENGINE_SCRIPT_VERSION );
        $script = "var headlineengine_readability_range_min = " . intval(get_option('headlineengine_readability_range_min', 45)) . ";";
        $script .= "var headlineengine_readability_target = " . intval(get_option('headlineengine_readability_target', 55)) . ";";
        $script .= "var headlineengine_readability_range_max = " . intval(get_option('headlineengine_readability_range_max', 90)) . ";";
        $script .= "var headlineengine_length_range_min = " . intval(get_option('headlineengine_length_range_min', 40)) . ";";
        $script .= "var headlineengine_length_target = " . intval(get_option('headlineengine_length_target', 82)) . ";";
        $script .= "var headlineengine_length_range_max = " . intval(get_option('headlineengine_length_range_max', 90)) . ";";
        $script .= "var headlineengine_powerwords_api = '" . get_rest_url( null, "/headlineengine/v1/powerwords") . "';";
        $script .= "var headlineengine_reading_grade_target = " . intval(get_option('headlineengine_reading_grade_target', 7)) . ";";
        $script .= "var headlineengine_reading_grade_range_min = " . intval(get_option('headlineengine_reading_grade_range_min', 5)) . ";";
        $script .= "var headlineengine_reading_grade_range_max = " . intval(get_option('headlineengine_reading_grade_range_max', 12)) . ";";
        $script .= "var headlineengine_wordcount_target = " . intval(get_option('headlineengine_wordcount_target', 200)) . ";";
        $script .= "var headlineengine_wordcount_range_min = " . intval(get_option('headlineengine_wordcount_range_min', 100)) . ";";
        $script .= "var headlineengine_wordcount_range_max = " . intval(get_option('headlineengine_wordcount_range_max', 300)) . ";";
        $script .= "var headlineengine_readability_enable = " . (get_option('headlineengine_readability_enable') ? 'true' : 'false') . ";";
        $script .= "var headlineengine_length_enable = " . (get_option('headlineengine_length_enable') ? 'true' : 'false') . ";";
        $script .= "var headlineengine_powerwords_enable = " . (get_option('headlineengine_powerwords_enable') ? 'true' : 'false') . ";";
        $script .= "var headlineengine_reading_grade_enable = " . (get_option('headlineengine_reading_grade_enable') ? 'true' : 'false') . ";";
        $script .= "var headlineengine_wordcount_enable = " . (get_option('headlineengine_wordcount_enable') ? 'true' : 'false') . ";";
        wp_add_inline_script('headlineengine-post-script', $script, 'before');
    }

}