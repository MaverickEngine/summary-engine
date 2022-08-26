<?php

class HeadlineEngineAdmin {

    function __construct() {
        add_action('admin_menu', [ $this, 'menu' ]);
        add_action('admin_init', [ $this, 'scripts' ]);
        require_once('headlineengine-admin-settings.php' );
        new HeadlineEngineAdminSettings();
    }

    function menu() {
        add_menu_page(
            'HeadlineEngine',
			'HeadlineEngine',
			'manage_options',
			'headlineengine',
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
        if (get_option('headlineengine_developer_mode')) {
            wp_enqueue_script( "headlineengine-admin-script", plugin_dir_url(__FILE__) . "../../dist/headlineengine-admin.js", [], HEADLINEENGINE_SCRIPT_VERSION, true );
            // wp_enqueue_style( "headlineengine-admin-style", plugin_dir_url(__FILE__) . "../../dist/headlineengine-admin.css", [], HEADLINEENGINE_SCRIPT_VERSION );
        } else {
            wp_enqueue_script( "headlineengine-admin-script", plugin_dir_url(__FILE__) . "../../dist/headlineengine-admin.js", [], HEADLINEENGINE_SCRIPT_VERSION, true );
            // wp_enqueue_style( "headlineengine-admin-style", plugin_dir_url(__FILE__) . "../../dist/headlineengine-admin.css", [], HEADLINEENGINE_SCRIPT_VERSION );
        }
        wp_add_inline_script( "headlineengine-admin-script", "var headlineengine_powerwords_url = '" . plugin_dir_url( __DIR__ ) . "assets/powerwords.txt';", "before" );
    }
}