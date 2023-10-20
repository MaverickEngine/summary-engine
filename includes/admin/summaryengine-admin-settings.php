<?php
require_once(plugin_dir_path( __FILE__ ) . '../libs/summaryengine-openai.php');
class SummaryEngineAdminSettings {
    private $options = [
        "summaryengine_post_types",
        "summaryengine_openai_apikey",
        "summaryengine_openai_timeout",
        "summaryengine_chatgpt_timeout",
        "summaryengine_max_number_of_submissions_per_post",
        "summaryengine_rss_limit",
        "summaryengine_summarise_on_publish",
    ];

    public $defaults = [
        "summaryengine_post_types" => ["post"],
        "summaryengine_openai_apikey" => "",
        "summaryengine_openai_timeout" => 30,
        "summaryengine_chatgpt_timeout" => 30,
        "summaryengine_max_number_of_submissions_per_post" => -1,
        "summaryengine_rss_limit" => 10,
        "summaryengine_summarise_on_publish" => false,
    ];
    
    public function __construct() {
        add_action('admin_menu', [ $this, 'settings_page' ], 30);
        add_action('admin_init', [ $this, 'register_settings' ]);
        add_action('admin_init', [ $this, 'set_defaults' ]);
    }

    public function settings_page() {
        add_submenu_page(
            'summaryengine',
			'SummaryEngine Settings',
			'Settings',
			'manage_options',
			'summaryengine-settings',
			[ $this, 'summaryengine_settings' ]
		);
    }

    public function summaryengine_settings() {
        if (!current_user_can('manage_options')) {
            wp_die('You do not have sufficient permissions to access this page.');
        }
        // Clear the API keys if the constants are set
        if (defined('OPENAI_APIKEY')) {
            update_option('summaryengine_openai_apikey', '');
        }
        if (defined('OPENAI_APIKEY')) {
            update_option('summaryengine_chatgpt_apikey', '');
        }
        if (defined('BARD_APIKEY')) {
            update_option('summaryengine_bard_apikey', '');
        }
        // Check that we can connect...
        try {
            if (defined('OPENAI_APIKEY')) {
                $openai_apikey = OPENAI_APIKEY;
            } else {
                $openai_apikey = get_option('summaryengine_openai_apikey');
            }
            if (defined('OPENAI_APIKEY')) {
                $chatgpt_apikey = OPENAI_APIKEY;
            } else {
                $chatgpt_apikey = get_option('summaryengine_chatgpt_apikey');
            }
            if (defined('BARD_APIKEY')) {
                $bard_apikey = BARD_APIKEY;
            } else {
                $bard_apikey = get_option('summaryengine_bard_apikey');
            }
            $openai = new SummaryEngineOpenAI($openai_apikey);
            $models = $openai->list_models();
            if (is_wp_error($models)) {
                $error = "Could not connect to OpenAI API. Please check your API key.";
                $models = [];
            } else {
                $error = false;
            }
        } catch (Exception $e) {
            $error = "Could not connect to OpenAI API. Please check your API key.";
            $models = [];
        }
        // Handle tabs
        $active_tab = isset( $_GET[ 'tab' ] ) ? $_GET[ 'tab' ] : 'general';
        require_once plugin_dir_path( dirname( __FILE__ ) ).'admin/views/settings.php';
    }

    public function register_settings() {
        foreach($this->options as $option) {
            register_setting( 'summaryengine-settings-group', $option );
        }
    }

    public function set_defaults() {
        $version = get_option('summaryengine_plugin_version', 0);
        if ($version == SUMMARYENGINE_PLUGIN_VERSION) {
            return;
        }
        foreach($this->defaults as $option => $value) {
            if (get_option($option, "_unset") == "_unset") {
                update_option($option, $value);
            }
        }
        update_option('summaryengine_plugin_version', SUMMARYENGINE_PLUGIN_VERSION);
    }
}