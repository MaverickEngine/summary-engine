<?php

require_once(plugin_dir_path( __FILE__ ) . '../libs/openapi.php');

class SummaryEngineAPI {
    public function __construct() {
        add_action( 'rest_api_init', array( $this, 'register_api_routes' ) );
    }
    
    public function register_api_routes() {
        register_rest_route( 'summaryengine/v1', '/summarise', array(
            'methods' => 'POST',
            'callback' => array( $this, 'summarise' ),
        ) );
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

    public function summarise() {
        try {
            $content = strip_tags($_POST['content']);
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
            $openapi = new OpenAPI(get_option('summaryengine_openapi_apikey'));
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
            return $summary;
        } catch (Exception $e) {
            return new WP_Error( 'summaryengine_api_error', __( 'Error summarising content', 'summaryengine' ), array( 'status' => 500 ) );
        }
    }
}