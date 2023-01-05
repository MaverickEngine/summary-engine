<?php

class SummaryEngineAdmin {

    function __construct() {
        add_action('admin_menu', [ $this, 'menu' ]);
        add_action('admin_enqueue_scripts', [ $this, 'scripts' ]);
        require_once('summaryengine-admin-review.php' );
        new SummaryEngineReview();
        require_once('summaryengine-admin-settings.php' );
        new SummaryEngineAdminSettings();
        require_once('summaryengine-admin-types.php' );
        new SummaryEngineAdminTypes();
        require_once('summaryengine-admin-reports.php' );
        new SummaryEngineReports();
    }

    function menu() {
        add_menu_page(
            'SummaryEngine',
			'SummaryEngine',
			'manage_options',
			'summaryengine',
			null,
            $this->get_plugin_icon(),
            30
        );
    }

    private function get_plugin_icon() {
		$svg_icon_file = plugin_dir_path( dirname( __FILE__ ) ).'/assets/mavengine-icon-black.svg';
		if (!file_exists($svg_icon_file)) {
			return false;
		}
        // phpcs:ignore
		return 'data:image/svg+xml;base64,' . base64_encode(file_get_contents($svg_icon_file));
	}

    public function scripts() {
        global $post;
        if (empty($post)) {
            return;
        }
        wp_enqueue_script( "summaryengine-admin-script", plugin_dir_url(__FILE__) . "../../dist/summaryengine-admin.js", [], SUMMARYENGINE_SCRIPT_VERSION, true );
        wp_add_inline_script( "summaryengine-admin-script", 
        "var summaryengine_summary = " . wp_json_encode(get_post_meta( $post->ID, 'summaryengine_summary', true )) .  "; 
        ", "before" );
    }
}