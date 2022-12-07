<?php
/**
* Template Name: Summary RSS - SummaryEngine
*/
echo '<?xml version="1.0" encoding="'. esc_attr(get_option('blog_charset')).'"?'.'>';
?>
<rss version="2.0"
xmlns:content="http://purl.org/rss/1.0/modules/content/"
xmlns:wfw="http://wellformedweb.org/CommentAPI/"
xmlns:dc="http://purl.org/dc/elements/1.1/"
xmlns:atom="http://www.w3.org/2005/Atom"
xmlns:sy="http://purl.org/rss/1.0/modules/syndication/"
xmlns:slash="http://purl.org/rss/1.0/modules/slash/"
>
    <channel>
        <title><?php bloginfo_rss('name'); ?> - SummaryEngine <?php esc_html_e($type->name) ?> Feed</title>
        <atom:link href="<?php self_link(); ?>" rel="self" type="application/rss+xml" />
        <link><?php bloginfo_rss('url') ?></link>
        <description><?php bloginfo_rss('description') ?></description>
        <lastBuildDate><?php esc_html_e($latest_modified_date_rss) ?></lastBuildDate>
        <language><?php esc_html_e(get_option( 'WPLANG', 'en' )) ?></language>
<?php 
    foreach($posts as $p) { 
?>
        <item>
            <title><?php esc_html_e($p->title) ?></title>
            <link><?php echo esc_url($p->url); ?></link>
            <guid><?php echo esc_url($p->url); ?></guid>
            <author><?php esc_html_e($p->author); ?></author>
            <pubDate><?php esc_html_e($p->published_date_rss); ?></pubDate>
            <category><?php esc_html_e(implode( ',', $p->categories )); ?></category>
            <description><![CDATA[<?php esc_html_e($p->summary) ?>]]></description>
            <content:encoded><![CDATA[<?php esc_html_e($p->summary) ?>]]></content:encoded>
<?php   if ($p->feature_img_url) { ?>
            <enclosure url="<?php echo esc_url($p->feature_img_url); ?>" type="image/jpeg" />
            <media:content medium="image" url="<?php echo esc_url($p->feature_img_url) ?>" />
<?php   } ?>
        </item>
<?php } ?>
    </channel>
</rss>