<?php

require_once(plugin_dir_path( __FILE__ ) . '../libs/openapi.php');

class SummaryEngineAPI {
    public function __construct() {
        global $wpdb;
        $this->table_name = $wpdb->prefix . 'summaryengine_summaries';
        add_action( 'rest_api_init', array( $this, 'register_api_routes' ) );
    }
    
    public function register_api_routes() {
        register_rest_route( 'summaryengine/v1', '/summarise', array(
            'methods' => 'POST',
            'callback' => array( $this, 'post_summarise' ),
            'permission_callback' => function () {
                return current_user_can( 'edit_others_posts' );
            }
        ) );
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
        register_rest_route('summaryengine/v1', '/summary/(?P<id>\d+)', array(
            'methods' => 'GET',
            'callback' => array( $this, 'get_summary' ),
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
    }

    protected function cut_at_paragraph($content, $wordcount) {
        $paragraphs = explode("\n", $content);
        $summary = "";
        $wordcount_remaining = $wordcount;
        foreach($paragraphs as $paragraph) {
            $words = explode(" ", $paragraph);
            $wordcount_remaining -= count($words);
            if ($wordcount_remaining <= 0) {
                $summary .= $paragraph . "\n";
                break;
            }
            $summary .= $paragraph . "\n";
        }
        return $summary;
    }

    protected function cut_at_wordcount($content, $wordcount) {
        $words = explode(" ", $content);
        $summary = "";
        $wordcount_remaining = $wordcount;
        foreach($words as $word) {
            $wordcount_remaining -= strlen($word);
            if ($wordcount_remaining <= 0) {
                $summary .= $word . " ";
                break;
            }
            $summary .= $word . " ";
        }
        return $summary;
    }

    protected function save_results($post_id, $content, $original_prompt, $params, $summary_result) {
        global $wpdb;
        $data = array(
            'post_id' => $post_id,
            'user_id' => get_current_user_id(),
            'submitted_text' => $content,
            'summary' => trim($summary_result['choices'][0]['text']),
            'openai_id' => $summary_result['id'],
            'openai_model' => $summary_result['model'],
            'frequency_penalty' => $params['frequency_penalty'],
            'max_tokens' => $params['max_tokens'],
            'presence_penalty' => $params['presence_penalty'],
            'temperature' => $params['temperature'],
            'top_p' => $params['top_p'],
            'prompt' => $original_prompt ?? get_option('summaryengine_openai_prompt'),
            'openai_object' => $summary_result['object'],
            'openai_usage_completion_tokens' => $summary_result['usage']['completion_tokens'],
            'openai_usage_prompt_tokens' => $summary_result['usage']['prompt_tokens'],
            'openai_usage_total_tokens' => $summary_result['usage']['total_tokens'],
        );
        $wpdb->insert(
            $this->table_name,
            $data,
            array(
                '%d',
                '%d',
                '%s',
                '%s',
                '%s',
                '%s',
                '%f',
                '%d',
                '%f',
                '%f',
                '%f',
                '%s',
                '%s',
                '%d',
                '%d',
                '%d',
            )
        );
        $data["ID"] = $wpdb->insert_id;
        return $data;
    }

    public function get_post_summaries(WP_REST_Request $request) {
        global $wpdb;
        $id = $request->get_param('id');
        $result = $wpdb->get_results( $wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}summaryengine_summaries WHERE post_id = %d ORDER BY created_at DESC",
            $id
        ));
        return $result;
    }

    public function get_post_summaries_count(WP_REST_Request $request) {
        global $wpdb;
        $id = $request->get_param('id');
        $result = $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}summaryengine_summaries WHERE post_id = %d ORDER BY created_at DESC",
            $id
        ));
        return array("count" => $result);
    }

    public function post_summarise(WP_REST_Request $request) {
        global $wpdb;
        try {
            $content = strip_tags($request->get_param('content'));
            $post_id = intval($request->get_param('post_id'));
            $settings = json_decode($request->get_param('settings'), true);
            // Make sure we still have submissions left
            $max_number_of_submissions_per_post = intval(get_option('summaryengine_max_number_of_submissions_per_post'));
            if ($max_number_of_submissions_per_post > 0) {
                $number_of_submissions = $wpdb->get_var( $wpdb->prepare(
                    "SELECT COUNT(*) FROM {$wpdb->prefix}summaryengine_summaries WHERE post_id = %d",
                    $post_id
                ));
                if ($number_of_submissions >= $max_number_of_submissions_per_post) {
                    return new WP_Error( 'too_many_submissions', "You have already submitted this post for automated summary a maxiumum number of $max_number_of_submissions_per_post times.", array( 'status' => 400 ) );
                }
            }
            $cut_at_paragraph = get_option( "summaryengine_cut_at_paragraph", false );
            $wordcount = get_option( "summaryengine_openai_word_limit", 750 );
            if ($cut_at_paragraph) {
                $content = $this->cut_at_paragraph($content, $wordcount);
            } else {
                $content = $this->cut_at_wordcount($content, $wordcount);
            }
            if (empty($content)) {
                return new WP_Error( 'summaryengine_empty_content', __( 'Content is empty', 'summaryengine' ), array( 'status' => 400 ) );
            }
            $openapi = new OpenAPI(get_option('summaryengine_openai_apikey'));
            $original_prompt =  $settings["openai_prompt"] ?? get_option('summaryengine_openai_prompt');
            $params = array(
                'model' => get_option( 'summaryengine_openai_model'),
                'frequency_penalty' => floatval(get_option( 'summaryengine_openai_frequency_penalty')),
                'max_tokens' => floatval(get_option( 'summaryengine_openai_max_tokens')),
                'presence_penalty' => floatval(get_option( 'summaryengine_openai_presence_penalty')),
                'temperature' => floatval(get_option( 'summaryengine_openai_temperature')),
                'top_p' => floatval(get_option( 'summaryengine_openai_top_p')),
                'prompt' => $original_prompt . "\n\n" . $content,
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
            $summary = $openapi->summarise($content, $params);
            if (empty($summary)) throw new Exception("Response from OpenAI is empty");
            $result = $this->save_results($post_id, $content, $original_prompt, $params, $summary);
            // Set meta data for post
            update_post_meta($post_id, 'summaryengine_summary', trim($result['summary']));
            update_post_meta($post_id, 'summaryengine_summary_id', $result['ID']);
            return $result;
        } catch (Exception $e) {
            return new WP_Error( 'summaryengine_api_error', __( 'Error summarising content: ' . $e->getMessage(), 'summaryengine' ), array( 'status' => 500 ) );
        }
    }

    public function post_rate_summary(WP_REST_Request $request) {
        global $wpdb;
        $id = $request->get_param('id');
        $rating = $request->get_param('rating');
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
        return array("success" => true);
    }

    public function post_summary(WP_REST_Request $request) {
        $post_id = $request->get_param('id');
        $summary = $request->get_param('summary');
        $summary_id = $request->get_param('summary_id');
        if (empty($summary_id)) {
            return new WP_Error('rest_custom_error', 'summary_id is required', array('status' => 400));
        }
        if (empty($summary)) {
            return new WP_Error('rest_custom_error', 'summary is required', array('status' => 400));
        }
        update_post_meta($post_id, 'summaryengine_summary', sanitize_text_field(trim($summary)));
        update_post_meta($post_id, 'summaryengine_summary_id', intval($summary_id));
        return array("success" => true);
    }

    public function get_summary(WP_REST_Request $request) {
        $post_id = $request->get_param('id');
        $summary = get_post_meta($post_id, 'summaryengine_summary', true);
        $summary_id = get_post_meta($post_id, 'summaryengine_summary_id', true);
        return array(
            "summary" => $summary,
            "summary_id" => $summary_id,
        );
    }

    protected function rated_summaries($rating, $size) {
        global $wpdb;
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
        $results = $wpdb->get_results($wpdb->prepare("SELECT COUNT(*) as count, rating FROM {$wpdb->prefix}summaryengine_summaries GROUP BY rating"));
        return $results;
    }

    protected function summaries_by_period($start, $end) {
        global $wpdb;
        $results = $wpdb->get_results($wpdb->prepare("SELECT DATE(created_at) as date, COUNT(*) as count, rating FROM {$wpdb->prefix}summaryengine_summaries WHERE created_at > %s AND created_at <= %s GROUP BY DATE(created_at), rating", [$start, $end]));
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
        return $this->summaries_by_period($start, $end);
    }

}