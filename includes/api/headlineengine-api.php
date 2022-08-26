<?php

class HeadlineEngineAPI {
    public function __construct() {
        add_action( 'rest_api_init', array( $this, 'register_api_routes' ) );
    }
    
    public function register_api_routes() {
        register_rest_route( 'headlineengine/v1', '/powerwords', array(
            'methods' => 'GET',
            'callback' => array( $this, 'powerwords' ),
        ) );
    }

    public function powerwords() {
        $powerwords = get_option('headlineengine_powerwords_list', "");
        $powerwords = preg_replace("/[^A-Za-z0-9 \n]/", '', $powerwords);
        $powerwords = explode("\n", $powerwords);
        $powerwords = array_map('trim', $powerwords);
        $powerwords = array_filter($powerwords);
        $powerwords = array_unique($powerwords);
        $powerwords = array_values($powerwords);
        return $powerwords;
    }
}