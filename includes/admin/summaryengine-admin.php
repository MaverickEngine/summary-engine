<?php

class SummaryEngineAdmin {

    function __construct() {
        add_action('admin_menu', [ $this, 'menu' ]);
        add_action('admin_enqueue_scripts', [ $this, 'scripts' ]);
        require_once('summaryengine-admin-settings.php' );
        new SummaryEngineAdminSettings();
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
        var summaryengine_settings = {
            openai_model: '" . esc_js(get_option("summaryengine_openai_model"), "text-davinci-002") . "',
            openai_word_limit: " . intval(get_option("summaryengine_openai_word_limit", 750)) . ", 
            openai_frequency_penalty: " . floatval(get_option("summaryengine_openai_frequency_penalty", 0.5)) . ",
            openai_max_tokens: " . floatval(get_option("summaryengine_openai_max_tokens", 300)) . ",
            openai_presence_penalty: " . floatval(get_option("summaryengine_openai_presence_penalty", 0)) . ",
            openai_temperature: " . floatval(get_option("summaryengine_openai_temperature", 0.6)) . ",
            openai_top_p: " . floatval(get_option("summaryengine_openai_top_p", 1)) . ",
            openai_prompt: '" . esc_js(get_option("summaryengine_openai_prompt", "Summarize in 100 words: ")) . "'
        };    
        ", "before" );
    }
}