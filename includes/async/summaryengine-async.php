<?php
require_once(plugin_dir_path( __FILE__ ) . '../db/summaryengine-db.php');
require_once(plugin_dir_path( __FILE__ ) . '../libs/summaryengine-content.php');

class SummaryEngineAsync {
    public function __construct() {
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
        $type = SummaryEngineDB::get_type($type_id);
        $summary = get_post_meta($post_id, 'summaryengine_' . $type->slug, true);
        if (!empty($summary)) {
            return;
        }
        $post = get_post($post_id);
        $content = $post->post_content;
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
            'model' => $type->openai_model,
            'frequency_penalty' => floatval($type->openai_frequency_penalty),
            'max_tokens' => floatval($type->openai_max_tokens),
            'presence_penalty' => floatval($type->openai_frequency_penalty),
            'temperature' => floatval($type->openai_temperature),
            'top_p' => floatval($type->openai_top_p),
            'prompt' => $original_prompt . "\n\n" . $content . "\n\n" . $original_append_prompt,
        );
        $summary = $openapi->summarise($params);
        if (empty($summary)) throw new Exception("Did not receive a valid summary from OpenAI");
        $result = SummaryEngineDB::save_summary($post_id, $type_id, $content, $original_prompt, $original_append_prompt, $params, $summary);
        // Set meta data for post
        update_post_meta($post_id, 'summaryengine_' . $type->slug, trim($result['summary']));
        update_post_meta($post_id, 'summaryengine_' . $type->slug . '_id', $result['ID']);
        update_post_meta($post_id, 'summaryengine_' . $type->slug . '_rating', 0);
    }
    
}