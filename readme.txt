=== SummaryEngine ===
Contributors: jasonny
Tags: summary, news, article, rss, gpt-3, machine learning
Requires at least: 5.8
Tested up to: 6.0
Stable tag: 0.1.2
Requires PHP: 7.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Use machine learning to help editors generate summaries to articles. A MavEngine Wordpress plugin.

== Description ==

SummaryEngine is part of a suite of tools for news publishers, built by [MavEngine](https://mavengine.com), a division of [Daily Maverick](https://dailymaverick.co.za). 

SummaryEngine is a Wordpress plugin that uses machine learning to help editors generate summaries to articles.

== Features ==

- A "Summary" box will appear in posts.
- A button labeled "Generate summary" will send the article to GPT-3, and return a summarised version
- The editor can then edit the summary manually before saving
- A dedicated RSS feed will serve the summarised versions, which can be ingested into custom newsletters, etc.
- For cost control, you can limit the number of words submitted, and limit the number of times an article can be submitted for summarisation.
- A special RSS feed will serve summarised posts at `/feed/summaryengine`.

== Screenshots ==

1. SummaryEngine in the post edit view.
2. Fine-tune your GPT-3 settings.

== Changelog ==

= 0.4.0 =
* Reporting

= 0.3.0 =
* Ability to customise the settings

= 0.2.2 =
* Deal with empty summary responses
* RSS post limit

= 0.2.1 =
* Fixed some issues with indexing on first summary
* Added margin to summary buttons for DM

= 0.2.0 =
* Complete refactor with Svelte
* Componentisation
* Save summaries automatically
* Ranking
* Ability to go back to previous summaries

= 0.1.1 =
* Fixed breaking bug using wrong DB version constant

= 0.1.0 =
* Initial release