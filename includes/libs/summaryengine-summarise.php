<?php

require_once(plugin_dir_path( __FILE__ ) . 'summaryengine-openai.php');
require_once(plugin_dir_path( __FILE__ ) . 'summaryengine-chatgpt.php');
require_once(plugin_dir_path( __FILE__ ) . '../db/summaryengine-db.php');
require_once(plugin_dir_path( __FILE__ ) . 'summaryengine-content.php');

class SummaryEngineSummarise {
    public static function summarise($post_id, $content, $type_id, $user_settings = []) {
        $type = SummaryEngineDB::get_type($type_id);
        $type_settings = [
            'openai_model' => $type->openai_model,
            'openai_method' => $type->openai_method,
            'openai_system' => $type->openai_system,
            'prompt' => $type->prompt,
            'append_prompt' => $type->append_prompt,
            'openai_max_tokens' => $type->openai_max_tokens,
            'openai_temperature' => $type->openai_temperature,
            'openai_top_p' => $type->openai_top_p,
            'openai_frequency_penalty' => $type->openai_frequency_penalty,
            'openai_presence_penalty' => $type->openai_presence_penalty,
            'word_limit' => $type->word_limit,
            'cut_at_paragraph' => $type->cut_at_paragraph,
        ];
        $settings = array_merge($type_settings, $user_settings);
        
        if (empty($settings['word_limit'])) {
            $settings['word_limit'] = 500;
        }

        if ($settings["cut_at_paragraph"]) {
            $content = SummaryEngineContent::cut_at_paragraph($content, $settings["word_limit"]);
        } else {
            $content = SummaryEngineContent::cut_at_wordcount($content, $settings["word_limit"]);
        }

        if (empty($content)) {
            throw new Exception('Content is empty');
        }

        if (defined('OPENAI_APIKEY')) {
            $apikey = OPENAI_APIKEY;
        } else {
            $apikey = get_option('summaryengine_openai_apikey');
        }

        $openai = new SummaryEngineOpenAI($apikey);
        $chatgpt = new SummaryEngineChatGPT($apikey);
        $prepend_prompt =  $settings["prompt"];
        $append_prompt = $settings["append_prompt"];

        if ($type->openai_method === "chat") {
            $messages = array();
            $messages[] = ["role" => "system", "content" => $type->openai_system ];
            $messages[] = ["role" => "user", "content" => $prepend_prompt . "\n\n" . $content . "\n\n" . $append_prompt];
            $params = array(
                'model' => $settings["openai_model"],
                'max_tokens' => intval($settings["openai_max_tokens"]),
                'temperature' => floatval($settings["openai_temperature"]),
                'top_p' => floatval($settings["openai_top_p"]),
                'messages' => $messages,
            );
            $summary = $chatgpt->summarise($params);
        } else { // Deprecated
            throw new Exception("Only Chat OpenAI method is supported");
        }

        if (empty($summary)) {
            throw new Exception("Did not receive a valid summary from OpenAI");
        }

        $result = SummaryEngineDB::save_summary($post_id, $type_id, $content, $settings, $summary);
        
        return $result;
    }
}
