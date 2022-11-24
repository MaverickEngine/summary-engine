<?php
class SummaryEngineReview {
    public function __construct() {
        add_action('admin_menu', [ $this, 'review_page' ], 10);
    }

    public function review_page() {
        add_submenu_page(
            'summaryengine',
			'SummaryEngine Review',
			'Review',
			'manage_options',
			'summaryengine',
			[ $this, 'summaryengine_review' ]
		);
    }

    public function summaryengine_review() {
        if (!current_user_can('manage_options')) {
            wp_die('You do not have sufficient permissions to access this page.');
        }
        wp_enqueue_script( "summaryengine-review-script", plugin_dir_url(__FILE__) . "../../dist/summaryengine-review.js", ['wp-api',], SUMMARYENGINE_SCRIPT_VERSION, true );
        wp_enqueue_style( "summaryengine-review-style", plugin_dir_url(__FILE__) . "../../dist/summaryengine-review.css", [], SUMMARYENGINE_SCRIPT_VERSION );
        require_once plugin_dir_path( dirname( __FILE__ ) ).'admin/views/review.php';
    }
}