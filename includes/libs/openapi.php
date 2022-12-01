<?php

class OpenAPI {
    public function __construct($apikey) {
        $this->apikey = $apikey;
    }

    public function summarise($content, $params) {
        $url = "https://api.openai.com/v1/completions";
        $args = array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $this->apikey,
                'Content-Type' => 'application/json',
            ),
            'body' => json_encode($params),
        );
        $response = wp_remote_post($url, $args);
        $body = json_decode(wp_remote_retrieve_body($response), true);
        // print_r($body);
        return $body;
    }
}