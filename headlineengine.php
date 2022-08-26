<?php
/**
* Plugin Name: HeadlineEngine
* Plugin URI: https://github.com/MaverickEngine/headline-engine
* Description: What makes a good headline? Get instant headline analysis based on readability, length, and powerwords. Brought to you by MavEngine, &lt;em&gt;Powering Media. 
* Author: MavEngine
* Author URI: https://mavengine.com
* Version: 0.2.0
* License: GPLv2 or later
* License URI: https://www.gnu.org/licenses/gpl-3.0.html
* WC requires at least: 5.8.0
* Tested up to: 6.0
*
*/
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const HEADLINEENGINE_SCRIPT_VERSION = "0.1.3";

function headlineengine_admin_init() {
    if (!is_admin()) {
        return;
    }
    // require_once(plugin_dir_path( __FILE__ ) . 'includes/admin/taxonomyengine-scripts.php' );
    require_once(plugin_basename('includes/admin/headlineengine-admin.php' ) );
    new HeadlineEngineAdmin([]);
}
add_action( 'init', 'headlineengine_admin_init' );

function headlineengine_api_init() {
    require_once(plugin_dir_path( __FILE__ ) . 'includes/api/headlineengine-api.php' );
    new HeadlineEngineAPI();
}
add_action( 'init', 'headlineengine_api_init' );

function headlineengine_post_init() {
    require_once( plugin_dir_path( __FILE__ ) . 'includes/post/headlineengine-post.php' );
    new HeadlineEnginePost();
}
add_action( 'admin_init', 'headlineengine_post_init', 3 );