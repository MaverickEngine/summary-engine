# Summary Engine

Use artificial intelligence to help editors generate summaries to articles. A MavEngine Wordpress plugin.

## Features
- Generate summaries for posts using OpenAI ChatGPT-3 or ChatGPT-4
- Create summaries for different purposes (e.g. newsletter, social media, etc.)
- An approval system allows you to just show the summaries that you're happy with
- Summaries are stored as post meta, so you can use them in your theme
- An RSS feed is available to get summaries

## RSS Feed

The summary feed is available at /feed/summaryengine. 

You can add the following parameters to customise it:

- `type` - The slug of the summary type you want to get
- `limit` - The number of summaries per page
- `page` - The page number
- `rating` - Only show summaries with this rating. (-1 = disapproved, 0 = unapproved, 1 = approved)