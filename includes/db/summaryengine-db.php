<?php

class SummaryEngineDB {
    public function setup() {
        $summaryengine_db_version = get_option("summaryengine_db_version", 0 );
        if ((string) $summaryengine_db_version == (string) SUMMARYENGINE_DB_VERSION) {
            return;
        }
        global $wpdb;
        require_once( ABSPATH . 'wp-admin/includes/upgrade.php' );
        $charset_collate = $wpdb->get_charset_collate();

        $summaryengine_tests_tablename = $wpdb->prefix . "summaryengine_summaries";
        $summaryengine_tests_sql = "CREATE TABLE $summaryengine_tests_tablename (
            ID mediumint(9) NOT NULL AUTO_INCREMENT PRIMARY KEY,
            created_at datetime DEFAULT NOW() NOT NULL,
            post_id mediumint(9) NOT NULL,
            user_id mediumint(9) NOT NULL,
            submitted_text text NOT NULL,
            summary text NOT NULL,
            openai_id varchar(100) NOT NULL,
            openai_model varchar(100) NOT NULL,
            frequency_penalty float NOT NULL,
            max_tokens int NOT NULL,
            presence_penalty float NOT NULL,
            temperature float NOT NULL,
            top_p float NOT NULL,
            prompt varchar(100) NOT NULL,
            openai_object varchar(100) NOT NULL,
            openai_usage_completion_tokens mediumint(9) NOT NULL,
            openai_usage_prompt_tokens mediumint(9) NOT NULL,
            openai_usage_total_tokens mediumint(9) NOT NULL,
            INDEX post_id (post_id),
            INDEX user_id (user_id),
            INDEX created_at (created_at),
            INDEX post_id_created_at (post_id, created_at)
        ) $charset_collate;";
        dbDelta( $summaryengine_tests_sql );
        update_option( "summaryengine_db_version", ABENGINE_DB_VERSION );
    }
}