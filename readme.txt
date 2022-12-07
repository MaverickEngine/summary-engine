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

- Generate summaries for posts using GPT-3
- Create summaries for different purposes (e.g. newsletter, social media, etc.)
- An approval system allows you to just show the summaries that you're happy with
- Summaries are stored as post meta, so you can use them in your theme
- An RSS feed is available to get summaries

== Screenshots ==

1. SummaryEngine in the post edit view.
2. Fine-tune your GPT-3 settings.
3. Quickly generate and review summaries with Review screen.

== Changelog ==

= 0.6.0 =
* Quickly generate and review summaries with Review screen
* Summaries all custom types in post edit window
* Support for custom types in RSS feed
* Better error reporting for GPT-3
* Longer timeout (30s) for GPT-3

= 0.5.0 =
* Customisable types

= 0.4.1 =
* Fix bug with floats being mistakenly converted to ints

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