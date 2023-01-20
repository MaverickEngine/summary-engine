# SummaryEngine Custom Actions

You can create custom actions to be called when a summary is generated. This can be useful for posting to Twitter, or sending an email. The custom action will not be fired automatically, but will present the editor with a button to call it.

## Custom Action Variables

The following variables can be used in the custom action:
- **[post_url]** - The permalink url to the current post
- **[summary]** - A raw copy of the summary
- **[summary_encoded]** - An encoded copy of the summary, suitable for use in a URL

## Example Custom Action

The following example will post the summary to Twitter, using [Twitter Web Intents](https://developer.twitter.com/en/docs/twitter-for-websites/web-intents/overview):

```html
<a class="twitter-share-button"
  href="https://twitter.com/intent/tweet?text=[summary_encoded] [post_url]" target="_blank">
Tweet</a>
```