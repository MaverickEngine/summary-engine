<?php
class SummaryEngineReports {
    public function __construct() {
        add_action('admin_menu', [ $this, 'reports_page' ], 20);
    }

    public function reports_page() {
        add_submenu_page(
            'summaryengine',
			'SummaryEngine Reports',
			'Reports',
			'edit_others_posts',
			'summaryengine-reports',
			[ $this, 'summaryengine_reports' ]
		);
    }

    public function summaryengine_reports() {
        if (!current_user_can('edit_others_posts')) {
            wp_die('You do not have sufficient permissions to access this page.');
        }
        wp_enqueue_script( "summaryengine-reports-script", plugin_dir_url(__FILE__) . "../../dist/summaryengine-reports.js", ['wp-api',], SUMMARYENGINE_SCRIPT_VERSION, true );
        wp_enqueue_style( "summaryengine-reports-style", plugin_dir_url(__FILE__) . "../../dist/summaryengine-reports.css", [], SUMMARYENGINE_SCRIPT_VERSION );
        require_once plugin_dir_path( dirname( __FILE__ ) ).'admin/views/reports.php';
    }
}