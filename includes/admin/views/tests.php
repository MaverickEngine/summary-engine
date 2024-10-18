<?php
// Ensure this file is being included by a parent file
if (!defined('ABSPATH')) exit;

// $types and $recent_posts variables should be available from the parent scope
?>
<div class="wrap">
    <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
    
    <h2>Test Asynchronous Summary Generation</h2>
    <form id="summaryengine-test-form">
        <table class="form-table">
            <tr>
                <th scope="row"><label for="post_id">Select Article</label></th>
                <td>
                    <select id="post_id" name="post_id" required>
                        <option value="">Select an Article</option>
                        <?php foreach ($recent_posts as $post): ?>
                            <option value="<?php echo esc_attr($post->ID); ?>"><?php echo esc_html($post->post_title); ?></option>
                        <?php endforeach; ?>
                    </select>
                </td>
            </tr>
            <tr>
                <th scope="row"><label for="type_id">Summary Type</label></th>
                <td>
                    <select id="type_id" name="type_id" required>
                        <option value="">Select a Summary Type</option>
                        <?php foreach ($types as $type): ?>
                            <option value="<?php echo esc_attr($type->ID); ?>"><?php echo esc_html($type->name); ?></option>
                        <?php endforeach; ?>
                    </select>
                </td>
            </tr>
        </table>
        <p class="submit">
            <input type="submit" name="submit" id="submit" class="button button-primary" value="Generate Summary">
        </p>
    </form>
    <div id="summaryengine-test-result"></div>

    <script>
    jQuery(document).ready(function($) {
        $('#summaryengine-test-form').on('submit', function(e) {
            e.preventDefault();
            var postId = $('#post_id').val();
            var typeId = $('#type_id').val();

            $.ajax({
                url: '<?php echo esc_url_raw(rest_url('summaryengine/v1/test-summary')); ?>',
                method: 'POST',
                beforeSend: function(xhr) {
                    xhr.setRequestHeader('X-WP-Nonce', '<?php echo wp_create_nonce('wp_rest'); ?>');
                },
                data: JSON.stringify({
                    post_id: postId,
                    type_id: typeId
                }),
                contentType: 'application/json',
                success: function(response) {
                    $('#summaryengine-test-result').html('<div class="notice notice-success"><p>Summary generated successfully:</p><pre>' + response.summary + '</pre></div>');
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    $('#summaryengine-test-result').html('<div class="notice notice-error"><p>Error: ' + jqXHR.responseJSON.message + '</p></div>');
                }
            });
        });
    });
    </script>
</div>
