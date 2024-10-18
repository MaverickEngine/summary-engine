<?php

class SummaryEngineAdminTests {
    public function __construct() {
        add_action('admin_enqueue_scripts', [ $this, 'enqueue_scripts' ]);
        add_action('admin_menu', [ $this, 'add_submenu_page' ]);
    }

    public function add_submenu_page() {
        add_submenu_page(
            'summaryengine',
            'Tests',
            'Tests',
            'manage_options',
            'summaryengine-tests',
            [ $this, 'render_page' ]
        );
    }

    public function enqueue_scripts($hook) {
        if ('summaryengine_page_summaryengine-tests' !== $hook) {
            return;
        }
        wp_enqueue_script('jquery');
    }

    public function render_page() {
        $types = SummaryEngineDB::get_types();
        
        // Get the allowed post types from the option
        $allowed_post_types = get_option('summaryengine_post_types', []);
        
        // If no post types are set, return early or show a message
        if (empty($allowed_post_types)) {
            echo '<p>No post types have been configured for SummaryEngine.</p>';
            return;
        }

        // Prepare meta query to exclude posts with existing summaries
        $meta_query = array('relation' => 'AND');
        foreach ($types as $type) {
            $meta_query[] = array(
                'key' => 'summaryengine_' . $type->slug,
                'compare' => 'NOT EXISTS'
            );
        }

        $recent_posts = get_posts(array(
            'numberposts' => 5,
            'post_status' => 'publish',
            'orderby' => 'date',
            'order' => 'DESC',
            'post_type' => $allowed_post_types,
            'meta_query' => $meta_query
        ));
        include plugin_dir_path(__FILE__) . './views/tests.php';
    }
}
