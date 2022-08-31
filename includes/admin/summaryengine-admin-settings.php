<?php
class SummaryEngineAdminSettings {
    private $options = [
        "summaryengine_post_types",
        "summaryengine_openai_apikey",
        "summaryengine_openai_model",
        "summaryengine_openai_word_limit",
        "summaryengine_cut_at_paragraph",
        "summaryengine_openai_frequency_penalty",
        "summaryengine_openai_max_tokens",
        "summaryengine_openai_presence_penalty",
        "summaryengine_openai_temperature",
        "summaryengine_openai_top_p",
        "summaryengine_openai_prompt",
        "summaryengine_max_number_of_submissions_per_post",
    ];

    public $defaults = [
        "summaryengine_post_types" => ["post"],
        "summaryengine_openai_apikey" => "",
        "summaryengine_openai_model" => "text-davinci-002",
        "summaryengine_openai_word_limit" => 750,
        "summaryengine_cut_at_paragraph" => true,
        "summaryengine_openai_frequency_penalty" => 0.5,
        "summaryengine_openai_max_tokens" => 300,
        "summaryengine_openai_presence_penalty" => 0,
        "summaryengine_openai_temperature" => 0.6,
        "summaryengine_openai_top_p" => 1,
        "summaryengine_openai_prompt" => "Summarize in 100 words: ",
        "summaryengine_max_number_of_submissions_per_post" => 3,
    ];
    
    public function __construct() {
        add_action('admin_menu', [ $this, 'settings_page' ]);
        add_action('admin_init', [ $this, 'register_settings' ]);
        add_action('admin_init', [ $this, 'set_defaults' ]);
    }

    public function settings_page() {
        add_submenu_page(
            'summaryengine',
			'SummaryEngine Settings',
			'Settings',
			'manage_options',
			'summaryengine',
			[ $this, 'summaryengine_settings' ]
		);
    }

    public function summaryengine_settings() {
        if (!current_user_can('manage_options')) {
            wp_die(__('You do not have sufficient permissions to access this page.'));
        }
        
        require_once plugin_dir_path( dirname( __FILE__ ) ).'admin/views/settings.php';
    }

    public function register_settings() {
        foreach($this->options as $option) {
            register_setting( 'summaryengine-settings-group', $option );
        }
    }

    public function set_defaults() {
        $version = get_option('summaryengine_plugin_version');
        if ($version == SUMMARYENGINE_PLUGIN_VERSION) {
            return;
        }
        foreach($this->defaults as $option => $value) {
            if (!get_option($option)) {
                update_option($option, $value);
            }
        }
        update_option('summaryengine_plugin_version', SUMMARYENGINE_PLUGIN_VERSION);
    }
}