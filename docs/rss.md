# SummaryEngine RSS Feeds

SummaryEngine can generate RSS feeds for your site, using the summaries you have generated. This can be useful for generating a newsletter, or for syndicating your content to other sites.

## Available RSS Feeds

The default SummaryEngine RSS feed will be available at: `/feed/summaryengine`

If your website is "https://example.com", then the RSS feed will be available at: "https://example.com/feed/summaryengine"

This feed will give you the latest **approved** summaries for your site, of the type "summary", in reverse chronological order. 

***Note: Only summaries that have been approved by an editor will be included in the RSS feed.***

### RSS Feed Parameters

You can add the following parameters to customise the RSS feed:

- **type** - The slug of the summary type you want to get
- **limit** - The number of summaries per page
- **page** - The page number
- **rating** - Only show summaries with this rating. (-1 = rejected, 0 = unapproved, 1 = approved)

## Example RSS Feed

The following example will give you the latest 10 unapproved summaries of type "newsletter", in reverse chronological order starting at the second page:

`https://example.com/feed/summaryengine?type=newsletter&limit=10&page=2&rating=0`