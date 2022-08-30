<?php
/**
* Template Name: Summary RSS - SummaryEngine
*/
echo '<?xml version="1.0" encoding="'.get_option('blog_charset').'"?'.'>';
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
        <title><?php bloginfo_rss('name'); ?> - Summary Feed</title>
        <atom:link href="<?php self_link(); ?>" rel="self" type="application/rss+xml" />
        <link><?php bloginfo_rss('url') ?></link>
        <description><?php bloginfo_rss('description') ?></description>
        <lastBuildDate><?php echo $latest_modified_date_rss ?></lastBuildDate>
    <language><?php echo ( ( get_option( 'WPLANG' ) != '' ) ? get_option( 'WPLANG' ) : 'en' ); ?></language>
    <?php 
    foreach($posts as $post) { 
        ?>
        <item>
            <title><?php echo $post->title ?></title>
            <link><?php echo $post->url; ?></link>
            <guid><?php echo $post->url; ?></guid>
            <author><?php echo $post->author; ?></author>
            <pubDate><?php echo $post->published_date_rss; ?></pubDate>
            <category><?php echo implode( ',', $post->categories ); ?></category>
            <description><![CDATA[<?php echo $post->summary ?>]]></description>
            <content:encoded><![CDATA[<?php echo $post->summary ?>]]></content:encoded>
            <?php if ($post->feature_img_url) { ?>
            <enclosure url="<?php echo $post->feature_img_url; ?>" type="image/jpeg" />
            <media:content medium="image" url="<?php echo $post->feature_img_url ?>" />
            <?php } ?>
        </item>
        <?php } ?>
    </channel>
</rss>