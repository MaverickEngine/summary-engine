<?php

class SummaryEngineRSS {
    public function __construct() {
        add_feed('summaryengine', array( $this, 'summary_rss_view' ));
    }

    protected function get_post_categories( $post_id, $term_name = 'section', $return_slug = false ) {
        $post_categories = array();
        $fallback        = true;
        if ( class_exists( 'WPSEO_Primary_Term' ) ) {
            // Show the post's 'Primary' category, if this Yoast feature is available, & one is set
            $wpseo_primary_term = new WPSEO_Primary_Term( $term_name, $post_id );
            $wpseo_primary_term = $wpseo_primary_term->get_primary_term();
            $term               = get_term( $wpseo_primary_term );
            if ( ! is_wp_error( $term ) ) {
                 // Yoast Primary category
                 $post_categories[] = (string) ( $return_slug ) ? $term->slug : $term->name;
                 $fallback          = false;
            }
        }
        if ( $fallback ) {
             // Default to first category (not Yoast) if an error is returned
             $categories = get_the_terms( $post_id, $term_name );
            if ( ! empty( $categories ) && is_array( $categories ) ) {
                foreach ( $categories as $category ) {
                    $post_categories[] = (string) ( $return_slug ) ? $category->slug : $category->name;
                }
            }
        }
        return $post_categories;
    }
    
    protected function _post_map($post) {
        $id = $post->ID;
        $slug = 'summary';
        if (isset($_GET["type"])) {
            $slug = sanitize_text_field($_GET["type"]);
        }
        $result = new stdClass();
        $result->title = get_the_title( $id );
        $result->author = get_the_author_meta('display_name', $post->post_author);
        $result->summary = get_post_meta( $id, 'summaryengine_' . $slug, true );
        $result->categories = $this->get_post_categories( $id, 'section', true );
        $result->url = get_permalink( $id );
        $result->date = get_the_date( '', $id );
        $result->published_date = get_the_date( DATE_ISO8601, $id );
        $result->published_date_pretty = get_the_date( 'M d, h:i A', $id );
        $result->published_date_rss = get_the_date( 'r', $id );
        $result->modified_date = get_the_modified_date( DATE_ISO8601, $id );
        $result->modified_date_pretty   = get_the_modified_date( 'M d, h:i A', $id );
        $result->modified_date_rss = get_the_modified_date( 'r', $id );
        $result->photo_caption = '';
        $result->photo_description = '';
        $thumbnail_id = get_post_thumbnail_id( $id );
        if ($thumbnail_id) {
            $feature_img = wp_get_attachment_image_src( $thumbnail_id, 'full' );
            $result->feature_img_url = $feature_img[0];
            $feature_img_post  = get_post( $thumbnail_id );
            $result->photo_caption     = $feature_img_post->post_excerpt;
            $result->photo_description = $feature_img_post->post_content;
        }
        return $result;
    }

    protected function _query() {
        $slug = 'summary';
        if (isset($_GET["type"])) {
            $slug = sanitize_text_field($_GET["type"]);
        }
        $limit = get_option('summaryengine_rss_limit', 10);
        if (isset($_GET["limit"])) {
            $limit = intval($_GET["limit"]);
        }
        $page = 1;
        if (isset($_GET["page"])) {
            $page = intval($_GET["page"]);
        }
        $rating = null;
        if (isset($_GET["rating"])) {
            $rating = intval($_GET["rating"]);
        } else {
            $rating = 1;
        }
        $query = array(
            'post_type' => get_option('summaryengine_post_types', array('post')),
            'post_status' => 'publish',
            'posts_per_page' => $limit,
            'paged' => $page,
            'orderby' => 'date',
            'order' => 'DESC',
            // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
            'meta_query' => array(
                array(
                   'key' => 'summaryengine_' . $slug,
                   'compare' => 'EXISTS'
                ),
                array(
                     'key' => 'summaryengine_' . $slug,
                     'value' => '',
                     'compare' => '!='
                )
            ),
        );
        if (isset($rating)) {
            $query['meta_query'][] = array(
                'key' => 'summaryengine_' . $slug . '_rating',
                'value' => $rating,
                'compare' => '='
            );
        }
        return $query;
    }

    private function _get_type() {
        $slug = 'summary';
        if (isset($_GET["type"])) {
            $slug = sanitize_text_field($_GET["type"]);
        }
        global $wpdb;
        // phpcs:ignore WordPress.DB
        $type = $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}summaryengine_types WHERE slug = %s",
            $slug
        ));
        if (empty($type)) {
            return new WP_Error( 'summaryengine_type_not_found', __( 'Type not found', 'summaryengine' ), array( 'status' => 404 ) );
        }
        return $type;
    }

    public function summary_rss_view() {
        header( 'Content-Type: application/rss+xml' );
        $original_posts = get_posts($this->_query());
        $posts = array_map(array($this, '_post_map'), $original_posts);
        $sorted_modified_dates = array_map(function($post) {
            return $post->modified_date;
        }, $posts);
        rsort($sorted_modified_dates); // Stupid fucking PHP
        $latest_modified_date_rss = gmdate( 'r', strtotime($sorted_modified_dates[0]) );
        $type = $this->_get_type();
        require_once plugin_dir_path( dirname( __FILE__ ) ).'rss/views/rss-summary.php';
    }
}