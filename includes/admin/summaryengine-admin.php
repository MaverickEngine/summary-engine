<?php

class SummaryEngineAdmin {

    function __construct() {
        add_action('admin_menu', [ $this, 'menu' ]);
        add_action('admin_init', [ $this, 'scripts' ]);
        require_once('summaryengine-admin-settings.php' );
        new SummaryEngineAdminSettings();
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
		return 'data:image/svg+xml;base64,' . base64_encode(file_get_contents($svg_icon_file));
	}

    public function scripts() {
        wp_enqueue_script( "summaryengine-admin-script", plugin_dir_url(__FILE__) . "../../dist/summaryengine-admin.js", [], HEADLINEENGINE_SCRIPT_VERSION, true );
        // wp_enqueue_style( "summaryengine-admin-style", plugin_dir_url(__FILE__) . "../../dist/summaryengine-admin.css", [], HEADLINEENGINE_SCRIPT_VERSION );
        // wp_add_inline_script( "summaryengine-admin-script", "var summaryengine_powerwords_url = '" . plugin_dir_url( __DIR__ ) . "assets/powerwords.txt';", "before" );
    }
}