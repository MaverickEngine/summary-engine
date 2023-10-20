# SummaryEngine Summary Types

You can create, delete and manage different types of summaries in the Wordpress admin panel, under SummaryEngine > Types.

Click the "New Type" tab to create a new type. 

Types have the following fields:

- **Name** - The name of the type. This is used to identify the type in the admin panel, and is also used in the RSS feed.
- **Slug** - The slug of the type. This will be used in as the post metadata key. It is automatically generated from the name.
- **Prepend Prompt** - This is typically the instruction you want to send to the model, such as "Write a summary of this article". It will be prepended to the article text that we submit to GPT-3.
- **Append Prompt** - This is typically an example of the format we want returned, and important to note that it will be appended to the result. For instance, you might want to add a bullet point (`-`) to the end of the prompt, so that the model knows to return a bullet-pointed list. Usually you will leave this blank.
OpenAI Model
- **Method** - Select Chat for chatbot-like APIs (noteably ChatGPT-4) or Complete for the standard API (GPT-3 or GPT-3.5).
- **OpenAI Model** - The OpenAI model to use. You can choose from Text-Davinci-001, Text-Davinci-002, Text-Davinci-003, Text-Curie-001, Text-Babbage-001 or Text-Ada-001. There are cost implications with choosing a better model, and it might not always perform as well as one of the other options. See [OpenAI's documentation](https://beta.openai.com/docs/models) for more information.
- **Submission word limit** - The maximum number of words to allow in a submission. Very long articles could either become very expensive, or the model might not be able to generate a summary. For some cases, you might get better results by exposing less of the article, which can bring in unimportant points, provided your article is written in the pyramid style. We recommend between 500 and 750 words, although for Tweets, you can go down to 250 or so.
- **Cut at paragraph nearest end?** - Whether to cut the article at the nearest paragraph to the word limit. This is useful if you want to avoid cutting a sentence in half. If you don't want to cut at the nearest paragraph, the article will be cut at the word limit.
- **Max Tokens** - This is the maximum number of tokens that OpenAI will use, but be aware that it includes both the submitted text as well as the result. A low number can result in the response being truncated. Make sure your number is high enough to allow for the submitted text, and the result. See [What are tokens and how to count them?](https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them) for more information.
- **Temperature** - What sampling temperature to use. Higher values means the model will take more risks. Try 0.9 for more creative applications, and 0 (argmax sampling) for ones with a well-defined answer. We generally recommend altering this or top_p but not both.
- **Top P** - What top_p to use. An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered. We generally recommend altering this or temperature but not both.
- **Presence Penalty** - Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.
- **Frequency Penalty** - Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.
- **Custom action** - Call a custom action based on the summary and post, eg. post to Twitter. Use [post_url] and [summary], and [summary_encoded] as variables. See [Custom Actions](custom-actions.md) for more information.