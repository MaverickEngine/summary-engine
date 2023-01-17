<div class="wrap">
    <?php
    if (!empty($error)) {
        echo '<div class="notice notice-error"><p>' . esc_html($error) . '</p></div>';
    }
    ?>
    <form method="post" action="options.php">
        <?php settings_fields( 'summaryengine-settings-group' ); ?>
        <?php do_settings_sections( 'summaryengine-settings-group' ); ?>
        <h1><?php _e( 'SummaryEngine Settings', 'summaryengine' ); ?></h1>
        <?php settings_errors(); ?>
        <hr>
        <table class="form-table">
            <tbody>
                <tr>
                    <th scope="row"><?php _e("Select post types", "summaryengine") ?></th>
                    <td>
                        <?php
                            $post_types = get_post_types(array('public' => true), 'objects');
                            usort($post_types, function($a, $b) {
                                return strcmp($a->name, $b->name);
                            });
                            foreach($post_types as $pt) {
                                $checked = (get_option('summaryengine_post_types') && in_array($pt->name, get_option('summaryengine_post_types', []))) ? 'checked' : '';
                                echo '<input type="checkbox" name="summaryengine_post_types[]" value="' . esc_attr($pt->name) . '" ' . esc_attr($checked) . '> ' . esc_html($pt->label) . '<br>';
                            }
                        ?>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php _e("Generate summaries when posts are published?", "summaryengine") ?></th>
                    <td>
                        <input type="checkbox" name="summaryengine_summarise_on_publish" value="1" <?php checked(1, get_option('summaryengine_summarise_on_publish')); ?>>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php _e("RSS post limit", "summaryengine") ?></th>
                    <td>
                        <input type="number" name="summaryengine_rss_limit" value="<?php echo esc_attr( get_option('summaryengine_rss_limit') ); ?>" class="regular-text" />
                    </td>
                </tr>
                <?php
                if (!defined('OPENAI_APIKEY')) {
                ?>
                <tr>
                    <th scope="row"><?php _e("OpenAI API Key", "summaryengine") ?></th>
                    <td>
                        <input type="password" name="summaryengine_openai_apikey" value="<?php echo esc_attr(get_option('summaryengine_openai_apikey')); ?>" class="regular-text">
                        <p>For better security, set this in your wp-config.php, vip-config.php or Docker .env file using the constant <code>OPENAI_APIKEY</code>.<br /> Eg. <code>define("OPENAI_APIKEY", "sk-my-key");</code></p>
                    </td>
                </tr>
                <?php
                }
                ?>
                <tr>
                    <th scope="row"><?php _e("OpenAI submission word limit", "summaryengine") ?></th>
                    <td>
                        <input type="number" name="summaryengine_openai_word_limit" value="<?php echo esc_attr(get_option('summaryengine_openai_word_limit')); ?>" class="regular-text">
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php _e("Cut at paragraph nearest end", "summaryengine") ?></th>
                    <td>
                        <input type="checkbox" name="summaryengine_cut_at_paragraph" value="1" <?php checked(1, get_option('summaryengine_cut_at_paragraph')); ?>>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php _e("Maximum number of submissions per post", "summaryengine") ?></th>
                    <td>
                        <input type="number" name="summaryengine_max_number_of_submissions_per_post" value="<?php echo esc_attr(get_option('summaryengine_max_number_of_submissions_per_post')); ?>" class="regular-text" min="-1">
                        <p>Set to -1 to allow unlimited submissions per post.</p>
                    </td>
                </tr>
            </tbody>
        </table>
        <?php submit_button(); ?>
    </form>
</div>