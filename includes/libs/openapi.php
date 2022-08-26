<?php

class OpenAPI {
    public function __construct($apikey) {
        $this->apikey = $apikey;
    }

    public function summarise($content) {
        $url = "https://api.openai.com/v1/completions";
        $args = array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $this->apikey,
                'Content-Type' => 'application/json',
            ),
            'body' => json_encode(array(
                "frequency_penalty" => 0.5,
                "max_tokens" => 300,
                "model" => "text-davinci-002",
                "presence_penalty" => 0,
                "prompt" => $content . "\nSummarize in 100 words: ",
                "temperature" => 0.6,
                "top_p" => 1
            )),
        );
        $response = wp_remote_post($url, $args);
        $body = json_decode(wp_remote_retrieve_body($response), true);
        return $body;
    }
}