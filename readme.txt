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

= v0.12.2 = 
 * Reduce permissions required to use the Preview view
 
= v0.12.1 =
 * Make prompt field lenghts 255 instead of 100
 
= v0.12.0 =
 * Sort out all naming issues
 * "openai_prompt" and "openai_prompt_append" now unified across system

= v0.11.2 =
 * Bug fix for OPENAI_APIKEY constant
 
= v0.11.1 =
 * Better error handling for OpenAI

= v0.11.0 =
 * Bug fix when using option-set API key
 * Bug fix for error on first Loading

= v0.10.0 =
 * Critical bug fix from lubo-makky - incorrect field name when saving summary

= v0.9.0 =
 * Documentation (mkdocs)
 * Preview on Review screen
 * Some bug fixes

= v0.8.0 =
 * Large refactor
 
= v0.7.1 = 
 * Redesign of the in-post summary generation
 * "Reject" automatically generates new summary in in-post summary generation
 * Disable buttons when generating summary or rating

= v0.7.0 =
 * Create summaries automatically on Publish
 * Setting to enable automatic summaries
 * Uses action-scheduler [https://actionscheduler.org/] to create summaries in the background

= 0.6.9 =
 * Add custom links on the Review screen, eg. to quickly Tweet a summary
 
= 0.6.8 =
 * Detect if able to connect to OpenAI with API Key
 * Display error on Settings and Types page if issue with API Key
 * Remove some deprecated options from the Settings page

= 0.6.7 = 
 * Remove deprecated Javascript variable injection that was throwing an error anyway
 * Fix bug with table creation
 * Add name to summary type tables in reports
 * Cards for reports

= 0.6.6 =
 * Fix bad bug with default options
 
= 0.6.5 =
 * Reporting for each type

= 0.6.4 =
 * Ability to edit summaries
 * Loading state

= 0.6.3 =
 * Append Prompt feature

= 0.6.2 =
 * Summary limits per summary type
 * API key can be set as OPENAI_APIKEY constant
    * Hide API key setting if constant is set
    * Make API key a password field
    * Delete the API key as an option when the constant is set

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