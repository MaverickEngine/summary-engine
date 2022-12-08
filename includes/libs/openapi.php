<?php

class OpenAPI {
    public function __construct($apikey) {
        $this->apikey = $apikey;
    }

    public function summarise($params) {
        $url = "https://api.openai.com/v1/completions";
        $args = array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $this->apikey,
                'Content-Type' => 'application/json',
            ),
            'timeout' => 30,
            'body' => json_encode($params),
        );
        $response = wp_remote_post($url, $args);
        if (! is_wp_error( $response ) ) {
            $body = json_decode(wp_remote_retrieve_body($response), true);
            return $body;
        } else {
            $error_message = $response->get_error_message();
            throw new Exception("OpenAI API error: " . $error_message);
        }
    }
}