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

    public function summarise() {
        try {
            $content = $_POST['content'];
            if (empty($content)) {
                return new WP_Error( 'summaryengine_empty_content', __( 'Content is empty', 'summaryengine' ), array( 'status' => 400 ) );
            }
            $openapi = new OpenAPI(get_option('summaryengine_openapi_apikey'));
            $summary = $openapi->summarise($content);
            return $summary;
        } catch (Exception $e) {
            return new WP_Error( 'summaryengine_api_error', __( 'Error summarising content', 'summaryengine' ), array( 'status' => 500 ) );
        }
    }
}