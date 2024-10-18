<?php
require_once(plugin_dir_path( __FILE__ ) . '../db/summaryengine-db.php');
require_once(plugin_dir_path( __FILE__ ) . '../libs/summaryengine-content.php');
require_once(plugin_dir_path( __FILE__ ) . '../libs/summaryengine-summarise.php');

class SummaryEngineAsync {
    public function __construct() {
        // Add REST API endpoint for testing
        add_action('rest_api_init', [$this, 'register_rest_routes']);
        $summaryengine_summarise_on_publish = get_option('summaryengine_summarise_on_publish', false);
        if (empty($summaryengine_summarise_on_publish)) {
            return;
        }
        add_action('transition_post_status', [ $this, 'post_published' ], 10, 3);
    }

    public function post_published($new_status, $old_status, $post) {
        if ($new_status !== 'publish' || $old_status === 'publish') {
            return;
        }
        if (!is_array(get_option('summaryengine_post_types', [])) || !in_array(get_post_type(), get_option('summaryengine_post_types', []))) {
            return;
        }
        $types = SummaryEngineDB::get_types();
        foreach($types as $type) {
            $summary = get_post_meta($post->ID, 'summaryengine_' . $type->slug, true);
            if (empty($summary)) {
                $this->queue_summary_job($post->ID, $type->ID);
            }
        }
    }

    protected function queue_summary_job(int $post_id, int $type_id) {
        $args = [
            'post_id' => $post_id,
            'type_id' => $type_id,
        ];
        as_enqueue_async_action('summaryengine_generate_summary', $args, 'summaryengine');
    }

    public static function generate_summary($post_id, $type_id) {
        $summarise = new SummaryEngineSummarise();
        $type = SummaryEngineDB::get_type($type_id);
        $summary = get_post_meta($post_id, 'summaryengine_' . $type->slug, true);
        if (!empty($summary)) {
            return;
        }
        $post = get_post($post_id);
        $content = $post->post_content;
        if (empty($content)) {
            return new WP_Error( 'summaryengine_empty_content', __( 'Content is empty', 'summaryengine' ), array( 'status' => 400 ) );
        }
        if (defined('OPENAI_APIKEY')) {
            $apikey = OPENAI_APIKEY;
        } else {
            $apikey = get_option('summaryengine_openai_apikey');
        }
        $result = $summarise->summarise($post_id, $content, $type_id);
        // Set meta data for post
        update_post_meta($post_id, 'summaryengine_' . $type->slug, trim($result['summary']));
        update_post_meta($post_id, 'summaryengine_' . $type->slug . '_id', $result['ID']);
        update_post_meta($post_id, 'summaryengine_' . $type->slug . '_rating', 0);
    }

    public function register_rest_routes() {
        register_rest_route('summaryengine/v1', '/test-summary', [
            'methods' => 'POST',
            'callback' => [$this, 'test_summary_generation'],
            'permission_callback' => function() {
                return current_user_can('edit_posts');
            },
        ]);
    }

    public function test_summary_generation($request) {
        $post_id = $request->get_param('post_id');
        $type_id = $request->get_param('type_id');

        if (!$post_id || !$type_id) {
            return new WP_Error('missing_parameters', 'Post ID and Type ID are required', ['status' => 400]);
        }

        $result = self::generate_summary($post_id, $type_id);

        if (is_wp_error($result)) {
            return $result;
        }

        return new WP_REST_Response([
            'success' => true,
            'message' => 'Summary generated successfully',
            'summary' => get_post_meta($post_id, 'summaryengine_' . SummaryEngineDB::get_type($type_id)->slug, true),
        ], 200);
    }
}
