<?php
class SummaryEngineAdminTypes {
    public function __construct() {
        add_action('admin_menu', [ $this, 'types_page' ], 40);
    }

    public function types_page() {
        add_submenu_page(
            'summaryengine',
			'SummaryEngine Types',
			'Types',
			'manage_options',
			'summaryengine-types',
			[ $this, 'summaryengine_types' ]
		);
    }

    public function summaryengine_types() {
        if (!current_user_can('manage_options')) {
            wp_die('You do not have sufficient permissions to access this page.');
        }
        wp_enqueue_script( "summaryengine-types-script", plugin_dir_url(__FILE__) . "../../dist/summaryengine-types.js", ['wp-api',], SUMMARYENGINE_SCRIPT_VERSION, true );
        wp_enqueue_style( "summaryengine-types-style", plugin_dir_url(__FILE__) . "../../dist/summaryengine-types.css", [], SUMMARYENGINE_SCRIPT_VERSION );
        require_once plugin_dir_path( dirname( __FILE__ ) ).'admin/views/types.php';
    }
}