# SummaryEngine For Editors

SummaryEngine uses machine learning to help editors generate summaries to articles. It would typically be used in a newsroom, but can be used in other contexts too. 

It uses the "human-in-the-loop" approach, where the editor is responsible for quality control, and can choose to accept, reject or edit the summary.

Multiple summaries can be generated for each article, serving different purposes. For instance, you might generate a bullet-point summary for the start of the article, a longer summary for use in a newsletter, and a Twitter summary.

SummaryEngine uses OpenAI's Open-GPT machine learning models, so you will need an API key to use it. You can get one [here](https://beta.openai.com/).

There are three ways of generating summaries. The first is the automatic summary generation, which can occure automatically when you publish a post. The second is the manual summary generation, which you can do from the post edit screen. The third is the bulk summary generation, which you can do from the SummaryEngine Review page.

## Automatic Summary Generation

When you publish a post, SummaryEngine will automatically generate a summary for it, provided the feature is enabled and that you haven't already generated a summary for the post. The summary should still be approved by an editor before it is shown to the public, typically in the Review Page.

## Manual Summary Generation

You can generate a summary for a post from the post edit screen. All that is required is that there is some text in the post body. You can then choose the summary type, and click "Generate Summary". The summary will be generated, and you can then approve or reject it. If you reject it, a new summary will be automatically generated for you (provided you have sufficient summaries remaining).

This view has additional functionality compared to the Review Page. 

- You can revert back to a previous Summary and select it instead. 
- You can edit the summary before approving it.
- You can fine-tune the settings for the summary. See [SummaryEngine Summary Types](admins.md#summaryengine-summary-types) for more information.

## Bulk Summary Generation

You can generate summaries for multiple posts at once from the SummaryEngine Review page. This is useful if you have a lot of posts that need summaries, or if you want to generate summaries for a specific type of post.

To access it, go to ***SummaryEngine > Review***.

This screen will let you quickly approve, reject or edit summaries. You can also generate new summaries for posts that don't have one.

Unapproved summaries are shown in yellow. Rejected summaries are shown in red. Approved summaries do not have a background colour. 

To generate a single summary, click "Summarise" next to the post. To generate summaries for multiple summary types, click "Summarise All".

To approve a summary, simply mouseover the summary to expand it, and click the "Approve" button. To reject a summary, click the "Reject" button. A new summary will automatically be generated. To edit a summary, click the "Edit" button. To generate a new summary, click the "Generate" button.

To preview an article, click the icon of the eye next to the article's title. To edit the article, click the article's title.

You can search or filter the posts by date.