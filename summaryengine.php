<?php
/**
* Plugin Name: SummaryEngine
* Plugin URI: https://github.com/MaverickEngine/summary-engine
* Description: Use machine learning to help editors generate summaries to articles. Brought to you by MavEngine, &lt;em&gt;Powering Media. 
* Author: MavEngine
* Author URI: https://mavengine.com
* Version: 0.6.7
* License: GPLv2 or later
* License URI: https://www.gnu.org/licenses/gpl-3.0.html
* WC requires at least: 5.8.0
* Tested up to: 6.0
*
*/
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const SUMMARYENGINE_SCRIPT_VERSION = "0.6.7";
const SUMMARYENGINE_PLUGIN_VERSION = "0.6.7";
const SUMMARYENGINE_DB_VERSION = "0.6.7";

// Setup database tables
function summaryengine_database_setup() {
    require_once( plugin_dir_path( __FILE__ ) . 'includes/db/summaryengine-db.php' );
    $summaryengine_db = new SummaryEngineDB();
    $summaryengine_db->setup();
}
add_action( 'init', 'summaryengine_database_setup', 2 );

function summaryengine_admin_init() {
    if (!is_admin()) {
        return;
    }
    require_once(plugin_basename('includes/admin/summaryengine-admin.php' ) );
    new SummaryEngineAdmin([]);
}
add_action( 'init', 'summaryengine_admin_init' );

function summaryengine_api_init() {
    require_once(plugin_dir_path( __FILE__ ) . 'includes/api/summaryengine-api.php' );
    new SummaryEngineAPI();
}
add_action( 'init', 'summaryengine_api_init' );

function summaryengine_post_init() {
    require_once( plugin_dir_path( __FILE__ ) . 'includes/post/summaryengine-post.php' );
    new SummaryEnginePost();
}
add_action( 'admin_init', 'summaryengine_post_init', 3 );

function summaryengine_rss_init() {
    require_once(plugin_dir_path( __FILE__ ) . 'includes/rss/summaryengine-rss.php' );
    new SummaryEngineRSS();
}
add_action( 'init', 'summaryengine_rss_init' );