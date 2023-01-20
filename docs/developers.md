# SummaryEngine For Developers

SummaryEngine uses machine learning to help editors generate summaries to articles. It would typically be used in a newsroom, but can be used in other contexts too. 

Multiple summaries can be generated for each article, serving different purposes. For instance, you might generate a bullet-point summary for the start of the article, a longer summary for use in a newsletter, and a Twitter summary.

## Summary Slug

Each type of summary has a slug. The default slug is "summary", for a basic summary. You can add more slugs in the SummaryEngine [settings page](admins.md#summaryengine-settings).

## Summary Rating

Each summary has a rating. This is used to determine which summaries are shown to the public. The rating can be one of the following:
- **-1** - Rejected. This summary should not be shown to the public.
- **0** - Unapproved. This summary has not been approved by an editor, and should be used with care.
- **1** - Approved. This summary has been approved by an editor, and can be shown to the public.

## Post Metadata

SummaryEngine stores the summaries in post metadata. The key is `summaryengine_summary_{slug}`. For example, the key for the default summary is `summaryengine_summary`. For a summary of type "newsletter", the key would be `summaryengine_newsletter`.

In addition, we store the rating in the metadata key `summaryengine_{slug}_rating`. For example, the key for the default summary is `summaryengine_summary_rating`. For a summary of type "newsletter", the key would be `summaryengine_newsletter_rating`.

You can retrieve the summaries using the `get_post_meta` function. For example, to get the default summary for post ID 123, you would use:

```php
$summary = get_post_meta(123, 'summaryengine_summary', true);
$summary_rating = get_post_meta(123, 'summaryengine_summary_rating', true);
```

## Summary Feed

A feed of summaries is available at `/feed/summaryengine`. See [RSS Feeds](rss.md) for more information.
