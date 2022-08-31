<?php

class SummaryEnginePost {
    public function __construct() {
        add_action('add_meta_boxes', [ $this, 'summary_meta_block' ]);
        add_action('admin_enqueue_scripts', [ $this, 'enqueue_scripts' ] );
        add_action( 'save_post', [ $this, 'save_meta_block_postdata' ] );
    }

    public function summary_meta_block() {
        if (in_array(get_post_type(), get_option('summaryengine_post_types'))) {
            add_meta_box('summaryengine-meta-box', __('Summary', 'summaryengine'), [ $this, 'summary_meta_block_view' ], get_post_type(), "normal", "high");
        }
    }

    public function summary_meta_block_view() {
        global $post;
        require_once plugin_dir_path( dirname( __FILE__ ) ).'admin/views/summary-meta-block.php';
    }

    public function save_meta_block_postdata( $post_id ) {
        if ( array_key_exists( 'summaryengine_summary', $_POST ) ) {
            update_post_meta(
                $post_id,
                'summaryengine_summary',
                $_POST['summaryengine_summary']
            );
        }
    }

    public function enqueue_scripts() {
        if (!in_array(get_post_type(), get_option('summaryengine_post_types'))) {
            return false;
        }
        wp_enqueue_script( "summaryengine-post-script", plugin_dir_url(__FILE__) . "../../dist/summaryengine.js", [], HEADLINEENGINE_SCRIPT_VERSION, true );
        wp_enqueue_style( "summaryengine-post-style", plugin_dir_url(__FILE__) . "../../dist/summaryengine.css", [], HEADLINEENGINE_SCRIPT_VERSION );
        $script = "var summaryengine_max_number_of_submissions_per_post = " . json_encode(get_option('summaryengine_max_number_of_submissions_per_post')) . ";";
        wp_add_inline_script('summaryengine-post-script', $script, 'before');
    }

}