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
                            foreach($post_types as $pt) {
                                $checked = (get_option('summaryengine_post_types') && in_array($pt->name, get_option('summaryengine_post_types', []))) ? 'checked' : '';
                                echo '<input type="checkbox" name="summaryengine_post_types[]" value="' . esc_attr($pt->name) . '" ' . esc_attr($checked) . '> ' . esc_html($pt->label) . '<br>';
                            }
                        ?>
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
                    <th scope="row"><?php _e("OpenAPI Model", "summaryengine") ?></th>
                    <td>
                        <select name="summaryengine_openai_model">
                            <option value="text-davinci-003" <?php echo (get_option('summaryengine_openai_model') == 'text-davinci-003') ? 'selected' : ''; ?>>Text-Davinci-003</option>
                            <option value="text-davinci-002" <?php echo (get_option('summaryengine_openai_model') == 'text-davinci-002') ? 'selected' : ''; ?>>Text-Davinci-002</option>
                            <option value="text-curie-001" <?php echo (get_option('summaryengine_openai_model') == 'text-curie-001') ? 'selected' : ''; ?>>Text-Curie-001</option>
                            <option value="text-babbage-001" <?php echo (get_option('summaryengine_openai_model') == 'text-babbage-001') ? 'selected' : ''; ?>>Text-Babbage-001</option>
                            <option value="text-ada-001" <?php echo (get_option('summaryengine_openai_model') == 'text-ada-001') ? 'selected' : ''; ?>>Text-Ada-001</option>
                        </select>
                    </td>
                </tr>
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
                <tr>
                    <th scope="row"><?php _e("Max tokens", "summaryengine") ?></th>
                    <td>
                        <input type="number" name="summaryengine_openai_max_tokens" value="<?php echo esc_attr(get_option('summaryengine_openai_max_tokens')); ?>" class="regular-text" min="0" max="2048" step="1">
                        <p>The maximum number of tokens to generate in the completion.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php _e("Temperature", "summaryengine") ?></th>
                    <td>
                        <input type="number" name="summaryengine_openai_temperature" value="<?php echo esc_attr(get_option('summaryengine_openai_temperature')); ?>" class="regular-text" min="0" max="1" step="0.1">
                        <p>What sampling temperature to use. Higher values means the model will take more risks. Try 0.9 for more creative applications, and 0 (argmax sampling) for ones with a well-defined answer. We generally recommend altering this or top_p but not both.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php _e("Top-P", "summaryengine") ?></th>
                    <td>
                        <input type="number" name="summaryengine_openai_top_p" value="<?php echo esc_attr(get_option('summaryengine_openai_top_p')); ?>" class="regular-text" min="0" max="1" step="0.1">
                        <p>An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered. We generally recommend altering this or temperature but not both.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php _e("Presence penalty", "summaryengine") ?></th>
                    <td>
                        <input type="number" name="summaryengine_openai_presence_penalty" value="<?php echo esc_attr(get_option('summaryengine_openai_presence_penalty')); ?>" class="regular-text" min="-2" max="2" step="0.1">
                        <p>Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php _e("Frequency penalty", "summaryengine") ?></th>
                    <td>
                        <input type="number" name="summaryengine_openai_frequency_penalty" value="<?php echo esc_attr(get_option('summaryengine_openai_frequency_penalty')); ?>" class="regular-text" min="-2" max="2" step="0.1">
                        <p>Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php _e("Prepend Prompt", "summaryengine") ?></th>
                    <td>
                        <input type="text" name="summaryengine_openai_prompt" value="<?php echo esc_attr(get_option('summaryengine_openai_prompt', '')); ?>" class="regular-text">
                        <p>The instruction to the model on what you'd like to generate, prepended.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php _e("Append Prompt", "summaryengine") ?></th>
                    <td>
                        <input type="text" name="summaryengine_openai_append_prompt" value="<?php echo esc_attr(get_option('summaryengine_openai_append_prompt', '')); ?>" class="regular-text">
                        <p>The instruction to the model on what you'd like to generate, appended.</p>
                    </td>
                </tr>
            </tbody>
        </table>
        <?php submit_button(); ?>
    </form>
</div>