<div class="wrap">
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
                            foreach($post_types as $post_type) {
                                $checked = (get_option('summaryengine_post_types') && in_array($post_type->name, get_option('summaryengine_post_types'))) ? 'checked' : '';
                                echo '<input type="checkbox" name="summaryengine_post_types[]" value="' . esc_attr($post_type->name) . '" ' . $checked . '> ' . esc_html($post_type->label) . '<br>';
                            }
                        ?>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php _e("OpenAI API Key", "summaryengine") ?></th>
                    <td>
                        <input type="text" name="summaryengine_openapi_apikey" value="<?php echo esc_attr(get_option('summaryengine_openapi_apikey')); ?>" class="regular-text">
                    </td>
                </tr>
            </tbody>
        </table>
        <?php submit_button(); ?>
    </form>
</div>