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
    

    public function summary_rss_view() {
        header( 'Content-Type: application/rss+xml' );
        $posts = get_posts(array(
            'post_type' => get_option('summaryengine_post_types'),
            'post_status' => 'publish',
            'posts_per_page' => 5,
            'orderby' => 'date',
            'order' => 'DESC',
            'meta_query' => array(
                array(
                   'key' => 'summaryengine_summary',
                   'compare' => 'EXISTS'
                ),
                array(
                     'key' => 'summaryengine_summary',
                     'value' => '',
                     'compare' => '!='
                )
            ),
        ));
        foreach($posts as $post) {
            $id = $post->ID;
            $post->title = get_the_title( $id );
            $post->author = get_the_author_meta('display_name', $post->post_author);
            $post->summary = get_post_meta( $id, 'summaryengine_summary', true );
            $post->categories = $this->get_post_categories( $id, 'section', true );
            $post->url = get_permalink( $id );
            $post->date = get_the_date( '', $id );
            $post->published_date = get_the_date( DATE_ISO8601, $id );
		    $post->published_date_pretty = get_the_date( 'M d, h:i A', $id );
            $post->published_date_rss = get_the_date( 'r', $id );
		    $post->modified_date = get_the_modified_date( DATE_ISO8601, $id );
		    $post->modified_date_pretty   = get_the_modified_date( 'M d, h:i A', $id );
            $post->modified_date_rss = get_the_modified_date( 'r', $id );
            $post->photo_caption = '';
			$post->photo_description = '';
			$thumbnail_id = get_post_thumbnail_id( $id );
            if ($thumbnail_id) {
				$feature_img = wp_get_attachment_image_src( $thumbnail_id, 'full' );
				$post->feature_img_url = $feature_img[0];
				$feature_img_post  = get_post( $thumbnail_id );
				$post->photo_caption     = $feature_img_post->post_excerpt;
				$post->photo_description = $feature_img_post->post_content;
            }
        }
        $sorted_modified_dates = array_map(function($post) {
            return $post->modified_date;
        }, $posts);
        rsort($sorted_modified_dates); // Stupid fucking PHP
        $latest_modified_date_rss = gmdate( 'r', strtotime($sorted_modified_dates[0]) );
        require_once plugin_dir_path( dirname( __FILE__ ) ).'rss/views/rss-summary.php';
    }
}