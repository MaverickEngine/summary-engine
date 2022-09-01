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

    protected function save_results($post_id, $content, $params, $summary_result) {
        global $wpdb;
        // $table_name = $wpdb->prefix . 'summaryengine_summaries';
        // created_at datetime DEFAULT NOW() NOT NULL,
        //     post_id mediumint(9) NOT NULL,
        //     user_id mediumint(9) NOT NULL,
        //     submitted_text text NOT NULL,
        //     summary text NOT NULL,
        //     openai_id varchar(100) NOT NULL,
        //     openai_model varchar(100) NOT NULL,
        //     frequency_penalty float NOT NULL,
        //     max_tokens int NOT NULL,
        //     presence_penalty float NOT NULL,
        //     temperature float NOT NULL,
        //     top_p float NOT NULL,
        //     prompt varchar(100) NOT NULL,
        //     openai_object varchar(100) NOT NULL,
        //     openai_usage_completion_tokens mediumint(9) NOT NULL,
        //     openai_usage_prompt_tokens mediumint(9) NOT NULL,
        //     openai_usage_total_tokens mediumint(9) NOT NULL,
        $wpdb->insert(
            $this->table_name,
            array(
                'post_id' => $post_id,
                'user_id' => get_current_user_id(),
                'submitted_text' => $content,
                'summary' => $summary_result['choices'][0]['text'],
                'openai_id' => $summary_result['id'],
                'openai_model' => $summary_result['model'],
                'frequency_penalty' => $params['frequency_penalty'],
                'max_tokens' => $params['max_tokens'],
                'presence_penalty' => $params['presence_penalty'],
                'temperature' => $params['temperature'],
                'top_p' => $params['top_p'],
                'prompt' => get_option('summaryengine_openai_prompt'),
                'openai_object' => $summary_result['object'],
                'openai_usage_completion_tokens' => $summary_result['usage']['completion_tokens'],
                'openai_usage_prompt_tokens' => $summary_result['usage']['prompt_tokens'],
                'openai_usage_total_tokens' => $summary_result['usage']['total_tokens'],
            ),
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
    }

    public function get_post_summaries(WP_REST_Request $request) {
        global $wpdb;
        $id = $request->get_param('id');
        $result = $wpdb->get_results( $wpdb->prepare(
            "SELECT * FROM $this->table_name WHERE post_id = %d ORDER BY created_at DESC",
            $id
        ));
        return $result;
    }

    public function get_post_summaries_count(WP_REST_Request $request) {
        global $wpdb;
        $id = $request->get_param('id');
        $result = $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM $this->table_name WHERE post_id = %d ORDER BY created_at DESC",
            $id
        ));
        return array("count" => $result);
    }

    public function post_summarise() {
        global $wpdb;
        try {
            $content = strip_tags($_POST['content']);
            $post_id = intval($_POST['post_id']);
            // Make sure we still have submissions left
            $max_number_of_submissions_per_post = intval(get_option('summaryengine_max_number_of_submissions_per_post'));
            if ($max_number_of_submissions_per_post > 0) {
                $number_of_submissions = $wpdb->get_var( $wpdb->prepare(
                    "SELECT COUNT(*) FROM $this->table_name WHERE post_id = %d",
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
            $params = array(
                'model' => get_option( 'summaryengine_openai_model'),
                'frequency_penalty' => floatval(get_option( 'summaryengine_openai_frequency_penalty')),
                'max_tokens' => floatval(get_option( 'summaryengine_openai_max_tokens')),
                'presence_penalty' => floatval(get_option( 'summaryengine_openai_presence_penalty')),
                'temperature' => floatval(get_option( 'summaryengine_openai_temperature')),
                'top_p' => floatval(get_option( 'summaryengine_openai_top_p')),
                'prompt' => $content . '\n' . get_option('summaryengine_openai_prompt') . ' ',
            );
            $summary = $openapi->summarise($content, $params);
            $this->save_results($post_id, $content, $params, $summary);
            return $summary;
        } catch (Exception $e) {
            return new WP_Error( 'summaryengine_api_error', __( 'Error summarising content', 'summaryengine' ), array( 'status' => 500 ) );
        }
    }
}