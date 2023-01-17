<?php

require_once(plugin_dir_path( __FILE__ ) . '../libs/openapi.php');
require_once(plugin_dir_path( __FILE__ ) . '../db/summaryengine-db.php');
require_once(plugin_dir_path( __FILE__ ) . '../libs/summaryengine-content.php');

class SummaryEngineAPI {
    public function __construct() {
        global $wpdb;
        $this->table_name = $wpdb->prefix . 'summaryengine_summaries';
        add_action( 'rest_api_init', array( $this, 'register_api_routes' ) );
    }
    
    public function register_api_routes() {
        register_rest_route('summaryengine/v1', '/models', array(
            'methods' => 'GET',
            'callback' => array( $this, 'get_models' ),
            'permission_callback' => function () {
                return current_user_can( 'edit_others_posts' );
            }
        ));

        register_rest_route( 'summaryengine/v1', '/summarise', array(
            'methods' => 'POST',
            'callback' => array( $this, 'post_summarise' ),
            'permission_callback' => function () {
                return current_user_can( 'edit_others_posts' );
            }
        ));

        register_rest_route('summaryengine/v1', '/post/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => array( $this, 'get_post_summaries' ),
            'permission_callback' => function () {
                return current_user_can( 'edit_others_posts' );
            }
        ));
        register_rest_route('summaryengine/v1', '/post/count/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => array( $this, 'get_post_summaries_count' ),
            'permission_callback' => function () {
                return current_user_can( 'edit_others_posts' );
            }
        ));
        register_rest_route('summaryengine/v1', '/rate/(?P<id>\d+)', array(
            'methods' => 'POST',
            'callback' => array( $this, 'post_rate_summary' ),
            'permission_callback' => function () {
                return current_user_can( 'edit_others_posts' );
            }
        ));
        register_rest_route('summaryengine/v1', '/summary/(?P<id>\d+)', array(
            'methods' => 'POST',
            'callback' => array( $this, 'post_summary' ),
            'permission_callback' => function () {
                return current_user_can( 'edit_others_posts' );
            }
        ));
        // Edit existing summary
        register_rest_route('summaryengine/v1', '/summary/(?P<id>\d+)', array(
            'methods' => 'PUT',
            'callback' => array( $this, 'put_summary' ),
            'permission_callback' => function () {
                return current_user_can( 'edit_others_posts' );
            }
        ));
        register_rest_route('summaryengine/v1', '/summary/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => array( $this, 'get_post_summary' ),
            'permission_callback' => function () {
                return current_user_can( 'edit_others_posts' );
            }
        ));
        register_rest_route('summaryengine/v1', '/reports', array(
            'methods' => 'GET',
            'callback' => array( $this, 'get_reports' ),
            'permission_callback' => function () {
                return current_user_can( 'edit_others_posts' );
            }
        ));
        
        register_rest_route('summaryengine/v1', '/report/by_period', array(
            'methods' => 'GET',
            'callback' => array( $this, 'get_reports_by_period' ),
            'permission_callback' => function () {
                return current_user_can( 'edit_others_posts' );
            }
        ));

        register_rest_route('summaryengine/v1', '/types', array(
            'methods' => 'GET',
            'callback' => array( $this, 'get_types' ),
            'permission_callback' => function () {
                return current_user_can( 'edit_others_posts' );
            }
        ));

        register_rest_route('summaryengine/v1', '/type/(?P<id>\d+)', array(
            'methods' => 'POST',
            'callback' => array( $this, 'post_type' ),
            'permission_callback' => function () {
                return current_user_can( 'edit_others_posts' );
            }
        ));

        register_rest_route('summaryengine/v1', '/type/(?P<id>\d+)', array(
            'methods' => 'DELETE',
            'callback' => array( $this, 'delete_type' ),
            'permission_callback' => function () {
                return current_user_can( 'edit_others_posts' );
            }
        ));

        register_rest_route('summaryengine/v1', '/type', array(
            'methods' => 'POST',
            'callback' => array( $this, 'post_type' ),
            'permission_callback' => function () {
                return current_user_can( 'edit_others_posts' );
            }
        ));
        
        register_rest_route('summaryengine/v1', '/posts', array(
            'methods' => 'GET',
            'callback' => array( $this, 'get_posts' ),
            'permission_callback' => function () {
                return current_user_can( 'edit_others_posts' );
            }
        ));

        register_rest_route('summaryengine/v1', '/posts_count', array(
            'methods' => 'GET',
            'callback' => array( $this, 'get_posts_count' ),
            'permission_callback' => function () {
                return current_user_can( 'edit_others_posts' );
            }
        ));

        register_rest_route('summaryengine/v1', '/post_months', array(
            'methods' => 'GET',
            'callback' => array( $this, 'get_post_months' ),
            'permission_callback' => function () {
                return current_user_can( 'edit_others_posts' );
            }
        ));
    }

    public function get_models() {
        $apikey = OPENAI_APIKEY ?? get_option('summaryengine_openai_apikey');
        $openapi = new OpenAPI($apikey);
        $models = $openapi->list_models();
        return $models;
    }

    public function get_post_summaries(WP_REST_Request $request) {
        global $wpdb;
        $post_id = $request->get_param('id');
        $type_id = $request->get_param('type_id');
        if (empty($type_id)) {
            $type_id = 1;
        }
        $type = SummaryEngineDB::get_type($type_id);
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $result = $wpdb->get_results( $wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}summaryengine_summaries WHERE post_id = %d AND type_id=%d ORDER BY created_at DESC",
            $post_id, $type_id
        ));
        // Find active summary
        $summary_id = get_post_meta($post_id, 'summaryengine_' . $type->slug . '_id', true);
        foreach($result as $summary) {
            if ($summary->ID == $summary_id) {
                $summary->active = true;
            } else {
                $summary->active = false;
            }
        }
        return $result;
    }

    public function get_post_summaries_count(WP_REST_Request $request) {
        global $wpdb;
        $id = $request->get_param('id');
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $result = $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}summaryengine_summaries WHERE post_id = %d ORDER BY created_at DESC",
            $id
        ));
        return array("count" => $result);
    }

    public function post_summarise(WP_REST_Request $request) {
        global $wpdb;
        try {
            $post_id = intval($request->get_param('post_id'));
            if (empty($post_id)) {
                throw new Exception("Post ID is empty");
            }
            if (empty($request->get_param('content'))) {
                // Get content from post
                $post = get_post($post_id);
                $content = wp_strip_all_tags($post->post_content);
            } else {
                $content = wp_strip_all_tags($request->get_param('content'));
            }
            $type_id = $request->get_param('type_id');
            if (empty($type_id)) {
                throw new Exception("Type ID is empty");
            }
            $type = SummaryEngineDB::get_type($type_id);
            $type_settings = [
                'openai_model' => $type->openai_model,
                'openai_prompt' => $type->openai_prompt,
                'openai_append_prompt' => $type->openai_append_prompt,
                'openai_max_tokens' => $type->openai_max_tokens,
                'openai_temperature' => $type->openai_temperature,
                'openai_top_p' => $type->openai_top_p,
                'openai_frequency_penalty' => $type->openai_frequency_penalty,
                'openai_presence_penalty' => $type->openai_presence_penalty,
            ];
            $user_settings = json_decode($request->get_param('settings'), true);
            if (empty($user_settings)) {
                $user_settings = [];
            }
            $settings = array_merge($type_settings, $user_settings);
            // Make sure we still have submissions left
            $max_number_of_submissions_per_post = intval(get_option('summaryengine_max_number_of_submissions_per_post'));
            if ($max_number_of_submissions_per_post > 0) {
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery
                $number_of_submissions = $wpdb->get_var( $wpdb->prepare(
                    "SELECT COUNT(*) FROM {$wpdb->prefix}summaryengine_summaries WHERE post_id = %d AND type_id=%d",
                    $post_id, $type_id
                ));
                if ($number_of_submissions >= $max_number_of_submissions_per_post) {
                    return new WP_Error( 'too_many_submissions', "You have already submitted this post for automated summary a maxiumum number of $max_number_of_submissions_per_post times.", array( 'status' => 400 ) );
                }
            }
            $cut_at_paragraph = get_option( "summaryengine_cut_at_paragraph", false );
            $wordcount = get_option( "summaryengine_openai_word_limit", 750 );
            if ($cut_at_paragraph) {
                $content = SummaryEngineContent::cut_at_paragraph($content, $wordcount);
            } else {
                $content = SummaryEngineContent::cut_at_wordcount($content, $wordcount);
            }
            if (empty($content)) {
                return new WP_Error( 'summaryengine_empty_content', __( 'Content is empty', 'summaryengine' ), array( 'status' => 400 ) );
            }
            $apikey = OPENAI_APIKEY ?? get_option('summaryengine_openai_apikey');
            $openapi = new OpenAPI($apikey);
            $original_prompt =  $settings["openai_prompt"] ?? get_option('summaryengine_openai_prompt');
            $original_append_prompt = $settings["openai_append_prompt"] ?? get_option('summaryengine_openai_append_prompt');
            $params = array(
                'model' => get_option( 'summaryengine_openai_model'),
                'frequency_penalty' => floatval(get_option( 'summaryengine_openai_frequency_penalty')),
                'max_tokens' => floatval(get_option( 'summaryengine_openai_max_tokens')),
                'presence_penalty' => floatval(get_option( 'summaryengine_openai_presence_penalty')),
                'temperature' => floatval(get_option( 'summaryengine_openai_temperature')),
                'top_p' => floatval(get_option( 'summaryengine_openai_top_p')),
                'prompt' => $original_prompt . "\n\n" . $content . "\n\n" . $original_append_prompt,
            );
            if (isset($settings["openai_model"])) {
                $params['model'] = $settings["openai_model"];
            }
            if (isset($settings["openai_frequency_penalty"])) {
                $params['frequency_penalty'] = floatval($settings["openai_frequency_penalty"]);
            }
            if (isset($settings["openai_max_tokens"])) {
                $params['max_tokens'] = intval($settings["openai_max_tokens"]);
            }
            if (isset($settings["openai_presence_penalty"])) {
                $params['presence_penalty'] = floatval($settings["openai_presence_penalty"]);
            }
            if (isset($settings["openai_temperature"])) {
                $params['temperature'] = floatval($settings["openai_temperature"]);
            }
            if (isset($settings["openai_top_p"])) {
                $params['top_p'] = floatval($settings["openai_top_p"]);
            }
            $summary = $openapi->summarise($params);
            if (empty($summary)) throw new Exception("Did not receive a valid summary from OpenAI");
            $result = SummaryEngineDB::save_summary($post_id, $type_id, $content, $original_prompt, $original_append_prompt, $params, $summary);
            // Set meta data for post
            update_post_meta($post_id, 'summaryengine_' . $type->slug, trim($result['summary']));
            update_post_meta($post_id, 'summaryengine_' . $type->slug . '_id', $result['ID']);
            update_post_meta($post_id, 'summaryengine_' . $type->slug . '_rating', 0);
            return $result;
        } catch (Exception $e) {
            return new WP_Error( 'summaryengine_api_error', __( 'Error summarising content: ' . $e->getMessage(), 'summaryengine' ), array( 'status' => 500 ) );
        }
    }

    public function post_rate_summary(WP_REST_Request $request) {
        global $wpdb;
        $id = $request->get_param('id');
        $rating = $request->get_param('rating');
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $summary = $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}summaryengine_summaries WHERE ID = %d",
            $id
        ));
        $type = SummaryEngineDB::get_type($summary->type_id);
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $wpdb->update(
            $this->table_name,
            array(
                'rating' => $rating,
            ),
            array(
                'ID' => $id,
            ),
            array(
                '%d',
            ),
        );
        // Check for errors
        if ($wpdb->last_error !== '') {
            return new WP_Error( 'summaryengine_api_error', __( 'Error rating summary', 'summaryengine' ), array( 'status' => 500 ) );
        }
        update_post_meta($summary->post_id, 'summaryengine_' . $type->slug . '_rating', $rating);
        return array("success" => true);
    }

    public function post_summary(WP_REST_Request $request) {
        $post_id = $request->get_param('id');
        $summary = $request->get_param('summary');
        $summary_id = $request->get_param('summary_id');
        $type_id = $request->get_param('type_id');
        $type = SummaryEngineDB::get_type($type_id);
        if (empty($type)) {
            return new WP_Error( 'summaryengine_api_error', __( 'Type not found', 'summaryengine' ), array( 'status' => 404 ) );
        }
        if (empty($summary_id)) {
            return new WP_Error('rest_custom_error', 'summary_id is required', array('status' => 400));
        }
        if (empty($summary)) {
            return new WP_Error('rest_custom_error', 'summary is required', array('status' => 400));
        }
        update_post_meta($post_id, 'summaryengine_' . $type->slug, sanitize_text_field(trim($summary)));
        update_post_meta($post_id, 'summaryengine_' . $type->slug . '_id', intval($summary_id));
        return array("success" => true);
    }

    // Edit existing summary
    public function put_summary(WP_REST_Request $request) {
        global $wpdb;
        $summary_id = $request->get_param('id');
        $summary = $request->get_param('summary');
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $wpdb->update(
            $this->table_name,
            array(
                'summary' => $summary,
                'edited_at' => current_time('mysql', 1),
                'edited_by' => get_current_user_id(),
            ),
            array(
                'ID' => $summary_id,
            ),
            array(
                '%s',
                '%s',
                '%d',
            ),
        );
        // Check for errors
        if ($wpdb->last_error !== '') {
            return new WP_Error( 'summaryengine_api_error', __( 'Error updating summary', 'summaryengine' ), array( 'status' => 500 ) );
        }
        // Set new summary in post meta
        $summary = SummaryEngineDB::get_summary($summary_id);
        $type = SummaryEngineDB::get_type($summary->type_id);
        update_post_meta($summary->post_id, 'summaryengine_' . $type->slug, $summary->summary);
        return array("success" => true);
    }

    public function get_post_summary(WP_REST_Request $request) {
        $post_id = $request->get_param('id');
        $type_id = $request->get_param('type_id');
        if (empty($type_id)) {
            $type_id = 1;
        }
        $type = SummaryEngineDB::get_type($type_id);
        if (empty($type)) {
            return new WP_Error( 'summaryengine_api_error', __( 'Type not found', 'summaryengine' ), array( 'status' => 404 ) );
        }
        $summary = get_post_meta($post_id, 'summaryengine_' . $type->slug, true);
        $summary_id = get_post_meta($post_id, 'summaryengine_' . $type->slug . '_id', true);
        return array(
            "summary" => $summary,
            "summary_id" => $summary_id,
        );
    }

    protected function rated_summaries($rating, $size) {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $results = $wpdb->get_results($wpdb->prepare("SELECT * FROM {$wpdb->prefix}summaryengine_summaries WHERE rating = %d ORDER BY created_at DESC LIMIT %d", [$rating, $size]));
        foreach($results as $result) {
            $result->post_title = get_the_title($result->post_id);
            $result->post_permalink = get_permalink($result->post_id);
            $result->user = get_user_by('id', $result->user_id)->display_name;
        }
        return $results;
    }

    protected function count_rated_summaries() {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $results = $wpdb->get_results($wpdb->prepare("SELECT COUNT(*) as count, rating, type_id FROM {$wpdb->prefix}summaryengine_summaries GROUP BY rating, type_id"));
        return $results;
    }

    protected function summaries_by_period($start, $end, $type_id) {
        global $wpdb;
        if (!isset($type_id) || empty($type_id) || $type_id <= 0) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery
            $results = $wpdb->get_results($wpdb->prepare("SELECT DATE(created_at) as date, COUNT(*) as count, rating FROM {$wpdb->prefix}summaryengine_summaries WHERE created_at > %s AND created_at <= %s GROUP BY DATE(created_at), rating", [$start, $end]));
        } else {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery
            $results = $wpdb->get_results($wpdb->prepare("SELECT DATE(created_at) as date, COUNT(*) as count, rating FROM {$wpdb->prefix}summaryengine_summaries WHERE created_at > %s AND created_at <= %s AND type_id = %d GROUP BY DATE(created_at), rating", [$start, $end, $type_id]));
        }
        return $results;
    }

    public function get_reports(WP_REST_Request $request) {
        $good_summaries = $this->rated_summaries(1, 10);
        $bad_summaries = $this->rated_summaries(-1, 10);
        $counts = $this->count_rated_summaries();
        return array(
            "good_summaries" => $good_summaries,
            "bad_summaries" => $bad_summaries,
            "counts" => $counts,
        );
    }

    public function get_reports_by_period(WP_REST_Request $request) {
        $start = $request->get_param('start') ?? gmdate('Y-m-d', strtotime('-30 days'));
        $end = $request->get_param('end') ?? gmdate('Y-m-d');
        $type_id = $request->get_param('type');
        return $this->summaries_by_period($start, $end, $type_id);
    }

    public function get_types(WP_REST_Request $request) {
        return SummaryEngineDB::get_types();
    }

    public function post_type(WP_REST_Request $request) {
        global $wpdb;
        $id = intval($request->get_param('id'));
        $name = $request->get_param('name');
        $slug = $request->get_param('slug');
        $openai_model = $request->get_param('openai_model');
        $openai_word_limit = $request->get_param('openai_word_limit');
        $cut_at_paragraph = $request->get_param('cut_at_paragraph');
        $openai_frequency_penalty = $request->get_param('openai_frequency_penalty');
        $openai_max_tokens = $request->get_param('openai_max_tokens');
        $openai_presence_penalty = $request->get_param('openai_presence_penalty');
        $openai_temperature = $request->get_param('openai_temperature');
        $openai_top_p = $request->get_param('openai_top_p');
        $openai_prompt = $request->get_param('openai_prompt');
        $openai_append_prompt = $request->get_param('openai_append_prompt');
        $custom_action = $request->get_param('custom_action');
        $data = array(
            'name' => $name,
            'slug' => $slug,
            'openai_model' => $openai_model,
            'openai_word_limit' => $openai_word_limit,
            'cut_at_paragraph' => $cut_at_paragraph,
            'openai_frequency_penalty' => $openai_frequency_penalty,
            'openai_max_tokens' => $openai_max_tokens,
            'openai_presence_penalty' => $openai_presence_penalty,
            'openai_temperature' => $openai_temperature,
            'openai_top_p' => $openai_top_p,
            'openai_prompt' => $openai_prompt,
            'openai_append_prompt' => $openai_append_prompt,
            'custom_action' => $custom_action,
        );
        $pattern = array(
            '%s',
            '%s',
            '%s',
            '%d',
            '%d',
            '%f',
            '%d',
            '%f',
            '%f',
            '%s',
            '%s',
            '%s',
        );
        if (!empty($id)) {
            $name = $request->get_param('name');
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery
            $wpdb->update(
                "{$wpdb->prefix}summaryengine_types",
                $data,
                array(
                    'ID' => $id,
                ),
                $pattern,
            );
        } else {
            $name = $request->get_param('name');
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery
            $wpdb->insert(
                "{$wpdb->prefix}summaryengine_types",
                $data,
                $pattern,
            );
            $id = $wpdb->insert_id;
        }
        // Check for errors
        if ($wpdb->last_error !== '') {
            return new WP_Error( 'summaryengine_api_error', $wpdb->last_error, array( 'status' => 500 ) );
        }
        return array("success" => true, "id" => $id);
    }

    public function delete_type(WP_REST_Request $request) {
        global $wpdb;
        $id = intval($request->get_param('id'));
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $wpdb->delete(
            "{$wpdb->prefix}summaryengine_types",
            array(
                'ID' => $id,
            ),
        );
        // Check for errors
        if ($wpdb->last_error !== '') {
            return new WP_Error( 'summaryengine_api_error', $wpdb->last_error, array( 'status' => 500 ) );
        }
        return array("success" => true);
    }

    public function get_posts(WP_REST_Request $request) {
        $args = array(
            'post_type' => get_option("summaryengine_post_types", array("post")),
            'post_status' => 'publish',
            'posts_per_page' => 10,
            'orderby' => 'date',
            'order' => 'DESC',
        );
        $date = $request->get_param('date');
        $month = intval(substr($date, 4, 2));
        $year = intval(substr($date, 0, 4));
        if (!empty($month) && !empty($year)) {
            $args['date_query'] = array(
                array(
                    'year' => $year,
                    'month' => $month,
                ),
            );
        }
        $page = intval($request->get_param('page'));
        if (!empty($page)) {
            $args['paged'] = $page;
        }
        $search = $request->get_param('search');
        if (!empty($search)) {
            $args['s'] = $search;
        }
        $query = new WP_Query($args);
        $posts = $query->get_posts();
        $types = $this->get_types($request);
        $results = array();
        foreach($posts as $post) {
            $summaries = [];
            foreach($types as $type) {
                $summary = get_post_meta($post->ID, 'summaryengine_' . $type->slug, true);
                $summary_id = get_post_meta($post->ID, 'summaryengine_' . $type->slug . '_id', true);
                $summary_details = SummaryEngineDB::get_summary(intval($summary_id));
                $summaries[$type->slug] = array(
                    'summary' => $summary,
                    'summary_id' => $summary_id,
                    'summary_details' => $summary_details,
                );
            }
            $results[] = array(
                "id" => $post->ID,
                "post_title" => $post->post_title,
                "permalink" => get_permalink($post->ID),
                "post_author" => get_the_author_meta('display_name', $post->post_author),
                "post_date" => $post->post_date,
                "published" => $post->post_status == 'publish',
                "summaries" => $summaries,
            );
        }
        return [ "posts" => $results, "count" => $query->found_posts ];
    }

    public function get_posts_count(WP_REST_Request $request) {
        $args = array(
            'post_type' => get_option("summaryengine_post_types", array("post")),
            'post_status' => 'publish',
        );
        $date = $request->get_param('date');
        $month = intval(substr($date, 4, 2));
        $year = intval(substr($date, 0, 4));
        if (!empty($month) && !empty($year)) {
            $args['date_query'] = array(
                array(
                    'year' => $year,
                    'month' => $month,
                ),
            );
        }
        $query = new WP_Query($args);
        $count = $query->found_posts;
        return $count;
    }

    public function get_post_months(WP_REST_Request $request) {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $results = $wpdb->get_results("SELECT DISTINCT YEAR(post_date) AS year, MONTH(post_date) AS month FROM {$wpdb->prefix}posts WHERE post_status = 'publish' ORDER BY post_date DESC");
        return $results;
    }

}