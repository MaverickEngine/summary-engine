<?php

class SummaryEngineOpenAI {
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
            // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout
            'timeout' => 30,
            'body' => wp_json_encode($params),
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

    public function list_models() {
        $url = "https://api.openai.com/v1/models";
        $args = array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $this->apikey,
                'Content-Type' => 'application/json',
            )
        );
        if (function_exists('vip_safe_wp_remote_get')) {
            $response = vip_safe_wp_remote_get($url, $args);
        } else {
            // phpcs:ignore WordPressVIPMinimum
            $response = wp_remote_get($url, $args);
        }
        if (! is_wp_error( $response ) ) {
            $body = json_decode(wp_remote_retrieve_body($response), true);
            if (is_array($body) && isset($body["error"])) {
                return new WP_Error('openai_api_error', $body["error"]);
            }
            return $body;
        } else {
            $error_message = $response->get_error_message();
            throw new Exception("OpenAI API error: " . $error_message);
        }
    }
}