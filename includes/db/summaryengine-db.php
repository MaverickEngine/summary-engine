<?php

class SummaryEngineDB {
    public function setup() {
        global $wpdb;
        $summaryengine_db_version = get_option("summaryengine_db_version", 0 );
        if ((string) $summaryengine_db_version == (string) SUMMARYENGINE_DB_VERSION) {
            return;
        }
        require_once( ABSPATH . 'wp-admin/includes/upgrade.php' );
        $charset_collate = $wpdb->get_charset_collate();

        // Create the summaryengine types table
        $summaryengine_types_tablename = $wpdb->prefix . "summaryengine_types";
        $summaryengine_types_sql = "CREATE TABLE $summaryengine_types_tablename (
            ID mediumint(9) NOT NULL AUTO_INCREMENT PRIMARY KEY,
            created_at datetime DEFAULT NOW() NOT NULL,
            name varchar(100) NOT NULL,
            slug varchar(100) NOT NULL,
            word_limit int(11) NOT NULL DEFAULT 750,
            cut_at_paragraph tinyint(1) NOT NULL DEFAULT 1,
            custom_action varchar(255) NOT NULL DEFAULT '',
            openai_model varchar(100) NOT NULL DEFAULT 'text-curie-001',
            openai_frequency_penalty float NOT NULL DEFAULT 0.5,
            openai_max_tokens int(11) NOT NULL DEFAULT 300,
            openai_presence_penalty float NOT NULL DEFAULT 0,
            openai_temperature float NOT NULL DEFAULT 0.6,
            openai_top_p float NOT NULL DEFAULT 1,
            openai_prompt varchar(100) NOT NULL DEFAULT 'Summarize in 100 words: ',
            openai_append_prompt varchar(100) NOT NULL DEFAULT '',
            summaryengine_version varchar(100) NOT NULL DEFAULT 0,
            INDEX created_at (created_at),
            UNIQUE KEY unique_name (name),
            UNIQUE KEY unique_slug (slug),
            INDEX summaryengine_version (summaryengine_version)
        ) $charset_collate;";
        dbDelta( $summaryengine_types_sql );
        // Insert the default types
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $rows_affected = $wpdb->insert( $summaryengine_types_tablename, array( 'name' => 'Summary', 'slug' => 'summary', 'ID' => 1 ) );
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $wpdb->update( $summaryengine_types_tablename, array( 'summaryengine_version' => SUMMARYENGINE_DB_VERSION ), array( 'summaryengine_version' => 0 ) );
        dbDelta( $rows_affected );
        
        // Create the summaryengine summaries table
        $summaryengine_tests_tablename = $wpdb->prefix . "summaryengine_summaries";
        $summaryengine_tests_sql = "CREATE TABLE $summaryengine_tests_tablename (
            ID mediumint(9) NOT NULL AUTO_INCREMENT PRIMARY KEY,
            type_id mediumint(9) NOT NULL DEFAULT 1,
            created_at datetime DEFAULT NOW() NOT NULL,
            post_id mediumint(9) NOT NULL,
            user_id mediumint(9) NOT NULL,
            submitted_text text NOT NULL,
            summary text NOT NULL,
            openai_id varchar(100) NOT NULL,
            openai_model varchar(100) NOT NULL,
            word_limit int NOT NULL DEFAULT 750,
            cut_at_paragraph tinyint(1) NOT NULL DEFAULT 1,
            openai_frequency_penalty float NOT NULL,
            openai_max_tokens int NOT NULL,
            openai_presence_penalty float NOT NULL,
            openai_temperature float NOT NULL,
            openai_top_p float NOT NULL,
            prompt varchar(100) NOT NULL,
            append_prompt varchar(100) NOT NULL DEFAULT '',
            openai_object varchar(100) NOT NULL,
            openai_usage_completion_tokens mediumint(9) NOT NULL,
            openai_usage_prompt_tokens mediumint(9) NOT NULL,
            openai_usage_total_tokens mediumint(9) NOT NULL,
            rating int DEFAULT 0 NOT NULL,
            edited tinyint(1) NOT NULL DEFAULT 0,
            edited_at datetime DEFAULT NULL,
            edited_by mediumint(9) DEFAULT NULL,
            summaryengine_version varchar(100) NOT NULL DEFAULT 0,
            INDEX type_id (type_id),
            INDEX post_id (post_id),
            INDEX user_id (user_id),
            INDEX created_at (created_at),
            INDEX post_id_created_at (post_id, created_at),
            INDEX rating (rating),
            INDEX summaryengine_version (summaryengine_version)
        ) $charset_collate;";
        dbDelta( $summaryengine_tests_sql );
        // Migrate old fields
        // phpcs:ignore WordPress.DB
        $wpdb->query("UPDATE $summaryengine_tests_tablename SET openai_frequency_penalty = frequency_penalty, openai_max_tokens = max_tokens, openai_presence_penalty = presence_penalty, openai_temperature = temperature, openai_top_p = top_p WHERE summaryengine_version = 0");
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $wpdb->update( $summaryengine_tests_tablename, array( 'summaryengine_version' => SUMMARYENGINE_DB_VERSION ), array( 'summaryengine_version' => 0 ) );
        update_option( "summaryengine_db_version", SUMMARYENGINE_DB_VERSION );
    }

    public static function get_types() {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        return $wpdb->get_results("SELECT * FROM {$wpdb->prefix}summaryengine_types ORDER BY name ASC");
    }

    public static function get_type(int $type_id) {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $type = $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}summaryengine_types WHERE ID = %d",
            $type_id
        ));
        if (empty($type)) {
            return new WP_Error( 'summaryengine_type_not_found', __( 'Type not found', 'summaryengine' ), array( 'status' => 404 ) );
        }
        return $type;
    }

    public static function get_summary(int $summary_id) {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $summary = $wpdb->get_row( $wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}summaryengine_summaries WHERE ID = %d",
            $summary_id
        ));
        if (empty($summary)) {
            return new WP_Error( 'summaryengine_summary_not_found', __( 'Summary not found', 'summaryengine' ), array( 'status' => 404 ) );
        }
        return $summary;
    }

    public static function save_summary($post_id, $type_id, $content, $settings, $summary_result) {
        global $wpdb;
        $data = array(
            'post_id' => $post_id,
            'type_id' => $type_id,
            'user_id' => get_current_user_id(),
            'submitted_text' => $content,
            'summary' => $settings['openai_append_prompt'] . trim($summary_result['choices'][0]['text']),
            'openai_id' => $summary_result['id'],
            'openai_model' => $summary_result['model'],
            'word_limit' => $settings['word_limit'],
            'cut_at_paragraph' => $settings['cut_at_paragraph'],
            'openai_frequency_penalty' => $settings['openai_frequency_penalty'],
            'openai_max_tokens' => $settings['openai_max_tokens'],
            'openai_presence_penalty' => $settings['openai_presence_penalty'],
            'openai_temperature' => $settings['openai_temperature'],
            'openai_top_p' => $settings['openai_top_p'],
            'prompt' => $settings['openai_prompt'],
            'append_prompt' => $settings['openai_append_prompt'],
            'openai_object' => $summary_result['object'],
            'openai_usage_completion_tokens' => $summary_result['usage']['completion_tokens'],
            'openai_usage_prompt_tokens' => $summary_result['usage']['prompt_tokens'],
            'openai_usage_total_tokens' => $summary_result['usage']['total_tokens'],
        );
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $wpdb->insert(
            $wpdb->prefix . 'summaryengine_summaries',
            $data,
            array(
                '%d',
                '%d',
                '%d',
                '%s',
                '%s',
                '%s',
                '%s',
                '%f',
                '%d',
                '%f',
                '%f',
                '%f',
                '%s',
                '%s',
                '%s',
                '%d',
                '%d',
                '%d',
            )
        );
        $data["ID"] = $wpdb->insert_id;
        return $data;
    }
}
